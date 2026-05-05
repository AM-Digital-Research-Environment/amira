"""Fetch the cluster's publications from ERef Bayreuth and emit a normalized
JSON file at ``static/data/publications.json`` for the dashboard frontend.

Sources (confirmed working — see GitHub issue #24):

* Bulk BibTeX export, scoped to the Africa Multiple (EXC 2052) project view.
  Canonical metadata: title, authors, editors, year, journal/booktitle,
  volume/issue/pages, publisher, DOI/ISBN/ISSN, keywords.
* RSS feed for the same projekt view. Used to recover the *deposit* date
  (BibTeX only carries publication year), which lets us derive the year +
  quarter grouping the cluster website uses today.

Outputs are stable and idempotent: re-running the script overwrites
``publications.json`` with the same shape so any downstream consumer (dashboard,
cluster website) can rely on the schema. Author strings are matched against
the existing persons store at ``static/data/dev/dev.persons.json``.
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

PROJEKT_ID = "EXC_2052=3A_Africa_Multiple=3A_Reconfiguring_African_Studies"
EXPORT_BASE = "https://eref.uni-bayreuth.de/cgi/exportview/projekt"
EPRINT_BASE = "https://eref.uni-bayreuth.de/id/eprint"
PER_EPRINT_BIBTEX = "https://eref.uni-bayreuth.de/cgi/export/eprint/{id}/BibTeX/ubt_eref-eprint-{id}.bib"

BIBTEX_URL = f"{EXPORT_BASE}/{PROJEKT_ID}/BibTeX/{PROJEKT_ID}.bib"
RSS_URL = f"{EXPORT_BASE}/{PROJEKT_ID}/RSS2/{PROJEKT_ID}.xml"
# EP3 XML carries the rich metadata BibTeX drops: abstract, structured
# keywords, GND author IDs, related DOIs, official_url. We use it as a
# secondary enrichment source rather than the canonical one because the
# BibTeX export remains the format Zotero consumes natively.
EP3_XML_URL = f"{EXPORT_BASE}/{PROJEKT_ID}/XML/{PROJEKT_ID}.xml"
EP3_NS = {"ep": "http://eprints.org/ep2/data/2.0"}

# Map ERef's source-of-truth type to the frontend taxonomy. We prefer
# ERef's EP3 XML ``<type>`` over the BibTeX ``ENTRYTYPE`` because BibTeX
# collapses many distinct categories (working papers, theses, periodical
# parts, reviews, online publications…) under ``@misc`` — leaving the UI
# with a giant ``other`` bucket.
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


@dataclass
class Author:
    raw: str
    normalized: str
    person_id: str | None = None
    person_name: str | None = None


@dataclass
class Publication:
    id: str
    type: str
    raw_type: str
    title: str
    year: int | None
    quarter: int | None
    deposited_at: str | None
    authors: list[Author] = field(default_factory=list)
    editors: list[Author] = field(default_factory=list)
    # Volume editors for chapters / book sections. Distinct from `editors`
    # (which carries volume editors for `@book` records). Populated from
    # ERef's EP3 XML `<book_editors>` element — the BibTeX export drops
    # this entirely for `@incollection`, so we always have to enrich.
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
    # ISO 639-2/B language code (eng, ger, fre…). ``und`` and blanks are
    # dropped at parse time so consumers always have a real code.
    language: str | None = None
    url: str | None = None
    eref_url: str | None = None
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


def build_person_index(persons: list[dict[str, Any]]) -> dict[str, dict[str, str]]:
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
#
# The accent commands we have seen in ERef BibTeX so far:
#   \" \' \` \^ \~ \=    diaeresis / acute / grave / circumflex / tilde / macron
#   \. \c \v \H \u \r \k dot-above / cedilla / caron / Hungarian / breve / ring / ogonek
# All 22 distinct backslash tokens in the live feed are accounted for here;
# ones that crop up later will fall through normalize_bibtex_value() unchanged
# and the per-publication QA pass in the dashboard will surface them.
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

    # Pattern A: `{\X y}` or `{\X{y}}` — accent inside braces (most common in ERef).
    pattern_braced = re.compile(r"\{\\([\"'`^~=.cvHurkbdt])\s*\{?([A-Za-z])\}?\}")
    s = pattern_braced.sub(replace_match, s)
    # Pattern B: `\X{y}` — accent followed by braced letter.
    pattern_unbraced = re.compile(r"\\([\"'`^~=.cvHurkbdt])\{([A-Za-z])\}")
    s = pattern_unbraced.sub(replace_match, s)
    # Pattern C: `\Xy` for non-letter accents — always safe because the
    # accent character can never be the start of a longer command.
    pattern_bare_punct = re.compile(r"\\([\"'`^~=.])\s*([A-Za-z])")
    s = pattern_bare_punct.sub(replace_match, s)
    # Pattern D: `\Xy` for letter accents — allow ONLY when the base letter
    # is not followed by another letter (otherwise `\centering` would match).
    pattern_bare_letter = re.compile(r"\\([cvHurkbdt])([A-Za-z])(?![A-Za-z])")
    s = pattern_bare_letter.sub(replace_match, s)
    return s


def normalize_bibtex_value(value: str) -> str:
    """Strip the outer braces left by bibtexparser preserve, decode LaTeX
    accent commands, and unescape a handful of common LaTeX-isms that show up
    in ERef data."""
    if value is None:
        return ""
    s = value.strip()
    # Hard-strip the wrapping braces left over from `homogenize_latex_encoding`.
    if s.startswith("{") and s.endswith("}"):
        s = s[1:-1].strip()
    # Decode accent commands before generic brace stripping so combining
    # marks attach to their base letter.
    s = _decode_latex_accents(s)
    for k, v in _LATEX_LITERALS.items():
        s = s.replace(k, v)
    # Strip any remaining single-pair braces around brand names etc.
    s = re.sub(r"\{([^{}]*)\}", r"\1", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def derive_quarter(month: int) -> int:
    return (month - 1) // 3 + 1


def parse_ep3_xml(xml_text: str) -> dict[str, dict[str, Any]]:
    """Extract per-eprint enrichment fields the BibTeX export drops:
    ``abstract``, refined ``keywords``, and ``gnd_ids`` keyed by
    ``"family|given"`` so person matching can later prefer GND IDs over
    name strings (deterministic match)."""
    out: dict[str, dict[str, Any]] = {}
    root = ET.fromstring(xml_text)
    for ep in root.findall(".//ep:eprint", EP3_NS):
        eid_node = ep.find("ep:eprintid", EP3_NS)
        if eid_node is None or not eid_node.text:
            continue
        eprint_id = eid_node.text.strip()
        record: dict[str, Any] = {}

        # The abstract_original element wraps a multilingual `<text>` /
        # `<lang>` pair. Pick the English version when available, else the
        # first text child.
        abstract_node = ep.find("ep:abstract_original", EP3_NS)
        if abstract_node is not None:
            text_nodes = abstract_node.findall("ep:text", EP3_NS)
            lang_nodes = abstract_node.findall("ep:lang", EP3_NS)
            chosen: str | None = None
            for i, tn in enumerate(text_nodes):
                if tn.text is None:
                    continue
                lang = lang_nodes[i].text.strip().lower() if i < len(lang_nodes) and lang_nodes[i].text else ""
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
                # Collapse whitespace so the JSON field is one paragraph.
                record["abstract"] = re.sub(r"\s+", " ", chosen)

        keywords_node = ep.find("ep:keywords", EP3_NS)
        if keywords_node is not None and keywords_node.text:
            kws = re.split(r";|,", keywords_node.text)
            cleaned = [k.strip() for k in kws if k.strip()]
            if cleaned:
                record["keywords"] = cleaned

        # EP3 ``<type>`` is the cluster's source of truth and has finer
        # categories than BibTeX. Stash it; build_publications prefers it.
        type_node = ep.find("ep:type", EP3_NS)
        if type_node is not None and type_node.text:
            record["type"] = type_node.text.strip().lower()

        official = ep.find("ep:official_url", EP3_NS)
        if official is not None and official.text:
            record["official_url"] = official.text.strip()

        # ISO 639-3 publication language. Skip ``und`` (undetermined) and
        # blank values — there's no useful filter we can build on those.
        lang_node = ep.find("ep:language", EP3_NS)
        if lang_node is not None and lang_node.text:
            lang = lang_node.text.strip().lower()
            if lang and lang != "und":
                record["language"] = lang

        # ERef sometimes parks the DOI in `<related_doi>` (with a ``doi:``
        # prefix) and never copies it into the BibTeX `doi` field —
        # particularly for `@incollection` entries. Always harvest both
        # so the merge step in build_publications can fall back.
        related_doi = ep.find("ep:related_doi", EP3_NS)
        if related_doi is not None and related_doi.text:
            doi = related_doi.text.strip()
            if doi.lower().startswith("doi:"):
                doi = doi[4:].strip()
            if doi:
                record["doi"] = doi

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

        # Volume editors for chapters/book_sections. Stored as raw
        # ``Last, First`` strings; matched to the persons store later in
        # build_publications via the same path as authors/editors.
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


def eprint_id_from_bib_key(key: str) -> str | None:
    """`ubt_eref96022` → `96022`. Returns None for unexpected key shapes."""
    match = re.search(r"(\d+)$", key or "")
    return match.group(1) if match else None


def render_bibtex_entry(entry: dict[str, Any]) -> str:
    """Re-emit a single bibtexparser entry as a stand-alone .bib string with
    LaTeX accent commands decoded to UTF-8 (e.g. ``M{\\"u}nchen`` →
    ``München``).

    We keep the raw entry around so the frontend's per-item Zotero export
    can serve it directly without round-tripping back to ERef. Modern
    Zotero, biber, and biblatex all consume UTF-8 BibTeX without issue,
    and the resulting file is far more readable than the LaTeX-escaped
    upstream version. The structural BibTeX escapes (``\\%``, ``\\&``)
    are preserved so the file still validates."""
    cleaned: dict[str, Any] = {}
    for key, value in entry.items():
        if key in ("ENTRYTYPE", "ID"):
            cleaned[key] = value
        elif isinstance(value, str):
            # Decode LaTeX accents and the literal LaTeX-isms we know about
            # while leaving the BibTeX-required ``\%`` / ``\&`` escapes as
            # bibtexparser emits them.
            decoded = _decode_latex_accents(value)
            for k, v in _LATEX_LITERALS.items():
                # Only the non-structural literals — keep `\&` and `\%` so
                # field values remain valid in legacy BibTeX engines too.
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
# Pipeline
# --------------------------------------------------------------------------- #


def build_publications(
    bibtex_entries: list[dict[str, Any]],
    rss_dates: dict[str, dict[str, Any]],
    ep3_data: dict[str, dict[str, Any]],
    person_index: dict[str, dict[str, dict[str, str]]],
) -> list[Publication]:
    pubs: list[Publication] = []
    for entry in bibtex_entries:
        bib_key = entry.get("ID") or ""
        eprint_id = eprint_id_from_bib_key(bib_key)
        if not eprint_id:
            continue

        # Prefer EP3 type when available — it distinguishes working_paper,
        # periodical_part, review, online, etc. that BibTeX collapses into
        # ``@misc``. Fall back to BibTeX when the EP3 record is missing.
        ep3_type = ep3_data.get(eprint_id, {}).get("type")
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
        # Prefer the RSS quarter (deposit-based) — that's what the cluster
        # website's "2025 - III" buckets reflect, not publication year.
        quarter = rss_meta.get("quarter")

        authors = [
            match_author(a, person_index)
            for a in split_bibtex_authors(normalize_bibtex_value(entry.get("author", "")))
        ]
        editors = [
            match_author(e, person_index)
            for e in split_bibtex_authors(normalize_bibtex_value(entry.get("editor", "")))
        ]

        # ``url`` in ERef BibTeX is variably the DOI link or the eprint
        # permalink. We always reconstruct the eprint URL from the ID and
        # keep ``url`` as the best-of-both-worlds canonical link (DOI if
        # present, otherwise the ERef permalink).
        eref_url = f"{EPRINT_BASE}/{eprint_id}/"
        bibtex_field_url = normalize_bibtex_value(entry.get("url", "")) or None
        doi_raw = normalize_bibtex_value(entry.get("doi", "")) or None
        ep3_record = ep3_data.get(eprint_id, {})
        if doi_raw and doi_raw.startswith("http"):
            doi_url: str | None = doi_raw
            doi_clean = re.sub(r"^https?://(dx\.)?doi\.org/", "", doi_raw)
        elif doi_raw:
            doi_url = f"https://doi.org/{doi_raw}"
            doi_clean = doi_raw
        else:
            doi_url = None
            doi_clean = None

        # If BibTeX neither has a `doi` field nor a doi.org URL, fall back
        # to EP3 XML's `<related_doi>`. This catches `@incollection`
        # records where ERef stores the DOI separately from the citation.
        if not doi_clean:
            ep3_doi = ep3_record.get("doi")
            if ep3_doi:
                doi_clean = ep3_doi
                doi_url = f"https://doi.org/{ep3_doi}"
            elif bibtex_field_url and "doi.org/" in bibtex_field_url:
                # Some entries put the DOI in `url` rather than `doi`.
                doi_url = bibtex_field_url
                doi_clean = re.sub(
                    r"^https?://(dx\.)?doi\.org/", "", bibtex_field_url
                )

        canonical_url = doi_url or bibtex_field_url or eref_url

        # Keywords: prefer EP3 XML (structured, present for 86/127 records);
        # fall back to BibTeX `keywords` or `keyword` (singular variant ERef
        # sometimes emits) when EP3 doesn't have them.
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

        # Volume editors for chapters: BibTeX never carries them, so we
        # always source from EP3 XML's ``<book_editors>`` block.
        book_editors = [
            match_author(name, person_index)
            for name in ep3_record.get("book_editors", [])
        ]

        pubs.append(
            Publication(
                id=eprint_id,
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
                eref_url=eref_url,
                bibtex_url=PER_EPRINT_BIBTEX.format(id=eprint_id),
                bibtex_raw=render_bibtex_entry(entry),
            )
        )
    return pubs


def publication_to_dict(pub: Publication) -> dict[str, Any]:
    """Drop empty collections and None fields to keep the JSON compact."""
    out: dict[str, Any] = {}
    for key, value in asdict(pub).items():
        if value in (None, "", [], {}):
            continue
        out[key] = value
    return out


def main() -> int:
    print("Fetching ERef BibTeX bulk export...", flush=True)
    bibtex_text = fetch_text(BIBTEX_URL)
    print(f"  {len(bibtex_text):,} chars", flush=True)

    print("Fetching ERef RSS feed for deposit dates...", flush=True)
    rss_text = fetch_text(RSS_URL)

    print("Fetching ERef EP3 XML for abstracts + keywords...", flush=True)
    ep3_text = fetch_text(EP3_XML_URL)
    print(f"  {len(ep3_text):,} chars", flush=True)

    print("Parsing BibTeX...", flush=True)
    bibtex_entries = parse_bibtex(bibtex_text)
    print(f"  {len(bibtex_entries)} entries", flush=True)

    print("Parsing RSS dates...", flush=True)
    rss_dates = parse_rss_dates(rss_text)
    print(f"  {len(rss_dates)} dated entries", flush=True)

    print("Parsing EP3 XML enrichment...", flush=True)
    ep3_data = parse_ep3_xml(ep3_text)
    abstracts_n = sum(1 for v in ep3_data.values() if v.get("abstract"))
    keywords_n = sum(1 for v in ep3_data.values() if v.get("keywords"))
    print(f"  {abstracts_n} abstracts, {keywords_n} keyword sets", flush=True)

    print("Indexing persons...", flush=True)
    persons = load_persons()
    person_index = build_person_index(persons)
    print(f"  {len(person_index['full'])} persons indexed", flush=True)

    print("Building publications...", flush=True)
    pubs = build_publications(bibtex_entries, rss_dates, ep3_data, person_index)

    matched = sum(
        1
        for p in pubs
        for a in (*p.authors, *p.editors)
        if a.person_id is not None
    )
    total_authors = sum(len(p.authors) + len(p.editors) for p in pubs)
    by_type: dict[str, int] = defaultdict(int)
    for p in pubs:
        by_type[p.type] += 1

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "projekt_id": PROJEKT_ID,
            "bibtex_url": BIBTEX_URL,
            "rss_url": RSS_URL,
        },
        "stats": {
            "total": len(pubs),
            "by_type": dict(by_type),
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
    return 0


if __name__ == "__main__":
    sys.exit(main())
