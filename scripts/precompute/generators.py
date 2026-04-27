"""
Per-entity generators for the dashboard precompute pipeline.

Each `generate_<entity>_dashboard()` composes `build_*` aggregators from
`aggregators.py` into the JSON payload consumed by `<EntityDashboard>` on
the matching frontend detail page.

Layouts are defined in `src/lib/components/dashboards/entityDashboardLayouts.ts`.
Keep the set of keys emitted here aligned with the ChartSlots declared there;
extra keys are harmless, missing keys are filtered out by `shouldRenderSlot`.

Each generator expects the *full* archive as `items` and filters internally.
Callers stay dumb: "run this for every code/name/slug" is one loop, not a
nested filter step that every caller has to reproduce.
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
        "subjectTrends": agg.build_subject_trends(filtered),
        "locations": agg.build_locations(filtered),
        "items": agg.build_item_summaries(filtered),
    }


# --------------------------------------------------------------------------
# Subjects & Tags
# --------------------------------------------------------------------------


def subject_index(items: list[dict]) -> dict[str, list[dict]]:
    """Group items by each distinct subject label (authLabel || origLabel)."""
    index: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        seen: set[str] = set()
        for label in agg._subject_labels(item):
            if label in seen:
                continue
            seen.add(label)
            index[label].append(item)
    return index


def tag_index(items: list[dict]) -> dict[str, list[dict]]:
    """Group items by each distinct top-level tag."""
    index: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        seen: set[str] = set()
        for label in agg._tag_labels(item):
            if label in seen:
                continue
            seen.add(label)
            index[label].append(item)
    return index


def generate_subject_dashboard(name: str, items: list[dict]) -> dict:
    filtered = [item for item in items if name in agg._subject_labels(item)]
    return {
        "meta": agg.build_meta("subject", agg.slugify(name), name, filtered),
        "timeline": agg.build_timeline(filtered),
        "stackedTimeline": agg.build_stacked_timeline(filtered),
        "types": agg.build_types(filtered),
        "languages": agg.build_languages(filtered),
        "subjects": agg.build_subjects(filtered, exclude=name),
        # `coSubjects` reuses the existing `build_chord` aggregator — same
        # shape, but the slot's title in the layout reads "Co-occurring
        # subjects" rather than the generic "Co-occurrence".
        "coSubjects": agg.build_chord(filtered),
        "wordCloud": agg.build_word_cloud(filtered, exclude=name),
        "contributors": agg.build_contributors(filtered),
        "locations": agg.build_locations(filtered),
        "items": agg.build_item_summaries(filtered),
    }


def generate_tag_dashboard(name: str, items: list[dict]) -> dict:
    filtered = [item for item in items if name in agg._tag_labels(item)]
    return {
        "meta": agg.build_meta("tag", agg.slugify(name), name, filtered),
        "timeline": agg.build_timeline(filtered),
        "stackedTimeline": agg.build_stacked_timeline(filtered),
        "types": agg.build_types(filtered),
        "languages": agg.build_languages(filtered),
        "subjects": agg.build_subjects(filtered),
        "coSubjects": agg.build_chord(filtered),
        "wordCloud": agg.build_word_cloud(filtered, exclude=name),
        "contributors": agg.build_contributors(filtered),
        "locations": agg.build_locations(filtered),
        "items": agg.build_item_summaries(filtered),
    }


# --------------------------------------------------------------------------
# Genres
# --------------------------------------------------------------------------


def genre_index(items: list[dict]) -> dict[str, list[dict]]:
    index: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        seen: set[str] = set()
        for label in agg._genre_labels(item):
            if label in seen:
                continue
            seen.add(label)
            index[label].append(item)
    return index


def generate_genre_dashboard(name: str, items: list[dict]) -> dict:
    filtered = [item for item in items if name in agg._genre_labels(item)]
    return {
        "meta": agg.build_meta("genre", agg.slugify(name), name, filtered),
        "timeline": agg.build_timeline(filtered),
        "stackedTimeline": agg.build_stacked_timeline(filtered),
        "types": agg.build_types(filtered),
        "languages": agg.build_languages(filtered),
        "subjects": agg.build_subjects(filtered),
        "wordCloud": agg.build_word_cloud(filtered),
        "contributors": agg.build_contributors(filtered),
        "locations": agg.build_locations(filtered),
        "items": agg.build_item_summaries(filtered),
    }


# --------------------------------------------------------------------------
# Resource types
# --------------------------------------------------------------------------


def resource_type_index(items: list[dict]) -> dict[str, list[dict]]:
    index: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        index[agg._type_of_resource(item)].append(item)
    return index


def generate_resource_type_dashboard(name: str, items: list[dict]) -> dict:
    filtered = [item for item in items if agg._type_of_resource(item) == name]
    return {
        "meta": agg.build_meta("resource-type", agg.slugify(name), name, filtered),
        "timeline": agg.build_timeline(filtered),
        "stackedTimeline": agg.build_stacked_timeline(filtered),
        "languageTimeline": agg.build_language_timeline(filtered),
        "subjectTrends": agg.build_subject_trends(filtered),
        # No co-occurring types chart because every filtered item has the
        # same typeOfResource. `heatmap` (language × decade) is more useful.
        "languages": agg.build_languages(filtered),
        "heatmap": _build_heatmap_language_decade(filtered),
        "subjects": agg.build_subjects(filtered),
        "wordCloud": agg.build_word_cloud(filtered),
        "contributors": agg.build_contributors(filtered),
        "locations": agg.build_locations(filtered),
        "items": agg.build_item_summaries(filtered),
    }


def _build_heatmap_language_decade(items: list[dict]) -> list[dict]:
    """Heatmap variant: language (y) × decade (x).

    Lives here rather than `aggregators.py` because it's only used by the
    resource-type dashboard today and we haven't yet decided whether to
    promote it into the shared toolkit.
    """
    from collections import Counter

    counts: Counter[tuple[str, str]] = Counter()
    for item in items:
        year = agg._item_year(item)
        if year is None:
            continue
        decade = f"{(year // 10) * 10}s"
        langs = {agg.normalize_language_code(c) for c in agg._language_codes(item)}
        if not langs:
            continue
        for code in langs:
            counts[(decade, agg.language_name(code))] += 1
    return [
        {"x": decade, "y": lang, "value": count}
        for (decade, lang), count in sorted(counts.items())
    ]


# --------------------------------------------------------------------------
# Groups
# --------------------------------------------------------------------------


def group_index(items: list[dict]) -> dict[str, list[dict]]:
    index: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        seen: set[str] = set()
        for label in agg._names_with_qualifier(item, "group"):
            if label in seen:
                continue
            seen.add(label)
            index[label].append(item)
    return index


def generate_group_dashboard(name: str, items: list[dict]) -> dict:
    filtered = [item for item in items if name in agg._names_with_qualifier(item, "group")]
    return {
        "meta": agg.build_meta("group", agg.slugify(name), name, filtered),
        "timeline": agg.build_timeline(filtered),
        "types": agg.build_types(filtered),
        "languages": agg.build_languages(filtered),
        "subjects": agg.build_subjects(filtered),
        "wordCloud": agg.build_word_cloud(filtered),
        "contributors": agg.build_contributors(filtered, exclude=name),
        "locations": agg.build_locations(filtered),
        "items": agg.build_item_summaries(filtered),
    }


# --------------------------------------------------------------------------
# People
# --------------------------------------------------------------------------


def person_index(items: list[dict]) -> dict[str, list[dict]]:
    index: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        seen: set[str] = set()
        for label in agg._names_with_qualifier(item, "person"):
            if label in seen:
                continue
            seen.add(label)
            index[label].append(item)
    return index


def generate_person_dashboard(name: str, items: list[dict]) -> dict:
    filtered = [item for item in items if name in agg._names_with_qualifier(item, "person")]
    return {
        "meta": agg.build_meta("person", agg.slugify(name), name, filtered),
        "timeline": agg.build_timeline(filtered),
        "stackedTimeline": agg.build_stacked_timeline(filtered),
        "types": agg.build_types(filtered),
        "languages": agg.build_languages(filtered),
        "subjects": agg.build_subjects(filtered),
        "wordCloud": agg.build_word_cloud(filtered),
        "roles": _build_person_roles(filtered, name),
        "contributors": agg.build_contributors(filtered, exclude=name),
        # Co-credited persons chord — exclude the person themself so the
        # matrix shows *between-co-contributor* links, not links radiating
        # outward from the centre node (which would saturate every cell).
        # NOT academic co-authorship — covers all MARC roles (photographer,
        # interviewee, editor, ...).
        "coContributors": agg.build_co_contributors(filtered, exclude=name),
        # Person↔project bipartite: the projects this person worked on,
        # plus their other collaborators across those projects. Excluding
        # the person from the network avoids a degenerate "everyone
        # connects to me" centre that crowds out the interesting
        # secondary structure.
        "contributorNetwork": agg.build_contributor_network(
            filtered, target="project", exclude_person=name
        ),
        # Person↔institution bipartite (affiliationNetwork). The slot is
        # only useful when the person's items carry institutional
        # affiliations; if they don't, the empty payload triggers the
        # frontend's `shouldRenderSlot` filter.
        "affiliationNetwork": agg.build_contributor_network(
            filtered, target="institution", exclude_person=name
        ),
        "locations": agg.build_locations(filtered),
        "items": agg.build_item_summaries(filtered),
    }


def _build_person_roles(items: list[dict], person_name: str) -> list[dict]:
    """Roles that *this specific person* is credited with across items."""
    from collections import Counter

    counts: Counter[str] = Counter()
    for item in items:
        for block in item.get("name") or []:
            if not isinstance(block, dict):
                continue
            nm = block.get("name") or {}
            if agg._as_str(nm.get("label")) != person_name:
                continue
            roles = block.get("role") or []
            if isinstance(roles, list):
                for role in roles:
                    if isinstance(role, dict):
                        label = agg._as_str(role.get("label"))
                        if label:
                            counts[label] += 1
    return [
        {"name": name, "value": count}
        for name, count in counts.most_common()
    ]


# --------------------------------------------------------------------------
# Institutions
# --------------------------------------------------------------------------


def institution_index(items: list[dict]) -> dict[str, list[dict]]:
    """Group by institution — union of direct `name.qualifier=institution`
    entries *and* affiliations referenced on any contributor of the item."""
    index: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        seen: set[str] = set()
        for label in agg._names_with_qualifier(item, "institution"):
            seen.add(label)
        for label in agg._affiliations(item):
            seen.add(label)
        for label in seen:
            index[label].append(item)
    return index


def generate_institution_dashboard(name: str, items: list[dict]) -> dict:
    def matches(item: dict) -> bool:
        return (
            name in agg._names_with_qualifier(item, "institution")
            or name in agg._affiliations(item)
        )

    filtered = [item for item in items if matches(item)]
    return {
        "meta": agg.build_meta("institution", agg.slugify(name), name, filtered),
        "timeline": agg.build_timeline(filtered),
        "stackedTimeline": agg.build_stacked_timeline(filtered),
        "types": agg.build_types(filtered),
        "languages": agg.build_languages(filtered),
        "subjects": agg.build_subjects(filtered),
        "wordCloud": agg.build_word_cloud(filtered),
        "contributors": agg.build_contributors(filtered),
        # Person↔project bipartite — affiliated contributors and the projects
        # they touched while connected to this institution.
        "contributorNetwork": agg.build_contributor_network(
            filtered, target="project"
        ),
        # Affiliated contributors↔institutions (other institutions the
        # contributors are linked to). `exclude_target` removes the host
        # institution so the network shows the *outward* affiliations,
        # not links radiating from the centre node.
        "affiliationNetwork": agg.build_contributor_network(
            filtered, target="institution", exclude_target=name
        ),
        "locations": agg.build_locations(filtered),
        "items": agg.build_item_summaries(filtered),
    }


# --------------------------------------------------------------------------
# Locations
# --------------------------------------------------------------------------


def location_index(items: list[dict]) -> dict[str, list[dict]]:
    """Group items by every country / region / city / current-location name.

    One item may contribute to multiple buckets (e.g. an item whose origin
    is "Kano / Nigeria" will appear under both "Kano" and "Nigeria"). The
    frontend location page also treats an arbitrary name as a lookup key
    across all four slots, so this matches the UX.
    """
    index: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        seen: set[str] = set()
        for label in _location_names_full(item):
            if label in seen:
                continue
            seen.add(label)
            index[label].append(item)
    return index


def _location_names_full(item: dict) -> list[str]:
    """Like `agg._location_names()` but includes every level; dedup lives in
    the caller when it matters."""
    return agg._location_names(item)


def generate_location_dashboard(name: str, items: list[dict]) -> dict:
    filtered = [item for item in items if name in _location_names_full(item)]
    return {
        "meta": agg.build_meta("location", agg.slugify(name), name, filtered),
        "timeline": agg.build_timeline(filtered),
        "stackedTimeline": agg.build_stacked_timeline(filtered),
        "types": agg.build_types(filtered),
        "languages": agg.build_languages(filtered),
        "subjects": agg.build_subjects(filtered),
        "wordCloud": agg.build_word_cloud(filtered),
        "contributors": agg.build_contributors(filtered),
    }


# --------------------------------------------------------------------------
# Research sections
# --------------------------------------------------------------------------


def research_section_index(
    items: list[dict], projects: list[dict]
) -> dict[str, list[dict]]:
    """Group items by each research-section label (via project.id → section)."""
    # project_id -> list[section_name]
    project_sections: dict[str, list[str]] = {}
    for project in projects:
        pid = agg._as_str(project.get("id"))
        if not pid:
            continue
        sections = project.get("researchSection") or []
        if not isinstance(sections, list):
            continue
        cleaned = [agg._as_str(s) for s in sections]
        project_sections[pid] = [s for s in cleaned if s]

    index: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        pid = agg._as_str((item.get("project") or {}).get("id"))
        if not pid:
            continue
        for section in project_sections.get(pid, []):
            index[section].append(item)
    return index


def generate_research_section_dashboard(
    name: str,
    items: list[dict],
    projects: list[dict],
    geo: dict | None = None,
) -> dict:
    # Project ids belonging to this section.
    section_projects: set[str] = set()
    for project in projects:
        sections = project.get("researchSection") or []
        if not isinstance(sections, list):
            continue
        if name in sections:
            pid = agg._as_str(project.get("id"))
            if pid:
                section_projects.add(pid)

    filtered = [
        item
        for item in items
        if agg._as_str((item.get("project") or {}).get("id")) in section_projects
    ]

    geo_flows: dict | None = None
    if geo:
        geo_flows = agg.build_geo_flows(filtered, geo)

    return {
        "meta": agg.build_meta("research-section", agg.slugify(name), name, filtered),
        "timeline": agg.build_timeline(filtered),
        "stackedTimeline": agg.build_stacked_timeline(filtered),
        "languageTimeline": agg.build_language_timeline(filtered),
        "subjectTrends": agg.build_subject_trends(filtered),
        "types": agg.build_types(filtered),
        "languages": agg.build_languages(filtered),
        "heatmap": agg.build_heatmap_type_decade(filtered),
        "subjects": agg.build_subjects(filtered),
        "wordCloud": agg.build_word_cloud(filtered),
        "contributors": agg.build_contributors(filtered),
        # Section-level contributor network: who works on which project
        # within this section. Caps in `build_contributor_network` keep
        # the layout legible for sections with hundreds of items.
        "contributorNetwork": agg.build_contributor_network(
            filtered, target="project"
        ),
        # Time-aware subject co-occurrence — sections evolve over decades,
        # so the slider actually has something interesting to show.
        "timeAwareChord": agg.build_time_aware_chord(filtered),
        # Origin → current arcs (only when geo index is provided).
        **({"geoFlows": geo_flows} if geo_flows else {}),
        "boxPlot": agg.build_box_plot_per_project(filtered),
        "locations": agg.build_locations(filtered),
        "items": agg.build_item_summaries(filtered),
    }


# --------------------------------------------------------------------------
# Projects
# --------------------------------------------------------------------------


def project_index(items: list[dict]) -> dict[str, list[dict]]:
    """Group items by their containing project id."""
    index: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        project = item.get("project") or {}
        if not isinstance(project, dict):
            continue
        pid = agg._as_str(project.get("id"))
        if not pid:
            continue
        index[pid].append(item)
    return index


def project_name_lookup(items: list[dict]) -> dict[str, str]:
    """Map each project id to its human-readable name, falling back to id."""
    out: dict[str, str] = {}
    for item in items:
        project = item.get("project") or {}
        if not isinstance(project, dict):
            continue
        pid = agg._as_str(project.get("id"))
        name = agg._as_str(project.get("name"))
        if pid and name and pid not in out:
            out[pid] = name
    return out


def generate_project_dashboard(
    project_id: str,
    items: list[dict],
    display_name: str | None = None,
    geo: dict | None = None,
) -> dict:
    """Dashboard for a single project — every item whose `project.id` matches."""
    filtered = [
        item
        for item in items
        if agg._as_str(((item.get("project") or {}) or {}).get("id")) == project_id
    ]
    name = display_name or (
        agg._as_str(((filtered[0].get("project") or {}) if filtered else {}).get("name"))
        or project_id
    )

    geo_flows: dict | None = None
    if geo:
        geo_flows = agg.build_geo_flows(filtered, geo)

    return {
        "meta": agg.build_meta("project", project_id, name, filtered),
        "timeline": agg.build_timeline(filtered),
        "stackedTimeline": agg.build_stacked_timeline(filtered),
        "languageTimeline": agg.build_language_timeline(filtered),
        "subjectTrends": agg.build_subject_trends(filtered),
        "types": agg.build_types(filtered),
        "languages": agg.build_languages(filtered),
        "roles": agg.build_roles(filtered),
        "heatmap": agg.build_heatmap_type_decade(filtered),
        "subjects": agg.build_subjects(filtered),
        "wordCloud": agg.build_word_cloud(filtered),
        "sunburst": agg.build_sunburst(filtered),
        "treemap": agg.build_treemap(filtered),
        "sankey": agg.build_sankey(filtered),
        "chord": agg.build_chord(filtered),
        # Time-aware variant — same chord, but year-bucketed cumulatively
        # so the slider can replay how the subject network filled in.
        "timeAwareChord": agg.build_time_aware_chord(filtered),
        "contributors": agg.build_contributors(filtered),
        # Project contributor network — every contributor on this project
        # plus the projects their other items also belong to (capped to
        # the top-N). For projects with many one-off contributors this
        # often degenerates to a single-target hub; the empty-payload
        # filter handles that gracefully.
        "contributorNetwork": agg.build_contributor_network(
            filtered, target="project", exclude_target=project_id
        ),
        "calendarHeatmap": agg.build_calendar_heatmap(filtered),
        # Origin → current arcs. Only emitted when the orchestrator passes
        # a geo index — otherwise the front-end's `shouldRenderSlot` filter
        # hides the slot.
        **({"geoFlows": geo_flows} if geo_flows else {}),
        "locations": agg.build_locations(filtered),
        "items": agg.build_item_summaries(filtered),
    }


# --------------------------------------------------------------------------
# Placeholders for upcoming entity generators (Phase 2 tail)
# --------------------------------------------------------------------------
#
# generate_research_item_dashboard() — /research-items/[id] context strip
#
# Each becomes its own follow-up under AM-Digital-Research-Environment/amira#10.
