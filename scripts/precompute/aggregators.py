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

import re
from collections import Counter
from typing import Any, Iterable

from . import config


# --------------------------------------------------------------------------
# Slug generation
# --------------------------------------------------------------------------
# Mirror of `src/lib/utils/slugify.ts`. Keep in sync with the frontend.
_SLUG_SLASH_RE = re.compile(r"[\\/]")
_SLUG_NON_ALNUM_RE = re.compile(r"[^a-z0-9-]+")
_SLUG_COLLAPSE_RE = re.compile(r"-+")


def slugify(value: str) -> str:
    """Port of `slugify()` in `src/lib/utils/slugify.ts`.

    Produces URL-safe, filename-safe slugs that the runtime loader can compute
    from the display name without any extra round-trip.
    """
    s = value.lower().strip()
    s = _SLUG_SLASH_RE.sub("-", s)
    s = _SLUG_NON_ALNUM_RE.sub("-", s)
    s = _SLUG_COLLAPSE_RE.sub("-", s)
    s = s.strip("-")
    return s[:120]


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
    """Top-level `tags` list — mirrors the frontend's subjects page `tagMap`."""
    out: list[str] = []
    for tag in item.get("tags") or []:
        label = _as_str(tag)
        if label:
            out.append(label)
    return out


def _genre_labels(item: dict) -> list[str]:
    """All values across the `genre.*` sub-dicts (e.g. `marc`, `local`)."""
    out: list[str] = []
    genre = item.get("genre")
    if not isinstance(genre, dict):
        return out
    for values in genre.values():
        if not isinstance(values, list):
            continue
        for raw in values:
            label = _as_str(raw)
            if label:
                out.append(label)
    return out


def _names_with_qualifier(item: dict, qualifier: str) -> list[str]:
    """Return labels of `name[]` entries whose `name.qualifier` matches."""
    out: list[str] = []
    for block in item.get("name") or []:
        if not isinstance(block, dict):
            continue
        nm = block.get("name") or {}
        if not isinstance(nm, dict):
            continue
        if _as_str(nm.get("qualifier")) != qualifier:
            continue
        label = _as_str(nm.get("label"))
        if label:
            out.append(label)
    return out


def _affiliations(item: dict) -> list[str]:
    """Union of affiliations referenced on any `name[]` entry of this item."""
    out: list[str] = []
    for block in item.get("name") or []:
        if not isinstance(block, dict):
            continue
        affl = block.get("affl")
        if not isinstance(affl, list):
            continue
        for raw in affl:
            label = _as_str(raw)
            if label:
                out.append(label)
    return out


def _location_names(item: dict) -> list[str]:
    """Every country/region/city/current-location name mentioned on the item."""
    out: list[str] = []
    loc = item.get("location") or {}
    if not isinstance(loc, dict):
        return out
    for origin in loc.get("origin") or []:
        if not isinstance(origin, dict):
            continue
        for key in ("l1", "l2", "l3"):
            label = _as_str(origin.get(key))
            if label:
                out.append(label)
    for current in loc.get("current") or []:
        label = _as_str(current)
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


def build_types(items: Iterable[dict], exclude: str | None = None) -> list[dict]:
    """Chart: `types` -> `[{name, value}]` sorted by value desc."""
    counts: Counter[str] = Counter()
    for item in items:
        rtype = _type_of_resource(item)
        if exclude is not None and rtype == exclude:
            continue
        counts[rtype] += 1
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


def build_subjects(
    items: Iterable[dict],
    limit: int | None = None,
    exclude: str | None = None,
) -> list[dict]:
    counts: Counter[str] = Counter()
    for item in items:
        for label in _subject_labels(item):
            if exclude is not None and label == exclude:
                continue
            counts[label] += 1
    return [
        {"name": name, "value": count}
        for name, count in counts.most_common(limit or config.TOP_N_SUBJECTS)
    ]


def build_tags(
    items: Iterable[dict],
    limit: int | None = None,
    exclude: str | None = None,
) -> list[dict]:
    """Chart: `subjects`-style bar, counted from top-level `tags[]` instead."""
    counts: Counter[str] = Counter()
    for item in items:
        for label in _tag_labels(item):
            if exclude is not None and label == exclude:
                continue
            counts[label] += 1
    return [
        {"name": name, "value": count}
        for name, count in counts.most_common(limit or config.TOP_N_SUBJECTS)
    ]


def build_genres(
    items: Iterable[dict],
    limit: int | None = None,
    exclude: str | None = None,
) -> list[dict]:
    """Chart: top genre labels across all `genre.*` sub-lists."""
    counts: Counter[str] = Counter()
    for item in items:
        for label in _genre_labels(item):
            if exclude is not None and label == exclude:
                continue
            counts[label] += 1
    return [
        {"name": name, "value": count}
        for name, count in counts.most_common(limit or config.TOP_N_SUBJECTS)
    ]


def build_word_cloud(
    items: Iterable[dict],
    limit: int | None = None,
    exclude: str | None = None,
) -> list[dict]:
    """Chart: `wordCloud` -> subject+tag frequency, wider net than `subjects`."""
    counts: Counter[str] = Counter()
    for item in items:
        for label in _subject_labels(item):
            if exclude is not None and label == exclude:
                continue
            counts[label] += 1
        for label in _tag_labels(item):
            if exclude is not None and label == exclude:
                continue
            counts[label] += 1
    return [
        {"name": name, "value": count}
        for name, count in counts.most_common(limit or config.TOP_N_WORDCLOUD)
    ]


def build_contributors(
    items: Iterable[dict],
    limit: int | None = None,
    exclude: str | None = None,
) -> list[dict]:
    """Chart: `contributors` -> `[{name, value}]` of most frequent contributors."""
    counts: Counter[str] = Counter()
    for item in items:
        for label, _role in _contributors(item):
            if exclude is not None and label == exclude:
                continue
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


def build_sankey(
    items: Iterable[dict],
    max_items: int = 200,
    max_links: int = 100,
) -> dict:
    """Chart: `sankey` -> Contributor → Project → Resource Type flows.

    Port of `buildSankeyData()` from `src/lib/utils/transforms/network.ts`.
    """
    node_set: set[str] = set()
    link_map: Counter[tuple[str, str]] = Counter()

    for item in list(items)[:max_items]:
        project = item.get("project") or {}
        project_name = _as_str(project.get("name")) or _as_str(project.get("id"))
        resource_type = _as_str(item.get("typeOfResource"))
        if not project_name or not resource_type:
            continue

        node_set.add(project_name)
        node_set.add(resource_type)
        link_map[(project_name, resource_type)] += 1

        # Top-3 contributors only, matching the TS version.
        for block in (item.get("name") or [])[:3]:
            if not isinstance(block, dict):
                continue
            nm = block.get("name") or {}
            label = _as_str(nm.get("label"))
            if not label:
                continue
            node_set.add(label)
            link_map[(label, project_name)] += 1

    nodes = [{"name": n} for n in sorted(node_set)]
    links = [
        {"source": src, "target": tgt, "value": val}
        for (src, tgt), val in link_map.most_common(max_links)
    ]
    return {"nodes": nodes, "links": links}


def build_sunburst(
    items: Iterable[dict],
    max_subjects: int = 8,
) -> list[dict]:
    """Chart: `sunburst` -> Resource Type → Language → Subject hierarchy.

    Port of `buildSunburstData()` from `src/lib/utils/transforms/network.ts`.
    """
    type_map: dict[str, dict[str, Counter[str]]] = {}

    for item in items:
        resource_type = _as_str(item.get("typeOfResource")) or "Unknown"
        language_codes = _language_codes(item)
        languages = (
            [language_name(c) for c in language_codes] if language_codes else ["Unknown"]
        )
        subjects = _subject_labels(item)

        lang_bucket = type_map.setdefault(resource_type, {})
        for lang in languages:
            subj_bucket = lang_bucket.setdefault(lang, Counter())
            if not subjects:
                subj_bucket["(no subject)"] += 1
            else:
                for subj in subjects:
                    subj_bucket[subj] += 1

    result: list[dict] = []
    for resource_type, lang_bucket in type_map.items():
        lang_children: list[dict] = []
        for lang, subj_counter in lang_bucket.items():
            top = subj_counter.most_common(max_subjects)
            if not top:
                continue
            lang_children.append(
                {
                    "name": lang,
                    "children": [
                        {"name": subj, "value": count, "children": []}
                        for subj, count in top
                    ],
                }
            )
        if lang_children:
            result.append({"name": resource_type, "children": lang_children})

    def _total(node: dict) -> int:
        total = 0
        for lang_node in node.get("children") or []:
            for subj_node in lang_node.get("children") or []:
                total += int(subj_node.get("value") or 0)
        return total

    result.sort(key=_total, reverse=True)
    return result


def build_chord(
    items: Iterable[dict],
    min_occurrences: int = 3,
    max_subjects: int = 25,
) -> dict:
    """Chart: `chord` (subject co-occurrence) -> `{names, matrix}`.

    Port of `buildSubjectCoOccurrence()` from
    `src/lib/utils/transforms/network.ts`.
    """
    subject_counts: Counter[str] = Counter()
    per_item_subjects: list[list[str]] = []

    for item in items:
        labels = _subject_labels(item)
        per_item_subjects.append(labels)
        for subj in labels:
            subject_counts[subj] += 1

    top = [
        name
        for name, count in subject_counts.most_common(max_subjects)
        if count >= min_occurrences
    ]
    if not top:
        return {"names": [], "matrix": []}

    idx = {name: i for i, name in enumerate(top)}
    n = len(top)
    matrix = [[0] * n for _ in range(n)]

    for labels in per_item_subjects:
        known = [name for name in labels if name in idx]
        for i in range(len(known)):
            for j in range(i + 1, len(known)):
                a = idx[known[i]]
                b = idx[known[j]]
                matrix[a][b] += 1
                matrix[b][a] += 1

    return {"names": top, "matrix": matrix}


def build_subject_trends(
    items: Iterable[dict],
    top_n: int = 8,
) -> list[dict]:
    """Chart: `subjectTrends` (StackedAreaChart) -> `[{year, byCategory: {subject: count}}]`.

    Picks the top-N subjects across the entity's items by total count, then
    builds a year-by-year breakdown over only those subjects so the chart
    stays readable. Subjects below the cut-off are dropped (they don't fall
    into "Other" — the goal is the dominant trends, not a complete spectrum).
    """
    items_list = list(items)
    counts: Counter[str] = Counter()
    for item in items_list:
        for subj in _subject_labels(item):
            counts[subj] += 1
    top_subjects = [name for name, _ in counts.most_common(top_n)]
    if not top_subjects:
        return []
    top_set = set(top_subjects)

    by_year: dict[int, Counter[str]] = {}
    for item in items_list:
        year = _item_year(item)
        if year is None:
            continue
        bucket = by_year.setdefault(year, Counter())
        seen: set[str] = set()
        for subj in _subject_labels(item):
            if subj in top_set and subj not in seen:
                bucket[subj] += 1
                seen.add(subj)
    return [
        {"year": year, "byCategory": {s: bucket.get(s, 0) for s in top_subjects}}
        for year, bucket in sorted(by_year.items())
    ]


def build_language_timeline(items: Iterable[dict]) -> list[dict]:
    """Chart: `languageTimeline` (StackedAreaChart) -> `[{year, byCategory: {lang: count}}]`.

    Each item contributes once per (year, distinct language) pair so the
    layered area shows the language mix evolving across the archive.
    """
    by_year: dict[int, Counter[str]] = {}
    languages_seen: Counter[str] = Counter()
    for item in items:
        year = _item_year(item)
        if year is None:
            continue
        codes = {normalize_language_code(c) for c in _language_codes(item)}
        if not codes:
            continue
        bucket = by_year.setdefault(year, Counter())
        for code in codes:
            label = language_name(code)
            bucket[label] += 1
            languages_seen[label] += 1
    if not languages_seen:
        return []
    # Stable ordering by overall popularity so the legend matches the rest of
    # the dashboard's "top languages" presentation.
    ordered = [name for name, _ in languages_seen.most_common()]
    return [
        {"year": year, "byCategory": {lang: bucket.get(lang, 0) for lang in ordered}}
        for year, bucket in sorted(by_year.items())
    ]


def build_treemap(
    items: Iterable[dict],
    max_subjects: int = 6,
) -> list[dict]:
    """Chart: `treemap` -> same hierarchy as `sunburst` but trimmed for the
    flatter rectangular layout.

    The treemap renderer accepts the sunburst hierarchy unchanged; we just
    feed in a slightly tighter cap on subjects-per-language so the cells
    remain readable.
    """
    return build_sunburst(items, max_subjects=max_subjects)


def build_calendar_heatmap(items: Iterable[dict]) -> list[dict]:
    """Chart: `calendarHeatmap` -> `[{date: 'YYYY-MM-DD', value}]`.

    Uses the most reliable single date per item (issue.start | creation.start
    | created.start). Items missing a full ISO date are skipped — bare-year
    values would all collapse to 1 January and create a misleading spike.
    """
    counts: Counter[str] = Counter()
    for item in items:
        date_info = item.get("dateInfo")
        if not isinstance(date_info, dict):
            continue
        for category in ("issue", "creation", "created"):
            block = date_info.get(category)
            if not isinstance(block, dict):
                continue
            iso = _full_iso_date(block.get("start"))
            if iso:
                counts[iso] += 1
                break
    return [
        {"date": date, "value": count}
        for date, count in sorted(counts.items())
    ]


def _full_iso_date(raw: Any) -> str | None:
    """Coerce a date-ish value to a ``YYYY-MM-DD`` string, or None."""
    if isinstance(raw, dict):
        if raw.get("$numberDouble") == "NaN":
            return None
        if "$date" in raw:
            raw = raw["$date"]
        else:
            return None
    if raw is None:
        return None
    import datetime
    if isinstance(raw, datetime.datetime):
        return raw.date().isoformat()
    if isinstance(raw, str):
        # Pull a YYYY-MM-DD prefix; reject incomplete forms (year-only).
        match = re.match(r"^(\d{4})-(\d{2})-(\d{2})", raw.strip())
        if match:
            year = int(match.group(1))
            if config.MIN_YEAR <= year <= config.MAX_YEAR:
                return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
    return None


def build_box_plot_per_project(items: Iterable[dict]) -> list[dict]:
    """Chart: `boxPlot` for the items-per-project distribution.

    Groups items by `project.id`, then emits a single observation series of
    "items per project" per project. Useful on `/research-sections` to show
    how unevenly research items are distributed across projects.
    """
    per_project: Counter[str] = Counter()
    project_label: dict[str, str] = {}
    for item in items:
        project = item.get("project") or {}
        if not isinstance(project, dict):
            continue
        pid = _as_str(project.get("id"))
        if not pid:
            continue
        per_project[pid] += 1
        if pid not in project_label:
            project_label[pid] = _as_str(project.get("name")) or pid
    if not per_project:
        return []
    # Single-bucket distribution: every project contributes one observation
    # ("its item count") to the "Projects" group.
    return [
        {
            "name": "Items per project",
            "values": list(per_project.values()),
        }
    ]


def build_item_summaries(items: Iterable[dict]) -> list[dict]:
    """Slim per-item record shaped like `CollectionItem` subset used by
    `EntityItemsCard` / `CollectionItemRow` **and** the LocationMap
    clustered-marker popups.

    Allows detail-view rendering to work without loading the full 13 MB
    collections dump — the entity's dashboard JSON carries everything the
    list + map need: id, title, type, project label, and origin/current
    location coordinates (so marker popups can match items to clusters).
    """
    out: list[dict] = []
    seen: set[str] = set()
    for item in items:
        # Prefer `_id` (MongoDB ObjectId) then fall back to the dre_id slug —
        # whichever the frontend's researchItemUrl() would emit.
        raw_id = item.get("_id")
        if isinstance(raw_id, dict) and "$oid" in raw_id:
            item_id = raw_id["$oid"]
        else:
            item_id = _as_str(raw_id) or _as_str(item.get("dre_id")) or ""
        if not item_id:
            continue
        # Deduplicate — an item tagged with e.g. two variants of the same
        # language ends up in multiple buckets and could otherwise appear
        # twice in the per-entity list.
        if item_id in seen:
            continue
        seen.add(item_id)

        title_info = item.get("titleInfo") or []
        title = None
        if isinstance(title_info, list) and title_info:
            first = title_info[0]
            if isinstance(first, dict):
                title = _as_str(first.get("title"))

        project = item.get("project") or {}
        project_block: dict | None = None
        if isinstance(project, dict):
            p_id = _as_str(project.get("id"))
            p_name = _as_str(project.get("name"))
            if p_id or p_name:
                project_block = {}
                if p_id:
                    project_block["id"] = p_id
                if p_name:
                    project_block["name"] = p_name

        record: dict = {
            "_id": item_id,
            "titleInfo": [{"title": title or "Untitled"}],
        }
        rtype = _as_str(item.get("typeOfResource"))
        if rtype:
            record["typeOfResource"] = rtype
        if project_block:
            record["project"] = project_block
        dre = _as_str(item.get("dre_id"))
        if dre and dre != item_id:
            record["dre_id"] = dre

        # Location block (origins + current) — needed by the LocationMap
        # cluster-popup matcher in `src/lib/components/charts/map/markerBuilder.ts`,
        # which filters items by `location.origin[].l1/l2/l3` and
        # `location.current[]`. Kept slim: only the three origin levels
        # and the current-location list, nothing else.
        location = item.get("location") or {}
        if isinstance(location, dict):
            origin_out: list[dict] = []
            for origin in location.get("origin") or []:
                if not isinstance(origin, dict):
                    continue
                parts: dict[str, str] = {}
                for key in ("l1", "l2", "l3"):
                    v = _as_str(origin.get(key))
                    if v:
                        parts[key] = v
                if parts:
                    origin_out.append(parts)
            current_out: list[str] = []
            for current in location.get("current") or []:
                label = _as_str(current)
                if label:
                    current_out.append(label)
            loc_block: dict = {}
            if origin_out:
                loc_block["origin"] = origin_out
            if current_out:
                loc_block["current"] = current_out
            if loc_block:
                record["location"] = loc_block

        out.append(record)
    return out


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
