"""Fetch the cluster's publications from **ERef Bayreuth** (project view) and
**EPub Bayreuth** (Africa Multiple division view) and emit a normalized JSON
file at ``static/data/publications.json`` for the dashboard frontend.

Both sources expose the same EPrints 3 export endpoints — BibTeX bulk export
(canonical metadata), RSS feed (deposit dates → year/quarter buckets), and
EP3 XML (abstracts, structured keywords, GND IDs, related DOIs). After
fetching each independently, we deduplicate across sources: a paper that
exists in both repos becomes a single record carrying both ``eref_url`` and
``epub_url`` so the UI can offer a button per source.

Dedup keys, in priority order:

1. **DOI** (case-insensitive, normalized) — strongest signal.
2. **ISBN** (digits-only) — for books / chapters without a DOI.
3. **Fuzzy** (normalized title + publication year + first-author surname) —
   conservative fallback for items where neither ID is available.

When two records merge, ERef wins for canonical metadata (it has been the
cluster's primary archive throughout the EXC 2052 run) but EPub is used as
fallback for any field ERef leaves empty, and keywords are unioned.

Author strings are matched against the existing persons store at
``static/data/dev/dev.persons.json`` so the dashboard can link to person pages.
"""

from __future__ import annotations

import io
import json
import re
import sys
import unicodedata
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

import bibtexparser
import requests
from bibtexparser.bparser import BibTexParser

# Force UTF-8 stdout so e.g. accented author names print on Windows consoles.
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
PERSONS_PATH = ROOT / "static" / "data" / "dev" / "dev.persons.json"
OUT_PATH = ROOT / "static" / "data" / "publications.json"

EP3_NS = {"ep": "http://eprints.org/ep2/data/2.0"}

# EPub mints its own DOIs under this prefix (10.15495/EPub_UBT_<eprintid>).
# Useful as a stable repo-internal identifier but not the publication's DOI,
# so we skip it when extracting DOIs from EP3 XML.
EPUB_INTERNAL_DOI_PREFIX = "10.15495/epub_ubt_"

# Map ERef's source-of-truth type to the frontend taxonomy. We prefer the
# EP3 XML ``<type>`` over the BibTeX ``ENTRYTYPE`` because BibTeX collapses
# many distinct categories (working papers, theses, periodical parts,
# reviews, online publications…) under ``@misc`` — leaving the UI with a
# giant ``other`` bucket.
EP3_TYPE_MAP = {
    "article": "article",
    "book": "book",
    "book_section": "chapter",
    "conference_item": "conference",
    "thesis": "thesis",
    "working_paper": "working_paper",
    "periodical_part": "periodical",
    "review": "review",
    "online": "online",
    "monograph": "report",
    "patent": "patent",
    "other": "other",
}

# Fallback for the rare entry where EP3 XML is missing — keep the BibTeX
# coverage we had before so we never silently drop a record.
BIBTEX_TYPE_MAP = {
    "article": "article",
    "book": "book",
    "incollection": "chapter",
    "inbook": "chapter",
    "inproceedings": "conference",
    "proceedings": "conference",
    "phdthesis": "thesis",
    "mastersthesis": "thesis",
    "misc": "other",
    "techreport": "report",
    "unpublished": "other",
}


# --------------------------------------------------------------------------- #
# Source configuration
# --------------------------------------------------------------------------- #

EREF_PROJEKT_ID = "EXC_2052=3A_Africa_Multiple=3A_Reconfiguring_African_Studies"
EREF_EXPORT_BASE = "https://eref.uni-bayreuth.de/cgi/exportview/projekt"
EPUB_DIVISION_ID = "340050"  # "Africa Multiple: Reconfiguring African Studies"
EPUB_EXPORT_BASE = "https://epub.uni-bayreuth.de/cgi/exportview/divisions"


@dataclass(frozen=True)
class SourceConfig:
    """One EPrints repository + scope. Both ERef (projekt view) and EPub
    (division view) speak the same export protocol; only the URLs and the
    BibTeX key prefix change."""

    name: str  # 'eref' | 'epub'
    label: str  # Human-readable name used in logs and JSON metadata.
    bibtex_url: str
    rss_url: str
    ep3_xml_url: str
    eprint_base: str  # `https://<host>/id/eprint` — used to build per-record URL.
    per_eprint_bibtex_template: str  # Per-record BibTeX export — accepts `{id}`.
    bib_key_pattern: re.Pattern  # Extracts the numeric ID from a BibTeX entry key.


EREF_SOURCE = SourceConfig(
    name="eref",
    label="ERef Bayreuth",
    bibtex_url=f"{EREF_EXPORT_BASE}/{EREF_PROJEKT_ID}/BibTeX/{EREF_PROJEKT_ID}.bib",
    rss_url=f"{EREF_EXPORT_BASE}/{EREF_PROJEKT_ID}/RSS2/{EREF_PROJEKT_ID}.xml",
    ep3_xml_url=f"{EREF_EXPORT_BASE}/{EREF_PROJEKT_ID}/XML/{EREF_PROJEKT_ID}.xml",
    eprint_base="https://eref.uni-bayreuth.de/id/eprint",
    per_eprint_bibtex_template=(
        "https://eref.uni-bayreuth.de/cgi/export/eprint/{id}/BibTeX/ubt_eref-eprint-{id}.bib"
    ),
    bib_key_pattern=re.compile(r"ubt_eref(\d+)$"),
)

EPUB_SOURCE = SourceConfig(
    name="epub",
    label="EPub Bayreuth",
    bibtex_url=f"{EPUB_EXPORT_BASE}/{EPUB_DIVISION_ID}/BibTeX/{EPUB_DIVISION_ID}.bib",
    rss_url=f"{EPUB_EXPORT_BASE}/{EPUB_DIVISION_ID}/RSS2/{EPUB_DIVISION_ID}.xml",
    ep3_xml_url=f"{EPUB_EXPORT_BASE}/{EPUB_DIVISION_ID}/XML/{EPUB_DIVISION_ID}.xml",
    eprint_base="https://epub.uni-bayreuth.de/id/eprint",
    per_eprint_bibtex_template=(
        "https://epub.uni-bayreuth.de/cgi/export/eprint/{id}/BibTeX/ubt_epub-eprint-{id}.bib"
    ),
    bib_key_pattern=re.compile(r"ubt_epub(\d+)$"),
)

# Source priority for canonical-field selection during merge. ERef has been
# the cluster's primary archive since EXC 2052's launch; EPub coverage is
# narrower and Bayreuth-only. So when both have a non-empty value, take ERef.
SOURCE_PRIORITY = ("eref", "epub")


# --------------------------------------------------------------------------- #
# Data classes
# --------------------------------------------------------------------------- #


@dataclass
class Author:
    raw: str
    normalized: str
    person_id: str | None = None
    person_name: str | None = None


@dataclass
class Publication:
    id: str  # Composite ID like ``eref-96022`` or ``epub-8670`` — unique across sources.
    source: str  # Primary source: ``eref`` | ``epub`` (after merge: source whose ID we kept).
    sources: list[str]  # All sources this record was found in (post-merge: 1 or 2 entries).
    type: str
    raw_type: str
    title: str
    year: int | None
    quarter: int | None
    deposited_at: str | None
    authors: list[Author] = field(default_factory=list)
    editors: list[Author] = field(default_factory=list)
    book_editors: list[Author] = field(default_factory=list)
    journal: str | None = None
    booktitle: str | None = None
    volume: str | None = None
    issue: str | None = None
    pages: str | None = None
    publisher: str | None = None
    address: str | None = None
    doi: str | None = None
    isbn: str | None = None
    issn: str | None = None
    keywords: list[str] = field(default_factory=list)
    abstract: str | None = None
    language: str | None = None
    url: str | None = None
    eref_url: str | None = None
    epub_url: str | None = None
    bibtex_url: str | None = None
    bibtex_raw: str | None = None


# --------------------------------------------------------------------------- #
# Person matching
# --------------------------------------------------------------------------- #


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def normalize_name(name: str) -> str:
    """Reduce a name to a comparable key: lowercase, accent-stripped, single-spaced."""
    n = _strip_accents(name).lower()
    n = re.sub(r"[\.’']", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def to_last_first(raw: str) -> str:
    """Coerce ``First Last`` → ``Last, First`` so it matches the persons store
    convention. Leaves already-comma'd strings alone. Single-token names pass
    through unchanged."""
    s = raw.strip()
    if "," in s:
        return s
    parts = s.split()
    if len(parts) < 2:
        return s
    return f"{parts[-1]}, {' '.join(parts[:-1])}"


def load_persons() -> list[dict[str, Any]]:
    if not PERSONS_PATH.exists():
        return []
    with PERSONS_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


def build_person_index(persons: list[dict[str, Any]]) -> dict[str, dict[str, dict[str, str]]]:
    """Index persons by normalized full name and by ``last, initial.`` so we
    can fall back to a softer match when first names differ in expansion (e.g.
    ``Stefan`` vs ``S.``)."""
    by_full: dict[str, dict[str, str]] = {}
    by_last_initial: dict[str, dict[str, str]] = {}
    for p in persons:
        name = p.get("name")
        oid = p.get("_id")
        # MongoDB Extended JSON: {"$oid": "..."}; fall back to plain string ids.
        pid = oid.get("$oid") if isinstance(oid, dict) else oid
        if not name or not pid:
            continue
        key = normalize_name(name)
        by_full[key] = {"id": str(pid), "name": name}
        if "," in name:
            last, _, first = name.partition(",")
            first = first.strip()
            if last and first:
                initial_key = normalize_name(f"{last}, {first[0]}")
                # First match wins to keep results deterministic.
                by_last_initial.setdefault(initial_key, {"id": str(pid), "name": name})
    return {"full": by_full, "last_initial": by_last_initial}


def match_author(raw: str, index: dict[str, dict[str, dict[str, str]]]) -> Author:
    coerced = to_last_first(raw)
    key = normalize_name(coerced)
    full = index["full"].get(key)
    if full:
        return Author(raw=raw, normalized=coerced, person_id=full["id"], person_name=full["name"])
    if "," in coerced:
        last, _, first = coerced.partition(",")
        first = first.strip()
        if first:
            initial_key = normalize_name(f"{last}, {first[0]}")
            li = index["last_initial"].get(initial_key)
            if li:
                return Author(
                    raw=raw, normalized=coerced, person_id=li["id"], person_name=li["name"]
                )
    return Author(raw=raw, normalized=coerced)


# --------------------------------------------------------------------------- #
# BibTeX parsing
# --------------------------------------------------------------------------- #


def fetch_text(url: str) -> str:
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    response.encoding = response.apparent_encoding or "utf-8"
    return response.text


def split_bibtex_authors(field_value: str) -> list[str]:
    """BibTeX joins authors with `` and ``. Ignores escaped braces; ERef does
    not embed nested ``and`` keywords inside surnames in practice."""
    if not field_value:
        return []
    parts = re.split(r"\s+and\s+", field_value)
    return [p.strip() for p in parts if p.strip()]


# Two-step LaTeX accent table. Step 1 maps a single accent command + base
# letter to the precomposed Unicode character (`\"u` → `ü`). Step 2 maps the
# remaining symbol commands (`\ss` → `ß`, `\textendash` → `–`).
_ACCENT_COMBINING = {
    '"': "̈",  # diaeresis
    "'": "́",  # acute
    "`": "̀",  # grave
    "^": "̂",  # circumflex
    "~": "̃",  # tilde
    "=": "̄",  # macron above
    ".": "̇",  # dot above
    "c": "̧",  # cedilla
    "v": "̌",  # caron
    "H": "̋",  # double acute
    "u": "̆",  # breve
    "r": "̊",  # ring above
    "k": "̨",  # ogonek
    "d": "̣",  # dot below (Yoruba O-dot, etc.)
    "b": "̱",  # macron below / bar below
    "t": "͡",  # double inverted breve / tie
}

_LATEX_LITERALS = {
    r"\&": "&",
    r"\%": "%",
    r"\_": "_",
    r"\$": "$",
    r"\#": "#",
    r"\textendash{}": "–",
    r"\textendash": "–",
    r"\textemdash{}": "—",
    r"\textemdash": "—",
    r"\ss{}": "ß",
    r"\ss": "ß",
    r"\AE": "Æ",
    r"\ae": "æ",
    r"\OE": "Œ",
    r"\oe": "œ",
    r"\O": "Ø",
    r"\o": "ø",
    r"\AA": "Å",
    r"\aa": "å",
    r"\L": "Ł",
    r"\l": "ł",
    r"\dh": "ð",
    r"\DH": "Ð",
    r"\th": "þ",
    r"\TH": "Þ",
    "--": "–",
}


def _decode_latex_accents(s: str) -> str:
    """Decode LaTeX accent commands of the form ``{\\Xy}``, ``\\X{y}``, and
    bare ``\\Xy`` (e.g. ``\\"u``, ``\\cc``) to the corresponding precomposed
    Unicode character. Runs before generic brace stripping so the accent
    itself is consumed rather than left as a stray symbol.

    Letter-prefix accents (``\\c``, ``\\v``, ``\\u``…) are accepted in their
    bare form ``\\Xy`` only when not followed by another letter — otherwise
    we would mangle longer LaTeX commands like ``\\centering`` or
    ``\\caption``. In ERef the letter-prefix variants always appear as
    exactly three characters (``\\cc``, ``\\dO``, ``\\vs``)."""

    def replace_match(match: re.Match[str]) -> str:
        cmd, letter = match.group(1), match.group(2)
        combining = _ACCENT_COMBINING.get(cmd)
        if combining is None:
            return match.group(0)
        return unicodedata.normalize("NFC", letter + combining)

    pattern_braced = re.compile(r"\{\\([\"'`^~=.cvHurkbdt])\s*\{?([A-Za-z])\}?\}")
    s = pattern_braced.sub(replace_match, s)
    pattern_unbraced = re.compile(r"\\([\"'`^~=.cvHurkbdt])\{([A-Za-z])\}")
    s = pattern_unbraced.sub(replace_match, s)
    pattern_bare_punct = re.compile(r"\\([\"'`^~=.])\s*([A-Za-z])")
    s = pattern_bare_punct.sub(replace_match, s)
    pattern_bare_letter = re.compile(r"\\([cvHurkbdt])([A-Za-z])(?![A-Za-z])")
    s = pattern_bare_letter.sub(replace_match, s)
    return s


def normalize_bibtex_value(value: str) -> str:
    """Strip the outer braces left by bibtexparser preserve, decode LaTeX
    accent commands, and unescape a handful of common LaTeX-isms that show up
    in the upstream data."""
    if value is None:
        return ""
    s = value.strip()
    # Hard-strip the wrapping braces left over from `homogenize_latex_encoding`.
    if s.startswith("{") and s.endswith("}"):
        s = s[1:-1].strip()
    s = _decode_latex_accents(s)
    for k, v in _LATEX_LITERALS.items():
        s = s.replace(k, v)
    s = re.sub(r"\{([^{}]*)\}", r"\1", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def derive_quarter(month: int) -> int:
    return (month - 1) // 3 + 1


def parse_ep3_xml(xml_text: str) -> dict[str, dict[str, Any]]:
    """Extract per-eprint enrichment fields the BibTeX export drops:
    ``abstract``, refined ``keywords``, ``gnd_ids``, ``language``, the
    EP3 ``<type>``, ``official_url``, and any DOI surfaced via
    ``<related_doi>`` or ``<publisher_doi>``.

    EPub uses ``<related_doi>`` to advertise its repo-internal DOI
    (``10.15495/EPub_UBT_<eprintid>``) and ``<publisher_doi>`` for the actual
    publisher's DOI. ERef uses ``<related_doi>`` for the publisher's DOI and
    has no ``<publisher_doi>`` field. We prefer ``<publisher_doi>`` when
    present and reject the EPub-internal prefix from ``<related_doi>`` so the
    same code path works for both repos."""
    out: dict[str, dict[str, Any]] = {}
    root = ET.fromstring(xml_text)
    for ep in root.findall(".//ep:eprint", EP3_NS):
        eid_node = ep.find("ep:eprintid", EP3_NS)
        if eid_node is None or not eid_node.text:
            continue
        eprint_id = eid_node.text.strip()
        record: dict[str, Any] = {}

        # Abstract: prefer English when EP3 carries a multilingual block.
        abstract_node = ep.find("ep:abstract_original", EP3_NS)
        if abstract_node is not None:
            text_nodes = abstract_node.findall("ep:text", EP3_NS)
            lang_nodes = abstract_node.findall("ep:lang", EP3_NS)
            chosen: str | None = None
            for i, tn in enumerate(text_nodes):
                if tn.text is None:
                    continue
                lang = (
                    lang_nodes[i].text.strip().lower()
                    if i < len(lang_nodes) and lang_nodes[i].text
                    else ""
                )
                if lang.startswith("en") and tn.text.strip():
                    chosen = tn.text.strip()
                    break
            if chosen is None:
                for tn in text_nodes:
                    if tn.text and tn.text.strip():
                        chosen = tn.text.strip()
                        break
            if chosen is None and abstract_node.text and abstract_node.text.strip():
                chosen = abstract_node.text.strip()
            if chosen:
                record["abstract"] = re.sub(r"\s+", " ", chosen)

        keywords_node = ep.find("ep:keywords", EP3_NS)
        if keywords_node is not None and keywords_node.text:
            kws = re.split(r";|,", keywords_node.text)
            cleaned = [k.strip() for k in kws if k.strip()]
            if cleaned:
                record["keywords"] = cleaned

        type_node = ep.find("ep:type", EP3_NS)
        if type_node is not None and type_node.text:
            record["type"] = type_node.text.strip().lower()

        official = ep.find("ep:official_url", EP3_NS)
        if official is not None and official.text:
            record["official_url"] = official.text.strip()

        lang_node = ep.find("ep:language", EP3_NS)
        if lang_node is not None and lang_node.text:
            lang = lang_node.text.strip().lower()
            if lang and lang != "und":
                record["language"] = lang

        # DOI lookup with EPub-aware preference. publisher_doi is always the
        # publisher's; related_doi can be the publisher's (ERef) or the
        # repo-internal one (EPub) — discriminate by prefix.
        publisher_doi = ep.find("ep:publisher_doi", EP3_NS)
        related_doi = ep.find("ep:related_doi", EP3_NS)
        candidates: list[str] = []
        for node in (publisher_doi, related_doi):
            if node is not None and node.text:
                doi = node.text.strip()
                if doi.lower().startswith("doi:"):
                    doi = doi[4:].strip()
                if doi and not doi.lower().startswith(EPUB_INTERNAL_DOI_PREFIX):
                    candidates.append(doi)
        if candidates:
            record["doi"] = candidates[0]

        gnd_ids: dict[str, str] = {}
        for kind in ("creators", "editors"):
            container = ep.find(f"ep:{kind}", EP3_NS)
            if container is None:
                continue
            for item in container.findall("ep:item", EP3_NS):
                name_node = item.find("ep:name", EP3_NS)
                gnd_node = item.find("ep:gndid", EP3_NS)
                if name_node is None or gnd_node is None or not gnd_node.text:
                    continue
                family = name_node.find("ep:family", EP3_NS)
                given = name_node.find("ep:given", EP3_NS)
                key = (
                    f"{(family.text or '').strip()}|{(given.text or '').strip()}"
                    if family is not None or given is not None
                    else ""
                )
                if key:
                    gnd_ids[key] = gnd_node.text.strip()
        if gnd_ids:
            record["gnd_ids"] = gnd_ids

        book_editors_node = ep.find("ep:book_editors", EP3_NS)
        if book_editors_node is not None:
            names: list[str] = []
            for item in book_editors_node.findall("ep:item", EP3_NS):
                family = item.find("ep:family", EP3_NS)
                given = item.find("ep:given", EP3_NS)
                fam = (family.text or "").strip() if family is not None else ""
                giv = (given.text or "").strip() if given is not None else ""
                if fam and giv:
                    names.append(f"{fam}, {giv}")
                elif fam:
                    names.append(fam)
                elif giv:
                    names.append(giv)
            if names:
                record["book_editors"] = names

        if record:
            out[eprint_id] = record
    return out


def parse_rss_dates(xml_text: str) -> dict[str, dict[str, Any]]:
    """Map eprint ID → ``{deposited_at, year, quarter}`` from the RSS feed."""
    out: dict[str, dict[str, Any]] = {}
    root = ET.fromstring(xml_text)
    for item in root.iter("item"):
        link = (item.findtext("link") or "").strip()
        match = re.search(r"/eprint/(\d+)", link)
        if not match:
            continue
        eprint_id = match.group(1)
        pub_date_raw = (item.findtext("pubDate") or "").strip()
        if not pub_date_raw:
            continue
        try:
            dt = parsedate_to_datetime(pub_date_raw)
        except (TypeError, ValueError):
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        out[eprint_id] = {
            "deposited_at": dt.astimezone(timezone.utc).isoformat(),
            "deposit_year": dt.year,
            "quarter": derive_quarter(dt.month),
        }
    return out


def eprint_id_from_bib_key(key: str, source: SourceConfig) -> str | None:
    """Match against the source's expected key shape (``ubt_eref<n>`` or
    ``ubt_epub<n>``). Returning None when the prefix is wrong is what lets us
    safely cross-load: if a future export bundles entries from both repos
    into one file, we'll still partition them by source correctly."""
    match = source.bib_key_pattern.match(key or "")
    return match.group(1) if match else None


def render_bibtex_entry(entry: dict[str, Any]) -> str:
    """Re-emit a single bibtexparser entry as a stand-alone .bib string with
    LaTeX accent commands decoded to UTF-8 (e.g. ``M{\\"u}nchen`` →
    ``München``).

    We keep the raw entry around so the frontend's per-item Zotero export
    can serve it directly without round-tripping back to the upstream repo.
    Modern Zotero, biber, and biblatex all consume UTF-8 BibTeX without
    issue, and the resulting file is far more readable than the
    LaTeX-escaped upstream version. The structural BibTeX escapes (``\\%``,
    ``\\&``) are preserved so the file still validates."""
    cleaned: dict[str, Any] = {}
    for key, value in entry.items():
        if key in ("ENTRYTYPE", "ID"):
            cleaned[key] = value
        elif isinstance(value, str):
            decoded = _decode_latex_accents(value)
            for k, v in _LATEX_LITERALS.items():
                if k in (r"\&", r"\%", r"\_", r"\$", r"\#"):
                    continue
                decoded = decoded.replace(k, v)
            cleaned[key] = decoded
        else:
            cleaned[key] = value
    db = bibtexparser.bibdatabase.BibDatabase()
    db.entries = [cleaned]
    return bibtexparser.dumps(db).strip() + "\n"


def parse_bibtex(text: str) -> list[dict[str, Any]]:
    parser = BibTexParser(common_strings=True)
    parser.ignore_nonstandard_types = False
    parser.homogenize_fields = True
    db = bibtexparser.loads(text, parser=parser)
    return db.entries


# --------------------------------------------------------------------------- #
# Per-source build
# --------------------------------------------------------------------------- #


def build_publications_for_source(
    source: SourceConfig,
    bibtex_entries: list[dict[str, Any]],
    rss_dates: dict[str, dict[str, Any]],
    ep3_data: dict[str, dict[str, Any]],
    person_index: dict[str, dict[str, dict[str, str]]],
) -> list[Publication]:
    pubs: list[Publication] = []
    for entry in bibtex_entries:
        bib_key = entry.get("ID") or ""
        eprint_id = eprint_id_from_bib_key(bib_key, source)
        if not eprint_id:
            continue

        ep3_record = ep3_data.get(eprint_id, {})

        # Type: prefer EP3 (richer taxonomy); fall back to BibTeX.
        ep3_type = ep3_record.get("type")
        bibtex_type = (entry.get("ENTRYTYPE") or "misc").lower()
        if ep3_type:
            raw_type = ep3_type
            norm_type = EP3_TYPE_MAP.get(ep3_type, ep3_type)
        else:
            raw_type = bibtex_type
            norm_type = BIBTEX_TYPE_MAP.get(bibtex_type, bibtex_type)

        title = normalize_bibtex_value(entry.get("title", ""))
        year_raw = normalize_bibtex_value(entry.get("year", ""))
        year: int | None = None
        try:
            year = int(year_raw[:4]) if year_raw else None
        except ValueError:
            year = None

        rss_meta = rss_dates.get(eprint_id, {})
        deposited_at = rss_meta.get("deposited_at")
        quarter = rss_meta.get("quarter")

        authors = [
            match_author(a, person_index)
            for a in split_bibtex_authors(normalize_bibtex_value(entry.get("author", "")))
        ]
        editors = [
            match_author(e, person_index)
            for e in split_bibtex_authors(normalize_bibtex_value(entry.get("editor", "")))
        ]

        permalink = f"{source.eprint_base}/{eprint_id}/"
        bibtex_field_url = normalize_bibtex_value(entry.get("url", "")) or None
        doi_raw = normalize_bibtex_value(entry.get("doi", "")) or None
        if doi_raw and doi_raw.startswith("http"):
            doi_url: str | None = doi_raw
            doi_clean = re.sub(r"^https?://(dx\.)?doi\.org/", "", doi_raw)
        elif doi_raw:
            doi_url = f"https://doi.org/{doi_raw}"
            doi_clean = doi_raw
        else:
            doi_url = None
            doi_clean = None

        # Fall back to EP3 XML's DOI when BibTeX lacks one (common for
        # `@incollection` records and most EPub items).
        if not doi_clean:
            ep3_doi = ep3_record.get("doi")
            if ep3_doi:
                doi_clean = ep3_doi
                doi_url = f"https://doi.org/{ep3_doi}"
            elif bibtex_field_url and "doi.org/" in bibtex_field_url:
                doi_url = bibtex_field_url
                doi_clean = re.sub(r"^https?://(dx\.)?doi\.org/", "", bibtex_field_url)

        canonical_url = doi_url or bibtex_field_url or permalink

        ep3_keywords = ep3_record.get("keywords") or []
        if ep3_keywords:
            keywords = ep3_keywords
        else:
            keywords_raw = normalize_bibtex_value(
                entry.get("keywords") or entry.get("keyword") or ""
            )
            keywords = (
                [k.strip() for k in re.split(r";|,", keywords_raw) if k.strip()]
                if keywords_raw
                else []
            )

        abstract = ep3_record.get("abstract") or None
        book_editors = [
            match_author(name, person_index) for name in ep3_record.get("book_editors", [])
        ]

        pubs.append(
            Publication(
                id=f"{source.name}-{eprint_id}",
                source=source.name,
                sources=[source.name],
                type=norm_type,
                raw_type=raw_type,
                title=title,
                year=year,
                quarter=quarter,
                deposited_at=deposited_at,
                authors=authors,
                editors=editors,
                book_editors=book_editors,
                journal=normalize_bibtex_value(entry.get("journal", "")) or None,
                booktitle=normalize_bibtex_value(entry.get("booktitle", "")) or None,
                volume=normalize_bibtex_value(entry.get("volume", "")) or None,
                issue=normalize_bibtex_value(entry.get("number", "")) or None,
                pages=normalize_bibtex_value(entry.get("pages", "")) or None,
                publisher=normalize_bibtex_value(entry.get("publisher", "")) or None,
                address=normalize_bibtex_value(entry.get("address", "")) or None,
                doi=doi_clean,
                isbn=normalize_bibtex_value(entry.get("isbn", "")) or None,
                issn=normalize_bibtex_value(entry.get("issn", "")) or None,
                keywords=keywords,
                abstract=abstract,
                language=ep3_record.get("language"),
                url=canonical_url,
                eref_url=permalink if source.name == "eref" else None,
                epub_url=permalink if source.name == "epub" else None,
                bibtex_url=source.per_eprint_bibtex_template.format(id=eprint_id),
                bibtex_raw=render_bibtex_entry(entry),
            )
        )
    return pubs


def fetch_and_build(
    source: SourceConfig,
    person_index: dict[str, dict[str, dict[str, str]]],
) -> list[Publication]:
    """End-to-end pipeline for one source: fetch all three exports, parse,
    enrich, and emit a list of Publications. Failures are not swallowed —
    if a feed is down the run aborts so we don't silently ship a partial
    dataset."""
    print(f"  [{source.label}] Fetching BibTeX bulk export...", flush=True)
    bibtex_text = fetch_text(source.bibtex_url)
    print(f"  [{source.label}]   {len(bibtex_text):,} chars", flush=True)

    print(f"  [{source.label}] Fetching RSS feed for deposit dates...", flush=True)
    rss_text = fetch_text(source.rss_url)

    print(f"  [{source.label}] Fetching EP3 XML for abstracts + keywords...", flush=True)
    ep3_text = fetch_text(source.ep3_xml_url)
    print(f"  [{source.label}]   {len(ep3_text):,} chars", flush=True)

    print(f"  [{source.label}] Parsing BibTeX...", flush=True)
    bibtex_entries = parse_bibtex(bibtex_text)
    print(f"  [{source.label}]   {len(bibtex_entries)} entries", flush=True)

    print(f"  [{source.label}] Parsing RSS dates...", flush=True)
    rss_dates = parse_rss_dates(rss_text)
    print(f"  [{source.label}]   {len(rss_dates)} dated entries", flush=True)

    print(f"  [{source.label}] Parsing EP3 XML enrichment...", flush=True)
    ep3_data = parse_ep3_xml(ep3_text)
    abstracts_n = sum(1 for v in ep3_data.values() if v.get("abstract"))
    keywords_n = sum(1 for v in ep3_data.values() if v.get("keywords"))
    print(
        f"  [{source.label}]   {abstracts_n} abstracts, {keywords_n} keyword sets",
        flush=True,
    )

    pubs = build_publications_for_source(
        source, bibtex_entries, rss_dates, ep3_data, person_index
    )
    print(f"  [{source.label}] Built {len(pubs)} publications", flush=True)
    return pubs


# --------------------------------------------------------------------------- #
# Cross-source deduplication
# --------------------------------------------------------------------------- #


def normalize_doi(doi: str | None) -> str | None:
    if not doi:
        return None
    s = doi.strip().lower()
    s = re.sub(r"^https?://(dx\.)?doi\.org/", "", s)
    return s or None


def normalize_isbn(isbn: str | None) -> str | None:
    if not isbn:
        return None
    digits = re.sub(r"[^0-9Xx]", "", isbn)
    return digits.upper() or None


_NON_ALPHANUM = re.compile(r"[^a-z0-9]+")


def normalize_title(title: str) -> str:
    """Strip diacritics, lowercase, drop punctuation/whitespace, and collapse
    sub-titles after the first colon. Matches "Foo: bar" and "Foo : Bar"
    against each other but keeps "Foo bar" distinct from "Foo bar baz"."""
    t = _strip_accents(title or "").lower()
    # Drop subtitle — sources sometimes disagree on its punctuation.
    t = t.split(":", 1)[0]
    t = _NON_ALPHANUM.sub("", t)
    return t


def first_author_lastname(pub: Publication) -> str | None:
    """First-author surname for fuzzy matching. We use the normalized form
    so e.g. ``Müller`` and ``Mueller`` aren't matched together (sources are
    consistent within themselves; cross-source spelling drift would already
    fail the title check)."""
    pool = pub.authors or pub.editors
    if not pool:
        return None
    name = pool[0].normalized or pool[0].raw
    if not name:
        return None
    surname = name.split(",", 1)[0].strip()
    return _NON_ALPHANUM.sub("", _strip_accents(surname).lower()) or None


def find_duplicate_index(
    primary: list[Publication],
    candidate: Publication,
) -> int | None:
    """Return the index of a primary publication that matches ``candidate``,
    or None for no match. Three-tier check, most specific first.

    DOI matches require *either* a matching first-author surname *or* a
    matching normalized title — guards against the Routledge / Springer
    pattern where every chapter of a book carries the parent's DOI, which
    would otherwise let two sibling chapters with the same DOI merge into
    one record.

    ISBN matches are only honored for books / periodicals — chapters share
    their parent's ISBN by definition.

    Fuzzy matches require all three of: title (normalized to alphanumerics
    with subtitle stripped), publication year, and first-author surname.
    Year is exact and surname is normalized; title comparison is forgiving
    of subtitle / punctuation drift between sources."""
    cand_doi = normalize_doi(candidate.doi)
    cand_isbn = normalize_isbn(candidate.isbn)
    cand_title = normalize_title(candidate.title)
    cand_year = candidate.year
    cand_first_author = first_author_lastname(candidate)
    cand_type = candidate.type

    for i, p in enumerate(primary):
        if cand_doi and normalize_doi(p.doi) == cand_doi:
            primary_first_author = first_author_lastname(p)
            primary_title = normalize_title(p.title)
            same_author = bool(
                cand_first_author
                and primary_first_author
                and cand_first_author == primary_first_author
            )
            same_title = bool(cand_title and primary_title and cand_title == primary_title)
            if same_author or same_title:
                return i
            # Same DOI but different author *and* different title — likely
            # parent / sibling chapter sharing a book DOI. Don't merge.
            continue
        if cand_isbn and normalize_isbn(p.isbn) == cand_isbn:
            if cand_type == p.type and cand_type in {"book", "periodical"}:
                return i
        if (
            cand_title
            and cand_year is not None
            and cand_first_author
            and cand_title == normalize_title(p.title)
            and cand_year == p.year
            and cand_first_author == first_author_lastname(p)
        ):
            return i
    return None


def merge_publications(primary: Publication, secondary: Publication) -> Publication:
    """Fold ``secondary`` into ``primary``. Primary wins for canonical fields
    where both have a value; secondary fills gaps. Keywords are unioned.
    Both source URLs are preserved.

    No fancy merging for authors/editors/book_editors — the duplicate match
    has already proven the contributor lists describe the same paper, and
    primary's matched person IDs are the ones we want to keep (it's the
    source we trust more)."""
    merged = Publication(
        id=primary.id,
        source=primary.source,
        sources=sorted(set(primary.sources) | set(secondary.sources)),
        type=primary.type,
        raw_type=primary.raw_type,
        title=primary.title or secondary.title,
        year=primary.year if primary.year is not None else secondary.year,
        quarter=primary.quarter if primary.quarter is not None else secondary.quarter,
        deposited_at=primary.deposited_at or secondary.deposited_at,
        authors=primary.authors or secondary.authors,
        editors=primary.editors or secondary.editors,
        book_editors=primary.book_editors or secondary.book_editors,
        journal=primary.journal or secondary.journal,
        booktitle=primary.booktitle or secondary.booktitle,
        volume=primary.volume or secondary.volume,
        issue=primary.issue or secondary.issue,
        pages=primary.pages or secondary.pages,
        publisher=primary.publisher or secondary.publisher,
        address=primary.address or secondary.address,
        doi=primary.doi or secondary.doi,
        isbn=primary.isbn or secondary.isbn,
        issn=primary.issn or secondary.issn,
        keywords=_union_preserve_order(primary.keywords, secondary.keywords),
        abstract=primary.abstract or secondary.abstract,
        language=primary.language or secondary.language,
        url=primary.url or secondary.url,
        # Fill the URL slot for whichever source contributed it.
        eref_url=primary.eref_url or secondary.eref_url,
        epub_url=primary.epub_url or secondary.epub_url,
        bibtex_url=primary.bibtex_url or secondary.bibtex_url,
        bibtex_raw=primary.bibtex_raw or secondary.bibtex_raw,
    )
    return merged


def _union_preserve_order(a: list[str], b: list[str]) -> list[str]:
    """Concatenate two keyword lists, dropping case-insensitive duplicates
    while preserving original order (a first, then b's net-new entries)."""
    seen: set[str] = set()
    out: list[str] = []
    for item in (*a, *b):
        key = item.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def deduplicate(
    by_source: dict[str, list[Publication]],
) -> tuple[list[Publication], dict[str, int]]:
    """Apply SOURCE_PRIORITY: start with the highest-priority source's pubs,
    then for each lower-priority source's pubs, fold into existing matches
    or append as new. Returns the merged list and a stats dict for logging."""
    # Materialize lists in priority order so the highest-priority source
    # always gets to be 'primary' in any merge it participates in.
    ordered: list[list[Publication]] = [
        by_source.get(name, []) for name in SOURCE_PRIORITY
    ]
    if not ordered:
        return [], {"merged": 0, "from_each": {}}

    merged_list: list[Publication] = list(ordered[0])
    merge_count = 0
    appended_from_secondary: dict[str, int] = {SOURCE_PRIORITY[0]: len(merged_list)}

    for src_name, secondary_pubs in zip(SOURCE_PRIORITY[1:], ordered[1:]):
        appended_from_secondary[src_name] = 0
        for cand in secondary_pubs:
            idx = find_duplicate_index(merged_list, cand)
            if idx is None:
                merged_list.append(cand)
                appended_from_secondary[src_name] += 1
            else:
                merged_list[idx] = merge_publications(merged_list[idx], cand)
                merge_count += 1

    stats = {"merged": merge_count, "from_each": appended_from_secondary}
    return merged_list, stats


# --------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------- #


def publication_to_dict(pub: Publication) -> dict[str, Any]:
    """Drop empty collections and None fields to keep the JSON compact."""
    out: dict[str, Any] = {}
    for key, value in asdict(pub).items():
        if value in (None, "", [], {}):
            continue
        out[key] = value
    return out


def main() -> int:
    print("Indexing persons...", flush=True)
    persons = load_persons()
    person_index = build_person_index(persons)
    print(f"  {len(person_index['full'])} persons indexed", flush=True)

    print("Fetching ERef Bayreuth...", flush=True)
    eref_pubs = fetch_and_build(EREF_SOURCE, person_index)

    print("Fetching EPub Bayreuth...", flush=True)
    epub_pubs = fetch_and_build(EPUB_SOURCE, person_index)

    print("Deduplicating across sources...", flush=True)
    pubs, dedup_stats = deduplicate({"eref": eref_pubs, "epub": epub_pubs})
    cross_listed = sum(1 for p in pubs if len(p.sources) > 1)
    print(
        f"  {len(eref_pubs)} ERef + {len(epub_pubs)} EPub → {len(pubs)} unique "
        f"({cross_listed} cross-listed, {dedup_stats['merged']} merged)",
        flush=True,
    )

    matched = sum(1 for p in pubs for a in (*p.authors, *p.editors) if a.person_id is not None)
    total_authors = sum(len(p.authors) + len(p.editors) for p in pubs)
    by_type: dict[str, int] = defaultdict(int)
    for p in pubs:
        by_type[p.type] += 1

    by_source: dict[str, int] = defaultdict(int)
    for p in pubs:
        # Count records in each source (cross-listed records count in both).
        for s in p.sources:
            by_source[s] += 1
    by_source_only: dict[str, int] = defaultdict(int)
    for p in pubs:
        if len(p.sources) == 1:
            by_source_only[p.sources[0]] += 1
    by_source_only["both"] = cross_listed

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sources": [
            {
                "name": EREF_SOURCE.name,
                "label": EREF_SOURCE.label,
                "bibtex_url": EREF_SOURCE.bibtex_url,
                "rss_url": EREF_SOURCE.rss_url,
                "view_url": (
                    "https://eref.uni-bayreuth.de/view/projekt/"
                    f"{EREF_PROJEKT_ID}.html"
                ),
                "fetched_count": len(eref_pubs),
            },
            {
                "name": EPUB_SOURCE.name,
                "label": EPUB_SOURCE.label,
                "bibtex_url": EPUB_SOURCE.bibtex_url,
                "rss_url": EPUB_SOURCE.rss_url,
                "view_url": f"https://epub.uni-bayreuth.de/view/divisions/{EPUB_DIVISION_ID}.html",
                "fetched_count": len(epub_pubs),
            },
        ],
        "stats": {
            "total": len(pubs),
            "by_type": dict(by_type),
            "by_source": dict(by_source),
            "by_source_only": dict(by_source_only),
            "cross_listed": cross_listed,
            "matched_contributors": matched,
            "total_contributors": total_authors,
        },
        "publications": [publication_to_dict(p) for p in pubs],
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)

    print(
        f"Wrote {OUT_PATH.relative_to(ROOT)}: {len(pubs)} publications, "
        f"{matched}/{total_authors} contributors matched to persons",
        flush=True,
    )
    print(f"  by type: {dict(sorted(by_type.items(), key=lambda kv: -kv[1]))}", flush=True)
    print(f"  by source: {dict(by_source)}, cross-listed: {cross_listed}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
