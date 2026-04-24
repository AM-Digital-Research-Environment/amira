"""
Chart-data aggregators for the per-entity dashboard pipeline.

Each `build_<chartkey>()` function takes a list of raw MongoDB item documents
and returns a JSON-serializable payload that matches the shape expected by
the matching ChartKey in the frontend. Shapes are documented in
`references/visualization-patterns.md` from the `wisski-mongodb` skill.

Every function is **pure**: no I/O, no mutation of its input list. Callers are
responsible for filtering items before passing them in (e.g. filtering items to
only those tagged with a specific language code before computing a language's
dashboard).

Normalization follows the rules baked into the frontend's loaders:
  - `location.origin[].l{1,2,3}` may be string OR string[] -> take first element
  - `typeOfResource` missing -> treated as "Unknown"
  - empty strings / None are dropped silently
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Iterable

from . import config


# --------------------------------------------------------------------------
# Language code → English name
# --------------------------------------------------------------------------
# Mirror of `src/lib/utils/languages.ts` so precompute output already carries
# display-ready labels. If the frontend's map gains a code, add it here too.
LANGUAGE_ALIASES: dict[str, str] = {
    "fre": "fra",  # French: bibliographic -> terminology
    "ger": "deu",  # German: bibliographic -> terminology
}

LANGUAGE_NAMES: dict[str, str] = {
    "ach": "Acholi",
    "ara": "Arabic",
    "cat": "Catalan",
    "deu": "German",
    "dholuo": "Dholuo",
    "eng": "English",
    "ewe": "Ewe",
    "fat": "Fanti",
    "fra": "French",
    "gaa": "Ga",
    "ger": "German",
    "hau": "Hausa",
    "heb": "Hebrew",
    "her": "Herero",
    "ibo": "Igbo",
    "kru": "Kru",
    "lat": "Latin",
    "lug": "Luganda",
    "mas": "Maasai",
    "mon": "Mongolian",
    "pcm": "Nigerian Pidgin",
    "por": "Portuguese",
    "sag": "Sango",
    "samburu": "Samburu",
    "spa": "Spanish",
    "swa": "Swahili",
    "tur": "Turkish",
    "twi": "Twi",
    "yor": "Yoruba",
}


def normalize_language_code(code: str) -> str:
    lower = code.lower()
    return LANGUAGE_ALIASES.get(lower, lower)


def language_name(code: str) -> str:
    """Resolve an ISO 639-2/3 code to its English name, or fall back to the code."""
    return LANGUAGE_NAMES.get(normalize_language_code(code), code)


# --------------------------------------------------------------------------
# Extraction helpers
# --------------------------------------------------------------------------


def _as_str(value: Any) -> str | None:
    """Coerce value to a non-empty stripped string, or None."""
    if isinstance(value, list):
        value = value[0] if value else None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def _item_year(item: dict) -> int | None:
    """Pull the most reliable single year for an item, or None.

    Mirrors the frontend's `extractItemYear()` in
    `src/lib/utils/transforms/dates.ts`: reads `item.dateInfo.<category>.<side>`
    where `<category>` is one of `issue`, `creation`, `created` (priority order)
    and `<side>` is `start` then `end`. Values may be ISO strings,
    MongoDB-Extended-JSON `{$date: ...}` / `{$numberDouble: 'NaN'}`, or `None`.
    Years outside the configured window are treated as noise.
    """
    date_info = item.get("dateInfo")
    if not isinstance(date_info, dict):
        return None
    for category in ("issue", "creation", "created"):
        block = date_info.get(category)
        if not isinstance(block, dict):
            continue
        for side in ("start", "end"):
            year = _parse_year(block.get(side))
            if year is not None:
                return year
    return None


_YEAR_RE = None  # lazy-init so module import is cheap


def _parse_year(raw: Any) -> int | None:
    """Coerce any date-ish value to a calendar year within the config window.

    Accepts: strings, datetime-like, MongoDB `{$date: ...}`, `{$numberDouble: 'NaN'}`,
    numbers (treated as years or epochs), and None.
    """
    # MongoDB NaN -> None
    if isinstance(raw, dict):
        if raw.get("$numberDouble") == "NaN":
            return None
        if "$date" in raw:
            raw = raw["$date"]
        else:
            return None

    if raw is None:
        return None

    # Already a datetime
    import datetime

    if isinstance(raw, datetime.datetime):
        year = raw.year
        return year if config.MIN_YEAR <= year <= config.MAX_YEAR else None

    # Numeric year or epoch
    if isinstance(raw, (int, float)):
        if raw != raw:  # NaN
            return None
        year = int(raw) if raw >= config.MIN_YEAR else datetime.datetime.fromtimestamp(raw / 1000).year
        return year if config.MIN_YEAR <= year <= config.MAX_YEAR else None

    text = _as_str(raw)
    if text is None:
        return None

    # Find first plausible 4-digit year in the string.
    import re

    global _YEAR_RE
    if _YEAR_RE is None:
        _YEAR_RE = re.compile(r"\b(1[0-9]{3}|20[0-9]{2}|21[0-9]{2})\b")
    match = _YEAR_RE.search(text)
    if match is None:
        return None
    year = int(match.group(1))
    if config.MIN_YEAR <= year <= config.MAX_YEAR:
        return year
    return None


def _type_of_resource(item: dict) -> str:
    return _as_str(item.get("typeOfResource")) or "Unknown"


def _subject_labels(item: dict) -> list[str]:
    out: list[str] = []
    for subj in item.get("subject") or []:
        if not isinstance(subj, dict):
            continue
        label = _as_str(subj.get("authLabel")) or _as_str(subj.get("origLabel"))
        if label:
            out.append(label)
    return out


def _tag_labels(item: dict) -> list[str]:
    out: list[str] = []
    for tag in item.get("subject") or []:
        if not isinstance(tag, dict):
            continue
        # The Omeka module treats `authLabel` as LCSH; tags live under origLabel
        # only when there's no authority binding. This heuristic keeps the
        # `subject` + `wordCloud` distinction consistent with the module.
        if _as_str(tag.get("authLabel")) is None:
            label = _as_str(tag.get("origLabel"))
            if label:
                out.append(label)
    return out


def _language_codes(item: dict) -> list[str]:
    codes: list[str] = []
    for raw in item.get("language") or []:
        code = _as_str(raw)
        if code:
            codes.append(code.lower())
    return codes


def _contributors(item: dict) -> list[tuple[str, str | None]]:
    """Yield `(person label, role label)` pairs for an item."""
    out: list[tuple[str, str | None]] = []
    for block in item.get("name") or []:
        if not isinstance(block, dict):
            continue
        label = _as_str((block.get("name") or {}).get("label"))
        if not label:
            continue
        role = None
        roles = block.get("role") or []
        if isinstance(roles, list) and roles:
            first = roles[0]
            if isinstance(first, dict):
                role = _as_str(first.get("label"))
        out.append((label, role))
    return out


def _origin_location(item: dict) -> tuple[str | None, str | None, str | None]:
    origin = item.get("location", {}).get("origin") or []
    if not isinstance(origin, list) or not origin:
        return None, None, None
    first = origin[0]
    if not isinstance(first, dict):
        return None, None, None
    return _as_str(first.get("l1")), _as_str(first.get("l2")), _as_str(first.get("l3"))


# --------------------------------------------------------------------------
# Chart builders
# --------------------------------------------------------------------------


def build_timeline(items: Iterable[dict]) -> list[dict]:
    """Chart: `timeline` -> `[{year, count}]`, sorted by year ascending."""
    counts: Counter[int] = Counter()
    for item in items:
        year = _item_year(item)
        if year is not None:
            counts[year] += 1
    return [
        {"year": year, "count": counts[year]} for year in sorted(counts.keys())
    ]


def build_stacked_timeline(items: Iterable[dict]) -> list[dict]:
    """Chart: `stackedTimeline` -> `[{year, total, byType: {type: count}}]`.

    Stacks by resource type. Matches the `StackedTimelineDataPoint` shape in
    `src/lib/utils/transforms/grouping.ts`.
    """
    by_year: dict[int, dict[str, int]] = {}
    for item in items:
        year = _item_year(item)
        if year is None:
            continue
        rtype = _type_of_resource(item)
        by_type = by_year.setdefault(year, {})
        by_type[rtype] = by_type.get(rtype, 0) + 1
    return [
        {
            "year": year,
            "total": sum(by_type.values()),
            "byType": by_type,
        }
        for year, by_type in sorted(by_year.items())
    ]


def build_types(items: Iterable[dict]) -> list[dict]:
    """Chart: `types` -> `[{name, value}]` sorted by value desc."""
    counts: Counter[str] = Counter()
    for item in items:
        counts[_type_of_resource(item)] += 1
    return [
        {"name": name, "value": count}
        for name, count in counts.most_common()
    ]


def build_languages(items: Iterable[dict], exclude: str | None = None) -> list[dict]:
    """Chart: `languages` -> top co-occurring languages as `[{name, value}]`.

    Names are resolved to their English form (e.g. `fra` -> `French`) so the
    bar chart matches the frontend's `languageName()` output. Pass
    `exclude=<code>` when computing a per-language dashboard so the entity's
    own code doesn't dominate its own co-occurrence chart.
    """
    exclude_canonical = normalize_language_code(exclude) if exclude else None
    counts: Counter[str] = Counter()
    for item in items:
        seen: set[str] = set()  # avoid double-counting if an item lists the same code twice
        for code in _language_codes(item):
            canonical = normalize_language_code(code)
            if exclude_canonical and canonical == exclude_canonical:
                continue
            if canonical in seen:
                continue
            seen.add(canonical)
            counts[canonical] += 1
    return [
        {"name": language_name(code), "value": count}
        for code, count in counts.most_common(config.TOP_N_LANGUAGES)
    ]


def build_subjects(items: Iterable[dict], limit: int | None = None) -> list[dict]:
    counts: Counter[str] = Counter()
    for item in items:
        for label in _subject_labels(item):
            counts[label] += 1
    return [
        {"name": name, "value": count}
        for name, count in counts.most_common(limit or config.TOP_N_SUBJECTS)
    ]


def build_word_cloud(items: Iterable[dict], limit: int | None = None) -> list[dict]:
    """Chart: `wordCloud` -> subject+tag frequency, wider net than `subjects`."""
    counts: Counter[str] = Counter()
    for item in items:
        for label in _subject_labels(item):
            counts[label] += 1
        for label in _tag_labels(item):
            counts[label] += 1
    return [
        {"name": name, "value": count}
        for name, count in counts.most_common(limit or config.TOP_N_WORDCLOUD)
    ]


def build_contributors(items: Iterable[dict], limit: int | None = None) -> list[dict]:
    """Chart: `contributors` -> `[{name, value}]` of most frequent contributors."""
    counts: Counter[str] = Counter()
    for item in items:
        for label, _role in _contributors(item):
            counts[label] += 1
    return [
        {"name": name, "value": count}
        for name, count in counts.most_common(limit or config.TOP_N_CONTRIBUTORS)
    ]


def build_roles(items: Iterable[dict]) -> list[dict]:
    """Chart: `roles` -> MARC relator distribution as `[{name, value}]`."""
    counts: Counter[str] = Counter()
    for item in items:
        for _person, role in _contributors(item):
            if role:
                counts[role] += 1
    return [
        {"name": name, "value": count}
        for name, count in counts.most_common()
    ]


def build_heatmap_type_decade(items: Iterable[dict]) -> list[dict]:
    """Chart: `heatmap` -> `[{x: decade, y: type, value}]`.

    Buckets items by decade (``"1960s"``, ``"1970s"``, …) rather than per-year
    so x-axis labels stay readable for entities that span a century of data.
    For narrower windows the decade view still works — a single-decade dataset
    renders one column, which is fine.
    """
    counts: Counter[tuple[str, str]] = Counter()
    for item in items:
        year = _item_year(item)
        if year is None:
            continue
        decade = f"{(year // 10) * 10}s"
        counts[(decade, _type_of_resource(item))] += 1
    return [
        {"x": decade, "y": rtype, "value": count}
        for (decade, rtype), count in sorted(counts.items())
    ]


# Backwards-compatible alias for callers that still use the old name.
build_heatmap_type_year = build_heatmap_type_decade


def build_locations(items: Iterable[dict]) -> list[dict]:
    """Chart: `locations` -> `[{country, region, city, count}]`.

    Matches the `LocationData` shape consumed by `LocationMap.svelte` / the
    marker builder in `src/lib/components/charts/map/markerBuilder.ts`.
    """
    counts: Counter[tuple[str, str, str]] = Counter()
    for item in items:
        country, region, city = _origin_location(item)
        if not country:
            continue
        counts[(country, region or "", city or "")] += 1
    return [
        {"country": country, "region": region, "city": city, "count": count}
        for (country, region, city), count in counts.most_common()
    ]


# --------------------------------------------------------------------------
# Metadata
# --------------------------------------------------------------------------


def build_meta(entity_type: str, entity_id: str, name: str, items: list[dict]) -> dict:
    """Standard `meta` block for every dashboard JSON."""
    return {
        "type": entity_type,
        "id": entity_id,
        "name": name,
        "count": len(items),
    }
