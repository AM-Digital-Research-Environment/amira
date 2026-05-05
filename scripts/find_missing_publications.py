"""Diff the cluster website's *Recent Publications* page against ERef
Bayreuth (division 340050) and emit a Zotero-importable BibTeX (and RIS)
file containing only the references that are *not* yet in ERef.

The cluster page at <https://www.africamultiple.uni-bayreuth.de/en/1_2-Research/Publications/Folder-Recent-Publications/index.html>
is curated by the cluster's communications team and lists items spanning
the whole EXC 2052 lifetime. Many entries link out to ERef Bayreuth,
others don't yet — this script finds the *don't yet* set so the cluster
team can clean it up and deposit them in ERef.

Reconciliation order (each entry stops at the first hit):

1. ERef permalink present in the cluster-page entry → already in ERef.
2. DOI normalized exact match against any ERef-division BibTeX entry.
3. Fuzzy match: normalized title + publication year + first-author
   surname against the ERef-division BibTeX (matches the same
   normalization used by ``fetch_publications.py``).

Anything that survives all three is rendered as a fresh BibTeX entry
from the metadata scraped off the cluster page (title, authors, year,
journal/booktitle, volume, issue, pages, DOI, ISBN/ISSN, abstract).

Run::

    .venv/Scripts/python scripts/find_missing_publications.py

Outputs land in ``scripts/out/`` (gitignored)::

    missing_publications.bib       # Zotero / Reference Manager import
    missing_publications.ris       # alternative format, same content
    missing_publications.review.tsv  # one row per scraped entry, with
                                     # decision + reasoning so you can
                                     # spot-check fuzzy matches before
                                     # importing

Use ``--include-epub`` if you also want to skip items already in EPub
Bayreuth division 340050 (default: ERef-only, per the cluster team's
request to focus on ERef gaps).
"""

from __future__ import annotations

import argparse
import io
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

import bibtexparser
import requests
from bibtexparser.bparser import BibTexParser
from bs4 import BeautifulSoup, NavigableString, Tag

# Reuse the heavy-lifting normalizers that ship with the data fetcher.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_publications import (  # noqa: E402
    EP3_NS,
    _decode_latex_accents,
    _LATEX_LITERALS,
    _strip_accents,
    derive_quarter,
    normalize_doi,
    normalize_title,
)

# Force UTF-8 stdout so accented author/title strings print on Windows.
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = Path(__file__).resolve().parent
CACHE_DIR = SCRIPTS_DIR / ".cluster_publications_cache"
OUT_DIR = SCRIPTS_DIR / "out"

CLUSTER_URL = (
    "https://www.africamultiple.uni-bayreuth.de/en/1_2-Research/Publications/"
    "Folder-Recent-Publications/index.html"
)

EREF_DIVISION_BIBTEX = (
    "https://eref.uni-bayreuth.de/cgi/exportview/divisions/340050/BibTeX/340050.bib"
)
EREF_DIVISION_XML = (
    "https://eref.uni-bayreuth.de/cgi/exportview/divisions/340050/XML/340050.xml"
)
EPUB_DIVISION_BIBTEX = (
    "https://epub.uni-bayreuth.de/cgi/exportview/divisions/340050/BibTeX/340050.bib"
)
EPUB_DIVISION_XML = (
    "https://epub.uni-bayreuth.de/cgi/exportview/divisions/340050/XML/340050.xml"
)

USER_AGENT = (
    "AMIRA-cluster-publications-reconciler/1.0 "
    "(https://github.com/AM-Digital-Research-Environment/amira)"
)
CACHE_TTL_SECONDS = 24 * 60 * 60  # 24 hours

# Markup canary: if the page suddenly yields fewer entries than this, the
# TYPO3 layout has shifted and we should fail loudly rather than silently
# deposit fewer-than-real "missing" records into the BibTeX. The cluster
# page currently surfaces ~250 entries (a mix of h2-anchored "featured"
# items and self-contained <p> citations).
MIN_EXPECTED_ENTRIES = 200


# --------------------------------------------------------------------------- #
# Cluster-page entry model
# --------------------------------------------------------------------------- #


@dataclass
class ScrapedEntry:
    """One publication parsed from the cluster website."""

    title: str
    type: str  # 'article' | 'chapter' | 'book' | 'edited_book' | 'misc'
    authors: list[str] = field(default_factory=list)
    editors: list[str] = field(default_factory=list)
    book_editors: list[str] = field(default_factory=list)  # editors of parent volume for chapters
    year: int | None = None
    quarter: int | None = None  # from the year-quarter heading the entry sits under
    journal: str | None = None
    booktitle: str | None = None
    volume: str | None = None
    issue: str | None = None
    pages: str | None = None
    publisher: str | None = None
    address: str | None = None
    series: str | None = None
    doi: str | None = None
    isbn: str | None = None
    issn: str | None = None
    abstract: str | None = None
    eref_url: str | None = None
    epub_url: str | None = None
    publisher_url: str | None = None  # external "Link to Publication"
    raw_metadata: str = ""  # full source string, kept for review


# --------------------------------------------------------------------------- #
# HTTP fetch with disk cache
# --------------------------------------------------------------------------- #


def fetch_with_cache(url: str, cache_name: str, no_cache: bool = False) -> str:
    """GET ``url`` with a 24-hour disk cache so re-runs during cleanup
    don't hammer the server. ``cache_name`` is the filename written under
    ``CACHE_DIR``; absent extension is OK."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / cache_name
    if (
        not no_cache
        and cache_path.exists()
        and (time.time() - cache_path.stat().st_mtime) < CACHE_TTL_SECONDS
    ):
        return cache_path.read_text(encoding="utf-8")
    print(f"  GET {url}", flush=True)
    response = requests.get(url, timeout=60, headers={"User-Agent": USER_AGENT})
    response.raise_for_status()
    response.encoding = response.apparent_encoding or "utf-8"
    text = response.text
    cache_path.write_text(text, encoding="utf-8")
    return text


# --------------------------------------------------------------------------- #
# Cluster-website HTML parsing
# --------------------------------------------------------------------------- #

QUARTER_HEADING_RE = re.compile(r"^\s*(20\d\d)\s*[\-‐–—]\s*([IVX]+)\s*$")
ROMAN_TO_INT = {"I": 1, "II": 2, "III": 3, "IV": 4}

# Markers that identify a metadata <p> block (vs. abstract / labels / etc.)
METADATA_MARKERS = ("In:", "Hrsg.", "Bd.", "DOI:", "ISBN", "ISSN", " S.")
# Page header noise — skip h2's that match these patterns when looking for
# publication titles. Without these, "PUBLICATIONS BY BAYREUTH ACADEMY
# FELLOWS" or "Fellows 2023/2024" would be treated as titles.
NOISE_HEADING_RE = re.compile(
    r"^(Fellows\b|PUBLICATIONS\s|Africa Multiple Publications$|Abstract$|"
    r"Recent Publications$|Most Recent Publications$)",
    re.IGNORECASE,
)


def is_quarter_heading(text: str) -> tuple[int, int] | None:
    """Return ``(year, quarter)`` if the heading text matches the
    ``YYYY - <Roman>`` pattern, else None."""
    m = QUARTER_HEADING_RE.match(text)
    if not m:
        return None
    year = int(m.group(1))
    quarter = ROMAN_TO_INT.get(m.group(2))
    if quarter is None:
        return None
    return year, quarter


def looks_like_metadata_p(p: Tag) -> bool:
    """A ``<p>`` carries the entry's citation if it contains at least one
    of the venue / identifier markers we recognise."""
    text = p.get_text(" ", strip=True)
    if not text:
        return False
    return any(marker in text for marker in METADATA_MARKERS)


def parse_cluster_page(html: str) -> list[ScrapedEntry]:
    """Walk the cluster page in document order and emit one entry per
    metadata-bearing <p>. The page mixes two layouts:

    - **Featured items** (top of the page): title in an ``<h2>``, then
      ``<p>Abstract</p>``, ``<p>...abstract...</p>``, ``<p>...citation...</p>``,
      ``<p>Link to Publication</p>``. We pair the citation <p> with its
      preceding title and abstract.
    - **Bulk archive** (the rest of the page): each entry is one
      self-contained ``<p>`` with no preceding ``<h2>``. Title is either
      inside an ``<a><strong>`` or inline in the prose, depending on the
      citation style (cluster-format vs. Chicago-format).

    Either layout produces a ``ScrapedEntry``; if we can't reliably extract
    a title, we fall back to a best-guess slice of the source text and
    stash the raw citation in ``raw_metadata`` so the manual cleanup step
    can recover it."""
    soup = BeautifulSoup(html, "html.parser")
    entries: list[ScrapedEntry] = []
    current_quarter: int | None = None
    current_year: int | None = None

    block_tags = ("h1", "h2", "h3", "h4", "p")
    pending_h2_title: str | None = None
    pending_abstract: str | None = None
    saw_abstract_label = False

    for el in soup.find_all(block_tags):
        text = el.get_text(" ", strip=True)
        if not text:
            continue

        # 1. Quarter heading: anchor every following entry to it. Reset
        #    any pending title/abstract so they don't leak across buckets.
        if el.name == "h2":
            qh = is_quarter_heading(text)
            if qh:
                current_year, current_quarter = qh
                pending_h2_title = None
                pending_abstract = None
                saw_abstract_label = False
                continue
            if NOISE_HEADING_RE.match(text):
                pending_h2_title = None
                pending_abstract = None
                saw_abstract_label = False
                continue
            # Featured-item title — bind to the next metadata <p>.
            pending_h2_title = text.rstrip(".").strip()
            pending_abstract = None
            saw_abstract_label = False
            continue

        # h3 / h4 / h1 are ignored for entry extraction.
        if el.name != "p":
            continue

        # "Abstract" label / abstract text: only relevant when a featured
        # title is pending.
        if pending_h2_title is not None:
            if text == "Abstract":
                saw_abstract_label = True
                continue
            if saw_abstract_label and pending_abstract is None:
                pending_abstract = text
                saw_abstract_label = False
                continue
            if text.lower().startswith("link to publication"):
                link_tag = el.find("a", href=True)
                if entries and link_tag:
                    href = link_tag["href"]
                    if "doi.org" not in href and entries[-1].publisher_url is None:
                        entries[-1].publisher_url = href
                continue

        # The citation <p>. Two paths:
        if not looks_like_metadata_p(el):
            continue

        title_for_entry: str | None = None
        prefilled_authors: list[str] = []
        prefilled_editors: list[str] = []
        if pending_h2_title is not None:
            title_for_entry = pending_h2_title
            # h2 already gives us the title — but the metadata <p> still
            # carries the author block (often as a Chicago-style line),
            # so try to pull authors from there.
            prefilled_authors = _try_extract_chicago_authors_only(el)
        else:
            t_inline, a_inline, e_inline = _extract_inline_title_and_authors(el, text)
            title_for_entry = t_inline
            prefilled_authors = a_inline
            prefilled_editors = e_inline

        if not title_for_entry:
            # Last-ditch fallback so we still emit a record; the reviewer
            # can rename it in Zotero.
            title_for_entry = text[:120].rstrip(" .,") or "Untitled cluster-page entry"

        entry = parse_metadata_block(
            el,
            title=title_for_entry,
            abstract=pending_abstract,
            year=current_year,
            quarter=current_quarter,
            prefilled_authors=prefilled_authors,
            prefilled_editors=prefilled_editors,
        )
        # The cluster page renders the ERef / EPub permalink (and the
        # publisher URL) in a *separate* trailing <p>Link to Publication</p>
        # rather than inside the citation block. Walk forward up to a few
        # block-level neighbours to harvest those identifier links.
        _attach_trailing_links(el, entry)
        entries.append(entry)
        pending_h2_title = None
        pending_abstract = None
        saw_abstract_label = False

    return entries


def _attach_trailing_links(citation_p: Tag, entry: ScrapedEntry) -> None:
    """Walk the next 4 block siblings after the citation <p>; for each
    that contains anchors, harvest ERef / EPub permalinks and (when no
    DOI is set) the first non-DOI external link as ``publisher_url``.
    Stops at the next h2/h3 heading or another metadata-bearing <p>."""
    block_tags = ("h1", "h2", "h3", "h4", "p")
    walked = 0
    for sib in citation_p.find_all_next(block_tags):
        if walked >= 4:
            break
        walked += 1
        if sib.name in ("h1", "h2", "h3", "h4"):
            return
        if sib.name == "p" and looks_like_metadata_p(sib):
            return
        text = sib.get_text(" ", strip=True)
        # Most often the trailing <p> is literal "Link to Publication"
        # wrapping a single anchor. Be permissive: any anchor inside is
        # fair game.
        for a in sib.find_all("a", href=True):
            href = a["href"]
            if (
                re.search(r"eref\.uni-bayreuth\.de/id/eprint/\d+", href)
                and entry.eref_url is None
            ):
                entry.eref_url = href.rstrip("/") + "/"
            elif (
                re.search(r"epub\.uni-bayreuth\.de/id/eprint/\d+", href)
                and entry.epub_url is None
            ):
                entry.epub_url = href.rstrip("/") + "/"
            elif (
                "doi.org" not in href
                and entry.publisher_url is None
                and href.startswith("http")
            ):
                entry.publisher_url = href
        # Stop walking after we found at least one identifier link, to
        # avoid leaking neighbour-entry links into this entry.
        if entry.eref_url or entry.epub_url:
            return
        # If the sib has no anchors and isn't "Link to Publication", keep
        # walking — sometimes there's an empty <p> in between.
        if text and not text.lower().startswith("link to publication"):
            continue


# Inline-title heuristics. The cluster page uses `<br>` to separate
# fields within a citation block (authors, title, venue, IDs). We split
# on those line breaks and classify each line — that's far more robust
# than regex on the flattened text, especially for entries whose title
# itself contains colons (subtitles) or whose citation style is Chicago
# rather than EPrints.

VENUE_PREFIXES = (
    "In:",
    "In :",
    "Hrsg.:",
    "Hrsg. :",
    "Hrsg.",
    "DOI:",
    "DOI :",
    "ISBN",
    "ISSN",
    "Bd.",
    "Heft",
)
INLINE_TITLE_QUOTED_RE = re.compile(
    # Straight, curly, guillemet, AND smart-single quotes — the cluster
    # page mixes them depending on the depositor.
    r"[\"“”«»‘’](?P<t>[^\"“”«”«»‘’]{6,250})[\"“”«»‘’]"
)


def _p_lines(p: Tag) -> list[str]:
    """Split a <p>'s children on <br> boundaries and return the resulting
    non-empty text lines (with descendants' text inlined)."""
    out: list[str] = []
    buf: list[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, NavigableString):
            buf.append(str(node))
        elif isinstance(node, Tag):
            if node.name == "br":
                out.append("".join(buf))
                buf.clear()
            else:
                for c in node.children:
                    walk(c)

    for c in p.children:
        walk(c)
    if buf:
        out.append("".join(buf))
    return [_normalise_text(line) for line in out if _normalise_text(line)]


def _line_starts_with_venue_marker(line: str) -> bool:
    return any(line.startswith(prefix) for prefix in VENUE_PREFIXES)


def _looks_like_authors(line: str) -> bool:
    """`Last, First ; Last, First` — characteristic of the cluster's
    EPrints-formatted author block. We require at least one ``;`` OR a
    trailing ``:`` to avoid mistaking a title that happens to contain a
    comma."""
    if not line:
        return False
    if line.endswith(":"):
        return True
    if ";" in line and "," in line.split(";", 1)[0]:
        return True
    return False


CHICAGO_AUTHOR_BLOCK_RE = re.compile(
    # Capture everything up to ".  YEAR." — that's the chicago author /
    # date pivot. The block typically looks like
    # ``Lastname, F., G. Lastname, ... and H. Lastname. YEAR. Title.``
    # We require the author block to NOT contain " In " so that
    # citations whose year sits *after* the venue (rare but happens)
    # don't get mis-pivoted on a venue word.
    r"^(?P<authors>(?:(?! In ).)+?)\.\s+(?P<year>(?:19|20)\d{2})\.\s+(?P<rest>.+)$",
    re.DOTALL,
)


def _split_chicago_authors(block: str) -> list[str]:
    """Best-effort split of a Chicago-style author chunk into separate
    ``Last, First`` strings. Falls back to returning the chunk as one
    string if the structure isn't recognisable — Zotero still ingests
    that into a single Author entry that the user can fix during
    cleanup."""
    block = block.strip(" .,")
    if not block:
        return []
    # First isolate a final " and Lastname" if present.
    m = re.match(r"^(?P<head>.+?),?\s+and\s+(?P<tail>[^,]+(?:,\s*[A-Z][^,]*)?)$", block)
    if not m:
        return [block]
    head = m.group("head").strip(" ,")
    tail = m.group("tail").strip(" ,")
    # The head is e.g. "Lastname, F., G. Lastname, K. Lastname". The
    # first author owns the FIRST comma (between Last and Initial), then
    # subsequent authors are space-prefixed.
    parts: list[str] = []
    pieces = re.split(r",\s+", head)
    if len(pieces) >= 2:
        # The first author is "Lastname, F." — recombine with the next
        # piece if it looks like initials only.
        if re.fullmatch(r"[A-Z](?:\.\s*[A-Z]?)*\.?", pieces[1]):
            parts.append(f"{pieces[0]}, {pieces[1]}")
            parts.extend(pieces[2:])
        else:
            parts.extend(pieces)
    else:
        parts.extend(pieces)
    parts.append(tail)
    return [p.strip(" .,") for p in parts if p.strip(" .,")]


def _sanitize_title(title: str) -> str:
    """Strip noise off scraped titles: leading year prefix
    (``2020 Title…`` or ``2020. Title…``), the literal ``DOI:`` /
    ``ISBN`` / ``ISSN`` prefixes (from entries where a metadata-marker
    line accidentally became the title), trailing ``. In: …`` venue,
    and a hard 250-char cap so a malformed entry doesn't ship a
    paragraph as its title."""
    if not title:
        return title
    t = title.strip()
    # Drop a leading 4-digit year + optional period + space.
    t = re.sub(r"^(?:19|20)\d{2}\.?\s+", "", t)
    # Drop a leading ``DOI:`` / ``ISBN`` / ``ISSN`` if present (occurs
    # when a parser fall-through landed on an identifier line).
    t = re.sub(r"^(?:DOI|ISBN|ISSN)\s*[:\-]?\s*", "", t, flags=re.IGNORECASE)
    # If we accidentally captured "...Title. In: Venue ...", chop at ". In:".
    m = re.search(r"\.\s+In\s*[:,]", t, flags=re.IGNORECASE)
    if m:
        t = t[: m.start()]
    t = t.rstrip(" .,;:")
    if len(t) > 250:
        # First sentence boundary, else hard truncate.
        first = re.match(r"^(.{20,250}?)[\.\?\!](?:\s|$)", t)
        if first:
            t = first.group(1).rstrip()
        else:
            t = t[:250].rstrip()
    return t


def _extract_inline_title_and_authors(
    p: Tag, fallback_text: str
) -> tuple[str | None, list[str], list[str]]:
    """Walk ``<br>``-delimited lines inside a citation <p> and pick out
    title, authors, editors. Returns ``(title, authors, editors)`` —
    any of which may be empty/None. Falls back to Chicago-style parsing
    when the cluster page emitted a single-line citation, and to a
    couple of regex heuristics for entries that defy structure
    altogether."""
    # Structural extraction first.
    a_strong = p.find("a")
    if a_strong is not None:
        strong = a_strong.find("strong")
        if strong is not None:
            t = strong.get_text(" ", strip=True).rstrip(".").strip()
            if t:
                return _sanitize_title(t), [], []
    bare_strong = p.find("strong")
    if bare_strong is not None:
        t = bare_strong.get_text(" ", strip=True).rstrip(".").strip()
        if t:
            return _sanitize_title(t), [], []

    lines = _p_lines(p)
    # Drop lines that are venue / identifier prefixes — those won't carry
    # a title.
    head_lines = [l for l in lines if not _line_starts_with_venue_marker(l)]
    title: str | None = None
    authors: list[str] = []
    editors: list[str] = []

    if not head_lines:
        return None, [], []

    # Two-line author + title pattern (most common cluster layout).
    if len(head_lines) >= 2 and _looks_like_authors(head_lines[0]):
        author_block = head_lines[0].rstrip(":").strip()
        a_parts, is_editor = _editor_split(author_block)
        if is_editor:
            editors = a_parts
        else:
            authors = a_parts
        title = _sanitize_title(head_lines[1])
        return title, authors, editors

    # Single-line "Author(s) : Title" (Alfieri / book-without-In: pattern).
    line = head_lines[0]
    if ":" in line and "," in line.split(":", 1)[0]:
        author_part, title_part = line.split(":", 1)
        author_part = author_part.strip()
        title_part = title_part.rstrip(".").strip()
        if title_part and len(title_part.split()) >= 3:
            a_parts, is_editor = _editor_split(author_part)
            if is_editor:
                editors = a_parts
            else:
                authors = a_parts
            return _sanitize_title(title_part), authors, editors

    # Chicago-style single-line citation: ``Authors. YEAR. Title. Venue.``
    m_chi = CHICAGO_AUTHOR_BLOCK_RE.match(line)
    if m_chi:
        author_block = m_chi.group("authors")
        rest = m_chi.group("rest")
        # The first ". " after the author/date pivot ends the title.
        title_match = re.match(r"^(?P<title>.+?)\.\s+", rest)
        if title_match:
            authors = _split_chicago_authors(author_block)
            return _sanitize_title(title_match.group("title")), authors, []

    # Quoted title (Chicago variant where title is in quotes).
    m = INLINE_TITLE_QUOTED_RE.search(fallback_text)
    if m:
        return _sanitize_title(m.group("t")), [], []

    # Last resort: first non-venue line as title (with sanitisation so
    # we don't ship 1300-char paragraphs).
    return _sanitize_title(line), authors, editors


def _try_extract_chicago_authors_only(p: Tag) -> list[str]:
    """For h2-anchored entries (where we already have the title from the
    heading) we still need the author block. The metadata <p> for
    featured items is usually a Chicago-style line — pick out everything
    before the year-period pivot."""
    lines = _p_lines(p)
    head_lines = [l for l in lines if not _line_starts_with_venue_marker(l)]
    if not head_lines:
        return []
    # Try the two-line pattern (cluster EPrints style) first.
    if len(head_lines) >= 2 and _looks_like_authors(head_lines[0]):
        author_block = head_lines[0].rstrip(":").strip()
        return [p.strip() for p in re.split(r"\s*;\s*", author_block) if p.strip()]
    # Then Chicago.
    m = CHICAGO_AUTHOR_BLOCK_RE.match(head_lines[0])
    if m:
        return _split_chicago_authors(m.group("authors"))
    return []


# --------------------------------------------------------------------------- #
# Metadata-block parsing
# --------------------------------------------------------------------------- #

YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")
ISBN_RE = re.compile(r"ISBN\s*[:\-]?\s*([0-9Xx\-‐–]+)")
ISSN_RE = re.compile(r"ISSN\s*[:\-]?\s*([0-9Xx\-‐–]+)")
VOLUME_RE = re.compile(r"\bBd\.\s*([0-9A-Za-z\-/]+)")
ISSUE_RE = re.compile(r"\bHeft\s*([0-9A-Za-z\-/]+)")
PAGES_RE = re.compile(r"\.\s*-\s*S\.\s*([0-9A-Za-z\-‐–\.]+)")
ARTICLE_LOCATOR_RE = re.compile(r"\.\s*-\s*([eE]?\d+[a-z]?)\.")
SERIES_RE = re.compile(r"\(\s*([^()]+?)\s*[;:]\s*([0-9A-Za-z\-/]+)\s*\)")
PUBLISHER_RE = re.compile(r"^\s*([^,:]+?)\s*:\s*(.+?)\s*,\s*(\d{4})\b")


def _editor_split(authors_block: str) -> tuple[list[str], bool]:
    """Split a `Last, First ; Last, First` block into a list and report
    whether a `(Hrsg.)` editor qualifier appeared anywhere."""
    is_editor = "(Hrsg.)" in authors_block or "Hrsg.:" in authors_block
    cleaned = re.sub(r"\(\s*Hrsg\.\s*\)", "", authors_block)
    cleaned = cleaned.replace("Hrsg.:", "")
    parts = [p.strip(" .;") for p in re.split(r"\s*;\s*", cleaned) if p.strip(" .;")]
    return parts, is_editor


def _normalise_text(s: str) -> str:
    """Collapse runs of whitespace (incl. NBSP) and strip surrounding
    junk. Keeps punctuation."""
    s = s.replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_metadata_block(
    p: Tag,
    *,
    title: str,
    abstract: str | None,
    year: int | None,
    quarter: int | None,
    prefilled_authors: list[str] | None = None,
    prefilled_editors: list[str] | None = None,
) -> ScrapedEntry:
    """Parse a metadata <p> into a ScrapedEntry. The block is messy
    free-form prose so we lean on regex anchors (Bd., Heft, ISBN, …) more
    than HTML structure. Anything we can't pull out lands in
    ``raw_metadata`` so the user can patch by hand at the Zotero stage."""
    raw_html = str(p)
    text = _normalise_text(p.get_text(" ", strip=True))

    # Identifier links (most reliable signal we have)
    eref_url = None
    epub_url = None
    publisher_url = None
    for a in p.find_all("a", href=True):
        href = a["href"]
        if re.search(r"eref\.uni-bayreuth\.de/id/eprint/\d+", href):
            eref_url = href.rstrip("/") + "/"
        elif re.search(r"epub\.uni-bayreuth\.de/id/eprint/\d+", href):
            epub_url = href.rstrip("/") + "/"
        elif "doi.org/" not in href and publisher_url is None:
            # First non-DOI external link
            publisher_url = href

    # DOI: prefer doi.org href; fall back to bare DOI text.
    doi = None
    for a in p.find_all("a", href=True):
        href = a["href"]
        m = re.search(r"doi\.org/(10\.[^\s\"<>]+)", href)
        if m:
            doi = m.group(1)
            break
    if not doi:
        m = re.search(r"\bDOI\s*:\s*(10\.\S+)", text)
        if m:
            doi = m.group(1).rstrip(".,;")

    # ISBN / ISSN
    isbn = None
    issn = None
    m = ISBN_RE.search(text)
    if m:
        isbn = re.sub(r"[\s‐–]", "-", m.group(1)).strip("-")
    m = ISSN_RE.search(text)
    if m:
        issn = re.sub(r"[\s‐–]", "-", m.group(1)).strip("-")

    # Volume / issue / pages / article locator
    volume = None
    issue = None
    pages = None
    m = VOLUME_RE.search(text)
    if m:
        volume = m.group(1)
    m = ISSUE_RE.search(text)
    if m:
        issue = m.group(1)
    m = PAGES_RE.search(text)
    if m:
        pages = m.group(1).replace("‐", "-").replace("–", "-")
    if not pages:
        m = ARTICLE_LOCATOR_RE.search(text)
        if m:
            pages = m.group(1)

    # Series
    series = None
    m = SERIES_RE.search(text)
    if m:
        series = f"{m.group(1).strip()} ; {m.group(2).strip()}"

    # Year — prefer a 4-digit year inside the metadata text, fall back to
    # the surrounding quarter heading.
    year_in_text = None
    for m in YEAR_RE.finditer(text):
        candidate = int(m.group(0))
        if 1990 <= candidate <= 2100:
            year_in_text = candidate
    pub_year = year_in_text or year

    # Authors / editors / book_editors. Start from anything the inline
    # title-extractor already pulled (it knows about the cluster-style
    # `Author: Title` and two-line `Authors:\nTitle` patterns).
    authors: list[str] = list(prefilled_authors or [])
    editors: list[str] = list(prefilled_editors or [])
    book_editors: list[str] = []
    booktitle: str | None = None
    journal: str | None = None
    publisher: str | None = None
    address: str | None = None

    # Strategy: split the textual block on <br>-equivalent boundaries.
    # The cluster page interpolates <br/> between fields, which the
    # textual content collapses into ". " or " . " — but we also keep
    # the inner HTML to walk the `<em>` markers.
    # We look for the "In:" tag (rendered as an <em>) and partition.

    em_in = p.find("em", string=re.compile(r"^\s*In:\s*$"))
    em_hrsg = p.find("em", string=re.compile(r"^\s*Hrsg\.\s*:?\s*$"))

    # Locate the "before-In:" prose (which usually contains the article's
    # author block) and the "after-In:" prose (which contains the venue).
    before_in_text = None
    after_in_text = None
    if em_in is not None:
        # Everything textually before the <em> tag
        pre_parts: list[str] = []
        for sib in em_in.previous_siblings:
            if isinstance(sib, NavigableString):
                pre_parts.append(str(sib))
            elif isinstance(sib, Tag):
                pre_parts.append(sib.get_text(" ", strip=False))
        before_in_text = _normalise_text("".join(reversed(pre_parts)))
        post_parts: list[str] = []
        for sib in em_in.next_siblings:
            if isinstance(sib, NavigableString):
                post_parts.append(str(sib))
            elif isinstance(sib, Tag):
                post_parts.append(sib.get_text(" ", strip=False))
        after_in_text = _normalise_text("".join(post_parts))

    # Article authors — sit before "In:" in pattern B (author-first p).
    # Pattern A (title-anchored p) has the title as the first <a> so the
    # author block is empty before "In:". Skip when the inline title
    # extractor already prefilled them so we don't duplicate.
    if before_in_text and not authors and not editors:
        # Drop the title if it's repeated (it usually is — but not always
        # at the very start of the block).
        clean_before = before_in_text.rstrip(": .")
        # Heuristic: if the block ends with the title, strip it; what
        # remains are the authors.
        if title and clean_before.lower().endswith(title.lower()):
            clean_before = clean_before[: -len(title)].rstrip(" .:")
        # Also if before-text contains "Title:\n  authors", split on ":"
        # The author list typically uses ";" separators.
        author_block = clean_before
        # Remove any trailing colon
        author_block = author_block.rstrip(":, ")
        authors_parts, is_editor_block = _editor_split(author_block)
        if is_editor_block:
            editors.extend(authors_parts)
        else:
            authors.extend(authors_parts)

    # Chapter / edited-volume editors come after "In:" with "(Hrsg.)".
    if after_in_text:
        # "Authors (Hrsg.): Booktitle. - Address : Publisher, Year ..."
        # Pull editors if "(Hrsg.)" is in the after-In: string.
        m = re.match(
            r"^(?P<eds>[^:]+?)\s*\(\s*Hrsg\.\s*\)\s*:\s*(?P<rest>.*)$",
            after_in_text,
        )
        if m:
            book_editors_block = m.group("eds")
            rest = m.group("rest")
            be_parts, _ = _editor_split(book_editors_block)
            book_editors.extend(be_parts)
            # rest = booktitle + venue
            booktitle, address, publisher, after_pub_year = _split_book_venue(rest)
            if after_pub_year and not pub_year:
                pub_year = after_pub_year
        else:
            # Pattern A / B journal article: "<Journal>. Bd. X (Year) Heft Y . - pages."
            journal = _split_journal(after_in_text)

    # No "In:" at all — this is a standalone book or edited book.
    if em_in is None:
        # Authors / editors come before any <em>Hrsg.:</em> or are absent.
        # Title is in our pending_title; we don't repeat it. Check the
        # text for ISBN + publisher pattern.
        # Authors / editors block: everything before "Hrsg.:" or before
        # the publisher line, excluding the (re-)title.
        body = text
        # Drop a leading "<title>." if present
        if title and body.lower().startswith(title.lower()):
            body = body[len(title) :].lstrip(". ")
        # Editors via "Hrsg.:" prefix
        m = re.search(r"\bHrsg\.\s*:\s*([^\.]+?)(?=\s*\b(?:[A-Z][^,]+?,\s*\d{4})|$)", body)
        if m:
            ed_parts, _ = _editor_split(m.group(1))
            editors.extend(ed_parts)
        # Otherwise authors via leading "Last, First ; …" before the
        # publisher line.
        elif body and not editors:
            # Take everything up to the first ". " or "<Address> :" pattern
            head = re.split(r"\.\s+", body, maxsplit=1)[0]
            if ";" in head and "," in head:
                au_parts, _ = _editor_split(head)
                authors.extend(au_parts)
        # Publisher / address / year via "Address : Publisher, Year"
        m = PUBLISHER_RE.search(body)
        if m:
            address = m.group(1).strip(" ,;")
            publisher = m.group(2).strip(" ,;")
            if not pub_year:
                pub_year = int(m.group(3))

    entry_type = _classify_type(
        em_in_present=em_in is not None,
        is_edited=bool(em_hrsg) or bool(editors and not authors),
        has_journal=bool(journal),
        has_booktitle=bool(booktitle),
        has_isbn=bool(isbn),
    )

    return ScrapedEntry(
        title=_normalise_text(title),
        type=entry_type,
        authors=authors,
        editors=editors,
        book_editors=book_editors,
        year=pub_year,
        quarter=quarter,
        journal=journal,
        booktitle=booktitle,
        volume=volume,
        issue=issue,
        pages=pages,
        publisher=publisher,
        address=address,
        series=series,
        doi=doi,
        isbn=isbn,
        issn=issn,
        abstract=_normalise_text(abstract) if abstract else None,
        eref_url=eref_url,
        epub_url=epub_url,
        publisher_url=publisher_url,
        raw_metadata=text,
    )


def _split_journal(after_in_text: str) -> str | None:
    """For an article: ``Journal. Bd. X (Year) Heft Y . - pages.``
    Take everything up to the first volume / page marker."""
    s = after_in_text.strip().lstrip(".,; ")
    s = re.split(r"\s*\bBd\.\s*", s, maxsplit=1)[0]
    s = re.split(r"\s*\b(?:Heft|S\.|DOI:|ISSN|ISBN)\b", s, maxsplit=1)[0]
    s = s.strip(" .,;")
    return s or None


def _split_book_venue(rest: str) -> tuple[str | None, str | None, str | None, int | None]:
    """For a chapter: ``Booktitle. - Address : Publisher, Year [- S. pages] [- (Series)]``.
    Returns ``(booktitle, address, publisher, year)``."""
    booktitle = None
    address = None
    publisher = None
    year_out = None
    # Booktitle is up to the first ". -"
    parts = re.split(r"\s*\.\s*-\s*", rest, maxsplit=1)
    booktitle = parts[0].strip(" ,.;") or None
    if len(parts) > 1:
        venue = parts[1]
        m = PUBLISHER_RE.search(venue)
        if m:
            address = m.group(1).strip(" ,;")
            publisher = m.group(2).strip(" ,;")
            year_out = int(m.group(3))
    return booktitle, address, publisher, year_out


def _classify_type(
    *,
    em_in_present: bool,
    is_edited: bool,
    has_journal: bool,
    has_booktitle: bool,
    has_isbn: bool,
) -> str:
    if not em_in_present:
        return "edited_book" if is_edited else "book"
    if has_booktitle:
        return "chapter"
    if has_journal:
        return "article"
    return "misc"


# --------------------------------------------------------------------------- #
# ERef / EPub division snapshot (the "what's already in there" set)
# --------------------------------------------------------------------------- #


@dataclass
class RepoRecord:
    """Minimal projection of a repository BibTeX entry, just enough
    metadata to support the three reconciliation tiers."""

    eprint_id: str
    source: str
    eref_url: str | None
    epub_url: str | None
    doi: str | None
    title: str
    title_normalized: str
    year: int | None
    first_author_norm: str | None


def _bibtex_field(entry: dict[str, Any], key: str) -> str:
    raw = entry.get(key, "")
    if not isinstance(raw, str):
        return ""
    s = raw.strip()
    if s.startswith("{") and s.endswith("}"):
        s = s[1:-1].strip()
    s = _decode_latex_accents(s)
    for k, v in _LATEX_LITERALS.items():
        s = s.replace(k, v)
    return re.sub(r"\s+", " ", s).strip()


def _first_author_lastname(author_field: str) -> str | None:
    """Extract a normalized first-author surname from a BibTeX author /
    editor field. Handles both ``Last, First`` (the comma form) and
    ``First Middle Last`` (the space form) — bibtexparser preserves
    whichever the depositor used."""
    if not author_field:
        return None
    first = re.split(r"\s+and\s+", author_field, maxsplit=1)[0].strip()
    if "," in first:
        surname = first.split(",", 1)[0].strip()
    else:
        # "First Middle Last" — the last whitespace-separated token is
        # the surname for non-particle names. We don't bother with "von"
        # / "de la" particles; cluster data hasn't surfaced those.
        tokens = first.split()
        surname = tokens[-1] if tokens else ""
    if not surname:
        return None
    return re.sub(r"[^a-z0-9]+", "", _strip_accents(surname).lower()) or None


def _ep3_doi_lookup(xml_text: str) -> dict[str, str]:
    """Map EPrint ID → publisher / related DOI for fallback when the
    BibTeX export doesn't include one (common for chapters)."""
    out: dict[str, str] = {}
    root = ET.fromstring(xml_text)
    for ep in root.findall(".//ep:eprint", EP3_NS):
        eid_node = ep.find("ep:eprintid", EP3_NS)
        if eid_node is None or not eid_node.text:
            continue
        eid = eid_node.text.strip()
        for tag in ("ep:publisher_doi", "ep:related_doi"):
            node = ep.find(tag, EP3_NS)
            if node is not None and node.text:
                doi = node.text.strip()
                if doi.lower().startswith("doi:"):
                    doi = doi[4:].strip()
                if doi and not doi.lower().startswith("10.15495/epub_ubt_"):
                    out[eid] = doi
                    break
    return out


def load_repo_records(
    *,
    bibtex_url: str,
    xml_url: str,
    source_name: str,
    eprint_base: str,
    bib_key_pattern: re.Pattern[str],
    no_cache: bool,
) -> list[RepoRecord]:
    bibtex_text = fetch_with_cache(
        bibtex_url, f"{source_name}_division.bib", no_cache=no_cache
    )
    xml_text = fetch_with_cache(
        xml_url, f"{source_name}_division.xml", no_cache=no_cache
    )
    parser = BibTexParser(common_strings=True)
    parser.ignore_nonstandard_types = False
    parser.homogenize_fields = True
    db = bibtexparser.loads(bibtex_text, parser=parser)
    ep3_dois = _ep3_doi_lookup(xml_text)

    out: list[RepoRecord] = []
    for entry in db.entries:
        bib_key = entry.get("ID") or ""
        m = bib_key_pattern.match(bib_key)
        if not m:
            continue
        eprint_id = m.group(1)
        title = _bibtex_field(entry, "title")
        author = _bibtex_field(entry, "author") or _bibtex_field(entry, "editor")
        year_str = _bibtex_field(entry, "year")
        try:
            year = int(year_str[:4]) if year_str else None
        except ValueError:
            year = None
        # Resolve DOI: BibTeX field, else EP3 XML, else BibTeX url that
        # points at doi.org.
        doi_field = _bibtex_field(entry, "doi")
        if doi_field and doi_field.startswith("http"):
            doi_field = re.sub(r"^https?://(dx\.)?doi\.org/", "", doi_field)
        doi = doi_field or None
        if not doi:
            url = _bibtex_field(entry, "url")
            if url and "doi.org/" in url:
                doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", url)
        if not doi:
            doi = ep3_dois.get(eprint_id)
        permalink = f"{eprint_base}/{eprint_id}/"
        out.append(
            RepoRecord(
                eprint_id=eprint_id,
                source=source_name,
                eref_url=permalink if source_name == "eref" else None,
                epub_url=permalink if source_name == "epub" else None,
                doi=normalize_doi(doi),
                title=title,
                title_normalized=normalize_title(title),
                year=year,
                first_author_norm=_first_author_lastname(author),
            )
        )
    return out


# --------------------------------------------------------------------------- #
# Reconciliation
# --------------------------------------------------------------------------- #


@dataclass
class ReconResult:
    entry: ScrapedEntry
    decision: str  # 'skip-eref-link' | 'skip-epub-link' | 'skip-doi' | 'skip-fuzzy' | 'MISSING'
    matched_to: RepoRecord | None = None
    note: str = ""


def _scraped_first_author(entry: ScrapedEntry) -> str | None:
    """Same logic as ``_first_author_lastname`` but on a scraped author
    list (which we already split on ``;``)."""
    pool = entry.authors or entry.editors
    if not pool:
        return None
    first = pool[0].strip()
    if "," in first:
        surname = first.split(",", 1)[0].strip()
    else:
        tokens = first.split()
        surname = tokens[-1] if tokens else ""
    if not surname:
        return None
    return re.sub(r"[^a-z0-9]+", "", _strip_accents(surname).lower()) or None


def reconcile(
    entries: list[ScrapedEntry],
    eref_records: list[RepoRecord],
    epub_records: list[RepoRecord] | None,
) -> list[ReconResult]:
    eref_by_eref_url: dict[str, RepoRecord] = {
        r.eref_url: r for r in eref_records if r.eref_url
    }
    epub_by_epub_url: dict[str, RepoRecord] = {}
    if epub_records:
        epub_by_epub_url = {r.epub_url: r for r in epub_records if r.epub_url}
    candidate_pool: list[RepoRecord] = list(eref_records)
    if epub_records:
        candidate_pool.extend(epub_records)
    # DOI → list of records (multiple for book + chapters sharing a
    # publisher DOI); the safety guard below picks the right one.
    by_doi: dict[str, list[RepoRecord]] = {}
    for r in candidate_pool:
        if r.doi:
            by_doi.setdefault(r.doi, []).append(r)
    # Pre-compute title-token sets for the Jaccard fallback.
    repo_tokens: list[tuple[RepoRecord, set[str]]] = [
        (r, _title_tokens(r.title)) for r in candidate_pool
    ]

    results: list[ReconResult] = []
    for e in entries:
        # 1. ERef permalink in the scraped entry → already in ERef.
        if e.eref_url:
            match = eref_by_eref_url.get(e.eref_url)
            results.append(
                ReconResult(
                    entry=e,
                    decision="skip-eref-link",
                    matched_to=match,
                    note=f"ERef permalink {e.eref_url} present in cluster page",
                )
            )
            continue
        # 2. EPub permalink (only when --include-epub).
        if epub_records and e.epub_url:
            match = epub_by_epub_url.get(e.epub_url)
            if match:
                results.append(
                    ReconResult(
                        entry=e,
                        decision="skip-epub-link",
                        matched_to=match,
                        note=f"EPub permalink {e.epub_url} present in cluster page",
                    )
                )
                continue
        # 3. DOI exact match (try every record sharing this DOI; guard so
        #    a sibling chapter sharing a book DOI doesn't match the book).
        scraped_doi = normalize_doi(e.doi)
        if scraped_doi:
            candidates = by_doi.get(scraped_doi, [])
            if candidates:
                # If the DOI is unique across the repo it's a clean match
                # regardless of title/author drift on the cluster page.
                if len(candidates) == 1:
                    results.append(
                        ReconResult(
                            entry=e,
                            decision="skip-doi",
                            matched_to=candidates[0],
                            note=f"DOI match (unique): {scraped_doi}",
                        )
                    )
                    continue
                # Shared DOI: pick the candidate whose title or first
                # author best matches the cluster entry.
                best = _best_doi_candidate(e, candidates)
                if best is not None:
                    results.append(
                        ReconResult(
                            entry=e,
                            decision="skip-doi",
                            matched_to=best,
                            note=(
                                f"DOI match (shared, {len(candidates)} candidates): "
                                f"{scraped_doi}"
                            ),
                        )
                    )
                    continue
                # Otherwise fall through to fuzzy.
        # 4. Fuzzy: title-token Jaccard with three tiers, all of which
        #    require no first-author conflict where both sides know it.
        #    A: J ≥ 0.85 with no year requirement (catches entries whose
        #       year extraction picked up a stray 4-digit number on the
        #       cluster page).
        #    B: J ≥ 0.6  with year exact match (when both sides know).
        #    C: J ≥ 0.5  with year exact match AND first-author match
        #       on both sides — most conservative tier.
        scraped_tokens = _title_tokens(e.title)
        scraped_first = _scraped_first_author(e)
        best_score = 0.0
        best_record: RepoRecord | None = None
        for r, rtokens in repo_tokens:
            if not scraped_tokens or not rtokens:
                continue
            if (
                scraped_first
                and r.first_author_norm
                and scraped_first != r.first_author_norm
            ):
                continue
            score = _jaccard(scraped_tokens, rtokens)
            year_known_both = e.year is not None and r.year is not None
            year_match = year_known_both and e.year == r.year
            tier_a = score >= 0.85
            tier_b = score >= 0.6 and year_match
            tier_c = (
                score >= 0.5
                and year_match
                and scraped_first is not None
                and r.first_author_norm is not None
                and scraped_first == r.first_author_norm
            )
            if not (tier_a or tier_b or tier_c):
                continue
            if year_known_both and not year_match and score < 0.95:
                # Year mismatch is a strong negative signal unless the
                # title is essentially identical.
                continue
            if score > best_score:
                best_score = score
                best_record = r
        if best_record is not None:
            results.append(
                ReconResult(
                    entry=e,
                    decision="skip-fuzzy",
                    matched_to=best_record,
                    note=(
                        f"Fuzzy (Jaccard={best_score:.2f}): title='"
                        f"{best_record.title[:60]}' year={best_record.year} "
                        f"first-author={best_record.first_author_norm}"
                    ),
                )
            )
            continue
        results.append(
            ReconResult(
                entry=e,
                decision="MISSING",
                matched_to=None,
                note=_missing_note(e),
            )
        )
    return results


def _title_tokens(title: str) -> set[str]:
    """Bag of meaningful tokens after diacritic strip + lowercasing.
    Drops short stopwords so they don't inflate Jaccard scores."""
    if not title:
        return set()
    normalized = _strip_accents(title).lower()
    tokens = re.split(r"[^a-z0-9]+", normalized)
    return {t for t in tokens if len(t) >= 4 and t not in _TITLE_STOPWORDS}


_TITLE_STOPWORDS = frozenset(
    {
        "the",
        "and",
        "for",
        "with",
        "from",
        "into",
        "between",
        "through",
        "during",
        "across",
        "after",
        "about",
        "against",
        "their",
        "this",
        "that",
        "these",
        "those",
        "have",
        "been",
        "were",
        "where",
        "when",
        "what",
        "case",
        "study",
        "essay",
        "essays",
        "introduction",
    }
)


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = a & b
    union = a | b
    return len(inter) / len(union) if union else 0.0


def _best_doi_candidate(
    scraped: ScrapedEntry, candidates: list[RepoRecord]
) -> RepoRecord | None:
    """For a shared DOI, score each repo candidate against the scraped
    entry and return the best match — or None if none pass the floor."""
    scraped_first = _scraped_first_author(scraped)
    scraped_tokens = _title_tokens(scraped.title)
    best: RepoRecord | None = None
    best_score = 0.0
    for r in candidates:
        score = 0.0
        if scraped_first and r.first_author_norm and scraped_first == r.first_author_norm:
            score += 1.0
        if scraped_tokens and r.title:
            score += _jaccard(scraped_tokens, _title_tokens(r.title))
        if score > best_score:
            best_score = score
            best = r
    # Floor of 0.5 so a totally unrelated record sharing a book DOI
    # doesn't false-match.
    return best if best_score >= 0.5 else None


def _missing_note(e: ScrapedEntry) -> str:
    bits: list[str] = []
    if e.doi:
        bits.append(f"doi={e.doi}")
    if e.year:
        bits.append(f"year={e.year}")
    if e.authors or e.editors:
        first = (e.authors or e.editors)[0]
        bits.append(f"first={first}")
    return ", ".join(bits)


# --------------------------------------------------------------------------- #
# BibTeX / RIS rendering for the missing set
# --------------------------------------------------------------------------- #

BIBTEX_TYPE_BY_ENTRY_TYPE = {
    "article": "article",
    "chapter": "incollection",
    "book": "book",
    "edited_book": "book",
    "misc": "misc",
}

RIS_TYPE_BY_ENTRY_TYPE = {
    "article": "JOUR",
    "chapter": "CHAP",
    "book": "BOOK",
    "edited_book": "EDBOOK",
    "misc": "GEN",
}


def _bib_key(entry: ScrapedEntry, idx: int) -> str:
    pool = entry.authors or entry.editors
    surname = ""
    if pool:
        surname = pool[0].split(",", 1)[0].strip()
        surname = re.sub(r"[^A-Za-z0-9]+", "", _strip_accents(surname))
    surname = surname or "anon"
    year = entry.year or 0
    title_word = ""
    for w in re.split(r"\s+", entry.title or ""):
        cleaned = re.sub(r"[^A-Za-z0-9]+", "", _strip_accents(w))
        if len(cleaned) >= 4:
            title_word = cleaned.lower()
            break
    title_word = title_word or "untitled"
    return f"clusterweb_{surname}{year}_{title_word}_{idx}"


def render_missing_as_bibtex(missing: list[ScrapedEntry]) -> str:
    db = bibtexparser.bibdatabase.BibDatabase()
    entries: list[dict[str, Any]] = []
    for i, e in enumerate(missing):
        entry: dict[str, Any] = {
            "ENTRYTYPE": BIBTEX_TYPE_BY_ENTRY_TYPE.get(e.type, "misc"),
            "ID": _bib_key(e, i),
            "title": e.title,
        }
        if e.authors:
            entry["author"] = " and ".join(e.authors)
        if e.editors:
            entry["editor"] = " and ".join(e.editors)
        # For chapters, EPrint convention puts the volume editors in the
        # `editor` field; if we already have authors, the chapter editors
        # land in `editor` too — Zotero will route this to "Editor".
        if e.book_editors and not e.editors:
            entry["editor"] = " and ".join(e.book_editors)
        if e.year:
            entry["year"] = str(e.year)
        if e.journal:
            entry["journal"] = e.journal
        if e.booktitle:
            entry["booktitle"] = e.booktitle
        if e.volume:
            entry["volume"] = e.volume
        if e.issue:
            entry["number"] = e.issue
        if e.pages:
            entry["pages"] = e.pages
        if e.publisher:
            entry["publisher"] = e.publisher
        if e.address:
            entry["address"] = e.address
        if e.series:
            entry["series"] = e.series
        if e.doi:
            entry["doi"] = e.doi
        if e.isbn:
            entry["isbn"] = e.isbn
        if e.issn:
            entry["issn"] = e.issn
        if e.abstract:
            entry["abstract"] = e.abstract
        # url precedence: DOI > publisher external link > epub_url > eref_url
        url = None
        if e.doi:
            url = f"https://doi.org/{e.doi}"
        elif e.publisher_url:
            url = e.publisher_url
        elif e.epub_url:
            url = e.epub_url
        elif e.eref_url:
            url = e.eref_url
        if url:
            entry["url"] = url
        # Free-form note: keep the raw cluster-page citation alongside
        # the parsed fields so the cleanup pass can recover anything
        # the parser dropped or misclassified.
        note_lines = ["Imported from africamultiple.uni-bayreuth.de Recent Publications"]
        if e.raw_metadata:
            note_lines.append(f"Source citation: {e.raw_metadata}")
        if e.eref_url:
            note_lines.append(f"ERef: {e.eref_url}")
        if e.epub_url:
            note_lines.append(f"EPub: {e.epub_url}")
        entry["note"] = " | ".join(note_lines)
        entries.append(entry)
    db.entries = entries
    return bibtexparser.dumps(db).strip() + "\n"


def render_missing_as_ris(missing: list[ScrapedEntry]) -> str:
    lines: list[str] = []
    for e in missing:
        ty = RIS_TYPE_BY_ENTRY_TYPE.get(e.type, "GEN")
        lines.append(f"TY  - {ty}")
        if e.title:
            lines.append(f"TI  - {e.title}")
        for a in e.authors:
            lines.append(f"AU  - {a}")
        for ed in e.editors or e.book_editors:
            lines.append(f"ED  - {ed}")
        if e.year:
            lines.append(f"PY  - {e.year}")
        if e.journal:
            lines.append(f"JO  - {e.journal}")
        if e.booktitle:
            lines.append(f"T2  - {e.booktitle}")
        if e.volume:
            lines.append(f"VL  - {e.volume}")
        if e.issue:
            lines.append(f"IS  - {e.issue}")
        if e.pages:
            cleaned = e.pages.replace("--", "-")
            if "-" in cleaned:
                start, _, end = cleaned.partition("-")
                if start:
                    lines.append(f"SP  - {start.strip()}")
                if end:
                    lines.append(f"EP  - {end.strip()}")
            else:
                lines.append(f"SP  - {cleaned}")
        if e.publisher:
            lines.append(f"PB  - {e.publisher}")
        if e.address:
            lines.append(f"CY  - {e.address}")
        if e.doi:
            lines.append(f"DO  - {e.doi}")
        if e.isbn:
            lines.append(f"SN  - {e.isbn}")
        if e.issn and not e.isbn:
            lines.append(f"SN  - {e.issn}")
        if e.abstract:
            lines.append(f"AB  - {e.abstract}")
        if e.doi:
            lines.append(f"UR  - https://doi.org/{e.doi}")
        elif e.publisher_url:
            lines.append(f"UR  - {e.publisher_url}")
        lines.append("ER  - ")
        lines.append("")
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# Review TSV (one row per scraped entry, for spot-checking)
# --------------------------------------------------------------------------- #


def render_review_tsv(results: list[ReconResult]) -> str:
    header = (
        "decision\ttitle\tyear\ttype\tdoi\teref_url\tepub_url\tfirst_author\t"
        "matched_to_id\tmatched_to_title\tnote"
    )
    rows = [header]
    for r in results:
        e = r.entry
        first = (e.authors or e.editors)
        first_str = first[0] if first else ""
        m = r.matched_to
        rows.append(
            "\t".join(
                _tsv_safe(s)
                for s in [
                    r.decision,
                    e.title,
                    str(e.year or ""),
                    e.type,
                    e.doi or "",
                    e.eref_url or "",
                    e.epub_url or "",
                    first_str,
                    m.eprint_id if m else "",
                    m.title if m else "",
                    r.note,
                ]
            )
        )
    return "\n".join(rows) + "\n"


def _tsv_safe(s: str) -> str:
    return s.replace("\t", " ").replace("\n", " ").replace("\r", " ")


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    p.add_argument(
        "--include-epub",
        action="store_true",
        help=(
            "Also exclude items already in EPub Bayreuth division 340050. "
            "Default is ERef-only since the goal is to list items that need "
            "depositing in ERef."
        ),
    )
    p.add_argument(
        "--no-cache",
        action="store_true",
        help="Bypass the 24-hour disk cache for HTTP fetches.",
    )
    p.add_argument(
        "--out-dir",
        type=Path,
        default=OUT_DIR,
        help=f"Directory for output files (default: {OUT_DIR.relative_to(ROOT)})",
    )
    args = p.parse_args()
    out_dir: Path = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    print("Fetching cluster Recent Publications page...", flush=True)
    cluster_html = fetch_with_cache(
        CLUSTER_URL, "cluster_recent.html", no_cache=args.no_cache
    )

    print("Fetching ERef Bayreuth division 340050 (BibTeX + EP3 XML)...", flush=True)
    eref_records = load_repo_records(
        bibtex_url=EREF_DIVISION_BIBTEX,
        xml_url=EREF_DIVISION_XML,
        source_name="eref",
        eprint_base="https://eref.uni-bayreuth.de/id/eprint",
        bib_key_pattern=re.compile(r"ubt_eref(\d+)$"),
        no_cache=args.no_cache,
    )
    print(f"  {len(eref_records)} ERef records loaded", flush=True)

    epub_records: list[RepoRecord] | None = None
    if args.include_epub:
        print(
            "Fetching EPub Bayreuth division 340050 (BibTeX + EP3 XML)...", flush=True
        )
        epub_records = load_repo_records(
            bibtex_url=EPUB_DIVISION_BIBTEX,
            xml_url=EPUB_DIVISION_XML,
            source_name="epub",
            eprint_base="https://epub.uni-bayreuth.de/id/eprint",
            bib_key_pattern=re.compile(r"ubt_epub(\d+)$"),
            no_cache=args.no_cache,
        )
        print(f"  {len(epub_records)} EPub records loaded", flush=True)

    print("Parsing cluster website...", flush=True)
    entries = parse_cluster_page(cluster_html)
    print(f"  {len(entries)} entries scraped", flush=True)
    if len(entries) < MIN_EXPECTED_ENTRIES:
        print(
            f"  WARNING: scraped count {len(entries)} is below the markup canary "
            f"({MIN_EXPECTED_ENTRIES}). The TYPO3 page may have changed shape — "
            "please re-check the parser before trusting the output.",
            flush=True,
        )

    print("Reconciling...", flush=True)
    results = reconcile(entries, eref_records, epub_records)

    decisions: dict[str, int] = {}
    for r in results:
        decisions[r.decision] = decisions.get(r.decision, 0) + 1
    missing = [r.entry for r in results if r.decision == "MISSING"]

    bib = render_missing_as_bibtex(missing)
    ris = render_missing_as_ris(missing)
    tsv = render_review_tsv(results)

    bib_path = out_dir / "missing_publications.bib"
    ris_path = out_dir / "missing_publications.ris"
    tsv_path = out_dir / "missing_publications.review.tsv"
    bib_path.write_text(bib, encoding="utf-8")
    ris_path.write_text(ris, encoding="utf-8")
    tsv_path.write_text(tsv, encoding="utf-8")

    print(flush=True)
    print(f"Decisions: {decisions}", flush=True)
    print(f"Missing from ERef: {len(missing)} entries", flush=True)
    print(
        f"Wrote {bib_path.relative_to(ROOT)}, {ris_path.relative_to(ROOT)}, "
        f"{tsv_path.relative_to(ROOT)}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
