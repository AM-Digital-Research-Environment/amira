"""
Per-entity generators for the dashboard precompute pipeline.

Each `generate_<entity>_dashboard()` composes `build_*` aggregators from
`aggregators.py` into the JSON payload consumed by `<EntityDashboard>` on
the matching frontend detail page.

Layouts are defined in `src/lib/components/dashboards/entityDashboardLayouts.ts`.
Keep the set of keys emitted here aligned with the ChartSlots declared there;
extra keys are harmless, missing keys fall back to the "No data available"
state inside `<ChartSlot>`.
"""

from __future__ import annotations

from collections import defaultdict

from . import aggregators as agg


# --------------------------------------------------------------------------
# Languages
# --------------------------------------------------------------------------


def _filter_by_language(items: list[dict], code: str) -> list[dict]:
    """Return only items tagged with the given language code.

    Normalises B/T variants (e.g. `fre` ↔ `fra`) so a request for either form
    returns the union of matching items.
    """
    canonical = agg.normalize_language_code(code)
    return [
        item
        for item in items
        if canonical in {agg.normalize_language_code(c) for c in agg._language_codes(item)}
    ]


def language_index(items: list[dict]) -> dict[str, list[dict]]:
    """Group items by each canonical language code they carry."""
    index: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        # Dedupe within an item so an item listing "fre" and "fra" doesn't
        # appear twice under the canonical "fra" bucket.
        seen: set[str] = set()
        for code in agg._language_codes(item):
            canonical = agg.normalize_language_code(code)
            if canonical in seen:
                continue
            seen.add(canonical)
            index[canonical].append(item)
    return index


def generate_language_dashboard(
    code: str,
    items: list[dict],
    display_name: str | None = None,
) -> dict:
    """
    Build the dashboard payload for a single language.

    Pass the full archive as `items`; this function filters internally.
    Returns a dict ready to be JSON-serialized to
    `static/data/entity_dashboards/languages/<code>.json`.
    """
    filtered = _filter_by_language(items, code)
    name = display_name or agg.language_name(code)

    return {
        "meta": agg.build_meta("language", agg.normalize_language_code(code), name, filtered),
        "timeline": agg.build_timeline(filtered),
        "stackedTimeline": agg.build_stacked_timeline(filtered),
        "types": agg.build_types(filtered),
        "languages": agg.build_languages(filtered, exclude=code),
        "heatmap": agg.build_heatmap_type_decade(filtered),
        "subjects": agg.build_subjects(filtered),
        "wordCloud": agg.build_word_cloud(filtered),
        "contributors": agg.build_contributors(filtered),
        "locations": agg.build_locations(filtered),
        # subjectTrends / subject-over-time lands in Phase 4 when the stacked-
        # area component ships. Slot is reserved in the layout.
    }


# --------------------------------------------------------------------------
# Placeholders for upcoming entity generators (Phase 2)
# --------------------------------------------------------------------------
#
# generate_subject_dashboard(...)
# generate_person_dashboard(...)
# generate_institution_dashboard(...)
# generate_location_dashboard(...)
# generate_genre_dashboard(...)
# generate_resource_type_dashboard(...)
# generate_group_dashboard(...)
# generate_research_section_dashboard(...)
# generate_project_dashboard(...)
#
# Each becomes its own issue under AM-Digital-Research-Environment/amira#10.
