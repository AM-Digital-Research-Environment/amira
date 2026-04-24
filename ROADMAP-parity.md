# Visualization Parity Roadmap

Tracks work for [issue #10](https://github.com/AM-Digital-Research-Environment/amira/issues/10) — bring the WissKI dashboard and the [Omeka S `ResourceVisualizations` module](https://github.com/fmadore/ResourceVisualizations) to analytical parity.

The two projects are complementary today:

- **Dashboard** is broad-overview-heavy: rich cross-cutting tools (`/network`, `/semantic-map`, `/project-explorer`, `/compare-projects`, `/whats-new`), weak per-entity detail pages.
- **Module** is per-entity-heavy: every entity type has a full 7-to-19-chart dashboard rendered inline on the Omeka page, but no cross-cutting analytics.

A user should find roughly the same analytical toolkit on either side. This roadmap covers the dashboard half of the parity work. The module half lives in [ResourceVisualizations/ROADMAP-parity.md](https://github.com/fmadore/ResourceVisualizations/blob/main/ROADMAP-parity.md).

## Current state — parity matrix

Module's per-entity coverage vs. dashboard's current per-entity pages:

| Entity            | Module (precomputed dashboard)                                                                                                            | Dashboard list page                           | Dashboard detail page             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------- |
| Research Sections | 19 charts (stacked timeline, gantt, beeswarm, language timeline, heatmap, chord, sankey, subject trends, sunburst, treemap, geo flows, …) | Bar + Gantt                                   | **empty**                         |
| Projects          | 16 charts                                                                                                                                 | Timeline + 2 bars + Gantt + Beeswarm + facets | WordCloud + 2 pies + 1 bar + KG   |
| People            | 7 charts incl. co-authors, contributor network                                                                                            | faceted grid                                  | **KG only**                       |
| Institutions      | 9 charts incl. collab network, affiliation network                                                                                        | logo cards + grid                             | **KG only**                       |
| Locations         | 7 charts incl. self-location minimap                                                                                                      | MiniMap + grid                                | MiniMap + KG                      |
| Subjects / LCSH   | 7 charts incl. co-subjects, subject trends                                                                                                | WordCloud + grid                              | **KG only**                       |
| Languages         | 7 charts incl. stacked timeline, heatmap, subject trends                                                                                  | grid                                          | **empty**                         |
| Resource Types    | 7 charts                                                                                                                                  | Pie + Bar + grid                              | **empty**                         |
| Genres            | 7 charts                                                                                                                                  | Bar top 20 + grid                             | **KG only**                       |
| Tags              | 7 charts                                                                                                                                  | (folded into /subjects)                       | (folded into /subjects)           |
| Groups            | 7 charts                                                                                                                                  | grid                                          | **empty**                         |
| Research Items    | KG + location map + per-template dashboard                                                                                                | faceted list                                  | **MiniMap only — KG is missing!** |

Dashboard-only capabilities (nothing equivalent in module): Semantic Embeddings scatter, Discursive Communities (Louvain + PageRank), Photo masonry/timeline/map, Gantt + Beeswarm on the Projects list, cross-entity Compare UI, "What's New" feed, Project Explorer, faceted list pages, home-page Section × University heatmap, University logo cards.

Module-only capabilities (biggest detail-page gaps to fill here): Stacked Timeline, Language Timeline, Heatmap (type × language), Chord (subject co-occurrence), Sankey, Sunburst, Treemap, Subject Trends, Geo Flow Map, Contributor Roles pie, Contributor Network, Co-authors, Co-subjects, per-entity Contributors bar, Self-location MiniMap.

---

## Architecture decisions

Locked in during the design discussion for #10:

### 1. `EntityDashboard` layout system (mirrors the module)

The module defines per-resource-type chart layouts in `asset/js/dashboard-layouts.js`. Detail pages then render the right charts in the right order, with per-slot `wide`/`tall` hints. We'll mirror this pattern.

```ts
// src/lib/components/dashboards/entityDashboardLayouts.ts
export type ChartKey =
	| 'timeline'
	| 'stackedTimeline'
	| 'languageTimeline'
	| 'types'
	| 'languages'
	| 'subjects'
	| 'contributors'
	| 'wordCloud'
	| 'heatmap'
	| 'chord'
	| 'sankey'
	| 'sunburst'
	| 'treemap'
	| 'subjectTrends'
	| 'gantt'
	| 'beeswarm'
	| 'geoFlows'
	| 'locations'
	| 'selfLocation'
	| 'choropleth'
	| 'coAuthors'
	| 'coSubjects'
	| 'roles'
	| 'affiliationNetwork'
	| 'collabNetwork'
	| 'contributorNetwork'
	| 'calendarHeatmap'
	| 'radar'
	| 'timeAwareChord'
	| 'boxPlot'
	| 'knowledgeGraph'
	| 'similarItems';

export interface ChartSlot {
	chart: ChartKey;
	title?: string; // override default label
	wide?: boolean; // spans full grid width
	tall?: boolean; // taller aspect ratio
	cond?: (d: EntityData) => boolean; // conditionally render
}

export interface EntityLayout {
	entity: EntityType;
	charts: ChartSlot[];
	showUniversityFilter: boolean;
}
```

```svelte
<!-- src/lib/components/dashboards/EntityDashboard.svelte -->
<script lang="ts">
	let { layout, data }: { layout: EntityLayout; data: EntityDashboardData } = $props();
</script>

<div class="entity-dashboard">
	{#if layout.showUniversityFilter}<UniversityFilter />{/if}
	<div class="dashboard-grid">
		{#each layout.charts as slot (slot.chart)}
			{#if !slot.cond || slot.cond(data)}
				<ChartSlot {slot} chartData={data[slot.chart]} />
			{/if}
		{/each}
	</div>
</div>
```

Each entity detail page becomes a thin wrapper that loads data and passes a layout.

### 2. Precompute per-entity JSON (mirrors the module)

The module's `scripts/precompute/` generates `asset/data/item-dashboards/{id}.json` per entity. We'll add the equivalent:

```
scripts/
  precompute_entity_dashboards.py    # NEW — orchestrator
  precompute/                         # NEW — modular package
    __init__.py
    config.py                         # entity type registry, output paths
    db.py                             # MongoDB helpers (reuses fetch_from_mongodb patterns)
    aggregators.py                    # build_timeline(), build_heatmap(), build_chord() …
    generators.py                     # generate_language_dashboard(), etc.
static/data/entity_dashboards/        # NEW — one JSON per entity instance
  languages/{code}.json
  subjects/{slug}.json
  people/{slug}.json
  institutions/{slug}.json
  genres/{slug}.json
  resource-types/{slug}.json
  groups/{slug}.json
  locations/{slug}.json
  research-sections/{slug}.json
  projects/{id}.json
  tags/{slug}.json
```

Each JSON contains ALL the aggregates for ALL charts on that entity's detail page — e.g. `languages/hausa.json` has keys `timeline`, `stackedTimeline`, `types`, `subjects`, `contributors`, etc.

**Why precompute:** some charts (chord, sankey, subject trends, networks) are expensive to aggregate from the 2,200+ raw collection items every time a detail page loads. Matches the module's choice and gives us fast static loads.

### 3. Hybrid fallback

Simple charts (basic timelines, top-N bars) can still be computed on-the-fly in Svelte using `$derived.by()` against loaded stores, as they already are on list pages. The precompute pipeline is for the heavy stuff.

### 4. University filter scope

Applied on detail pages **only where it changes the data meaningfully**:

| Entity                                                       | University filter                   |
| ------------------------------------------------------------ | ----------------------------------- |
| Projects, People, Institutions, Groups, Research Sections    | ✅ on                               |
| Languages, Subjects, Genres, Resource Types, Locations, Tags | ❌ off (cross-university by nature) |

---

## Phase 1 — Foundations

Unlock everything else. No user-visible changes yet.

- [ ] **EntityDashboard system**
  - [ ] `src/lib/components/dashboards/EntityDashboard.svelte` — generic grid
  - [ ] `src/lib/components/dashboards/ChartSlot.svelte` — dispatches to the right chart component by `ChartKey`
  - [ ] `src/lib/components/dashboards/entityDashboardLayouts.ts` — `ENTITY_LAYOUTS` record (empty first, then filled during Phase 2)
  - [ ] Wire `.dashboard-grid` CSS to match the module's 2-column with wide/tall slots
- [ ] **Precompute pipeline**
  - [ ] `scripts/precompute_entity_dashboards.py` (thin orchestrator)
  - [ ] `scripts/precompute/` package (aggregators + generators)
  - [ ] Reuse MongoDB connection helpers from `scripts/fetch_from_mongodb.py`
  - [ ] Port the module's `build_*` patterns from `ResourceVisualizations/scripts/precompute/aggregators.py` (same chart shapes → same algorithms)
  - [ ] Output manifest: `static/data/entity_dashboards/manifest.json` listing generated IDs per type
- [ ] **Loader utility**
  - [ ] `src/lib/utils/loaders/entityDashboardLoader.ts` — `loadEntityDashboard(type, id)` with `tryLoadJSON` + `transformMongoJSON`
- [ ] **CI step**
  - [ ] Regenerate script task + note in `CLAUDE.md`

---

## Phase 2 — Detail-page parity

Build full per-entity detail-page dashboards. Each page gets a `ChartSlot[]` layout. List below is the **proposed default layout per entity** — tweakable as we implement.

**Detail-page layout convention.** On every entity detail page, the order is:

1. `BackToList`
2. `EntityDetailHeader`
3. `EntityItemsCard` — the list of matching research items (primary content)
4. `<EntityDashboard>` — the charts follow the list, not precede it

Rationale: users clicking into an entity usually want to see "what's here" before "how it decomposes". The dashboard adds analytical depth below the list.

### `/languages/[code]` — currently empty

`timeline`, `stackedTimeline`(wide), `types`, `languages`[co-occurring], `heatmap`(type×year), `subjects`, `wordCloud`, `contributors`, `subjectTrends`(wide), `locations` map, `choropleth`

### `/subjects/[slug]` and `/tags/[slug]` — currently KG only

`timeline`, `stackedTimeline`(wide), `types`, `languages`, `coSubjects`(chord, wide), `contributors`, `subjectTrends`(wide), `locations`, `knowledgeGraph`(wide,tall) — KG moves into the dashboard grid

### `/people/[slug]` — currently KG only

`timeline`, `stackedTimeline`(wide), `types`, `languages`, `subjects`, `wordCloud`, `roles`, `coAuthors`, `contributorNetwork`(wide,tall), `affiliationNetwork`, `locations`, `knowledgeGraph`(wide,tall)

### `/institutions/[slug]` — currently KG only

`timeline`, `stackedTimeline`(wide), `types`, `languages`, `roles`, `subjects`, `wordCloud`, `contributors`, `collabNetwork`(wide,tall), `affiliationNetwork`(wide,tall), `locations`, `knowledgeGraph`

### `/locations/[slug]` — currently MiniMap + KG

`selfLocation`(wide), `timeline`, `stackedTimeline`(wide), `types`, `languages`, `subjects`, `wordCloud`, `contributors`, `knowledgeGraph`

### `/genres/[slug]` — currently KG only

`timeline`, `stackedTimeline`(wide, by language), `languages`, `subjects`, `wordCloud`, `contributors`, `locations`, `knowledgeGraph`

### `/resource-types/[slug]` — currently empty

`timeline`, `stackedTimeline`(wide, by language), `languages`, `heatmap`(language×year), `subjects`, `wordCloud`, `subjectTrends`(wide), `contributors`, `locations`

### `/groups/[slug]` — currently empty

`timeline`, `types`, `languages`, `subjects`, `contributors` (members bar), `locations`, `knowledgeGraph`

### `/research-sections/[slug]` — currently empty (8–10 core charts)

`stackedTimeline`(wide), `gantt`(wide), `beeswarm`(wide), `heatmap`, `languageTimeline`(wide), `subjects`+`wordCloud`, `subjectTrends`(wide), `contributorNetwork`(wide,tall), `locations`, `geoFlows`(wide)

### `/projects/[id]` — currently WordCloud + 2 pies + 1 bar + KG

Full parity with module's project dashboard: `stackedTimeline`(wide), `languageTimeline`(wide), `timeline`, `types`, `languages`, `roles`, `heatmap`, `subjects`+`wordCloud`, `subjectTrends`(wide), `sunburst`, `treemap`, `chord`, `sankey`(wide), `geoFlows`(wide), `locations`, `contributorNetwork`(wide,tall), `knowledgeGraph`

### `/research-items/[id]` — currently MiniMap only

**Enriched context** layout (not a full dashboard):

- `knowledgeGraph`(wide,tall) — NEW; the KG for a single item is the biggest existing gap
- `selfLocation` — reuse the MiniMap that's already there
- Context strip (not charts, plain UI):
  - Type + language chips
  - Contributor role list with MARC relator badges
  - Timeline strip of sibling items in the same project (tiny sparkline)
  - `similarItems` — 5–10 semantic-kNN matches if embeddings exist for this item

### Tasks per entity

For each entity page above:

- [ ] Add `ENTITY_LAYOUTS[<entity>]` entry
- [ ] Update `+page.svelte` to call `loadEntityDashboard()` + render `<EntityDashboard>`
- [ ] Extend `precompute/generators.py` with `generate_<entity>_dashboard()`
- [ ] Verify charts render against 3 real entity samples
- [ ] File follow-up issue if a chart type is not yet implemented

---

## Phase 3 — List-page enrichment

Add aggregate charts to list pages that currently are browse-grid-only. These use on-the-fly aggregation from loaded stores — no new precompute.

### `/languages`

- `stackedTimeline`(by language, wide) — language activity over time
- `heatmap` (language × resource type)
- `choropleth` (geographic distribution of language use)

### `/subjects`

- `subjectTrends`(wide) — top-10 subjects over time
- `coSubjects` preview (chord, top-20)
- LCSH vs. tag split (pie)

### `/genres`

- Timeline of top-20 genres (stacked bar)
- `heatmap` (genre × language)

### `/resource-types`

- `stackedTimeline`(wide, by type)
- `heatmap` (type × language)

### `/groups`

- Top-N groups bar
- Members-per-group distribution (`boxPlot`)

### `/people`

- Roles distribution (pie) across whole archive
- Optional: activity calendar heatmap of contribution density

### `/institutions`

- `collabNetwork` preview (top collaborating institutions)
- Geographic reach (`choropleth`)

### `/locations`

- `choropleth` by country — complements existing MiniMap
- Cities bar (top-20)
- Timeline of location-tagged items per year

---

## Phase 4 — New chart types

Net-new components, reusable across both list and detail pages.

- [ ] **Calendar Heatmap** — ECharts calendar + heatmap series. Used on `/whats-new`, `/people/[id]` (activity), `/projects/[id]`.
- [ ] **Choropleth Map** — MapLibre fill-layer on country GeoJSON (shared with module, same Natural Earth source). Used on `/locations`, `/languages/[code]`, home page.
- [ ] **Radar Chart** — 5–7 axis entity profile (items, languages, subjects, contributors, year span, geographic reach, co-author density). Used on `/people/[id]`, `/institutions/[id]`, `/projects/[id]`, and the Compare UI.
- [ ] **Time-aware Chord** — chord diagram + year slider. Used on `/projects/[id]`, `/research-sections/[slug]`, `/subjects`.
- [ ] **Box Plot / Violin** — ECharts boxplot. Used on `/research-sections` (items-per-project distribution), `/groups`, `/institutions`.

Each lands as `src/lib/components/charts/{ChartName}.svelte` with an accompanying registry entry. Reuse the existing `EChart.svelte` wrapper.

---

## Phase 5 — Cross-cutting: generalize Compare

Replace `/compare-projects` with `/compare/[type]` (e.g. `/compare/projects`, `/compare/people`, `/compare/institutions`, `/compare/subjects`, `/compare/languages`, `/compare/genres`).

- Route param drives which entity layout to use.
- Each type has its own paired-chart config (e.g. people get `timeline`, `subjects`, `coAuthors` overlap, `affiliations` Venn).
- Add entity selector Combobox (reuse existing).
- Add "what's different" summary block: shared % of top subjects, year-span overlap, shared collaborators.
- Deprecate `/compare-projects` with a redirect to `/compare/projects`.

Keep the module's equivalent aligned — generic `CompareEntity` block in the module instead of per-type blocks.

---

## Chart component additions required

New Svelte components to build during Phase 2–4:

| Component                   | Chart                                                        | Used by entities                                       |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| `StackedAreaChart.svelte`   | stacked area (subject trends, language timeline)             | sections, projects, languages, subjects, genres, types |
| `TreemapChart.svelte`       | treemap                                                      | sections, projects                                     |
| `GeoFlowMap.svelte`         | flow-map arcs                                                | sections, projects                                     |
| `ContributorNetwork.svelte` | bipartite force graph (person↔project or person↔institution) | people, projects, institutions, sections               |
| `RolesPie.svelte`           | donut of MARC relator roles                                  | people, institutions, sections, projects, types        |
| `CalendarHeatmap.svelte`    | NEW                                                          | whats-new, people, projects                            |
| `ChoroplethMap.svelte`      | NEW                                                          | locations, languages, home                             |
| `RadarChart.svelte`         | NEW                                                          | people, institutions, projects, compare                |
| `TimeAwareChord.svelte`     | NEW                                                          | projects, sections, subjects                           |
| `BoxPlot.svelte`            | NEW                                                          | sections, groups, institutions                         |

Already reusable: `BarChart`, `PieChart`, `StackedTimeline`, `Timeline`, `WordCloud`, `HeatmapChart`, `NetworkGraph`, `LocationMap`, `MiniMap`, `SankeyChart`, `SunburstChart`, `ChordDiagram`, `BeeswarmChart`, `GanttChart`, `EntityKnowledgeGraph`, `SemanticScatter`.

---

## Follow-up issues to file

Each bullet below becomes its own issue linked to #10:

- [x] Build `EntityDashboard` layout system (Phase 1)
- [x] Add `precompute_entity_dashboards.py` pipeline (Phase 1)
- [x] Detail-page dashboard for `/languages/[code]`
- [x] Detail-page dashboard for `/subjects/[slug]` (also covers tags)
- [x] Detail-page dashboard for `/people/[slug]` — reusable charts; networks (coAuthors, contributorNetwork, affiliationNetwork) land in Phase 4
- [x] Detail-page dashboard for `/institutions/[slug]` — reusable charts; collab/affiliation networks land in Phase 4
- [x] Detail-page dashboard for `/locations/[slug]` — reusable charts; `selfLocation` / `geoFlows` land in Phase 4
- [x] Detail-page dashboard for `/genres/[slug]`
- [x] Detail-page dashboard for `/resource-types/[slug]` — includes language × decade heatmap
- [x] Detail-page dashboard for `/groups/[slug]`
- [x] Detail-page dashboard for `/research-sections/[slug]` — existing charts only; gantt/beeswarm/languageTimeline/subjectTrends/contributorNetwork/geoFlows land in Phase 4
- [x] Expand `/projects/[id]` to full module-parity layout — adds sunburst, sankey, chord, heatmap, roles on top of the existing timeline/stacked-timeline/types/languages/subjects/wordCloud/contributors/locations; languageTimeline/subjectTrends/treemap/geoFlows/contributorNetwork still pending Phase 4
- [ ] Add `EntityKnowledgeGraph` to `/research-items/[id]` + context strip
- [ ] List-page enrichment: `/languages`, `/subjects`, `/genres`, `/resource-types`, `/groups`, `/people`, `/institutions`, `/locations`
- [ ] New chart: Calendar Heatmap
- [ ] New chart: Choropleth Map
- [ ] New chart: Radar Chart
- [ ] New chart: Time-aware Chord
- [ ] New chart: Box Plot / Violin
- [ ] New charts: StackedAreaChart, TreemapChart, GeoFlowMap, ContributorNetwork, RolesPie
- [ ] Generalize Compare → `/compare/[type]`

---

## Known issues

Bugs surfaced during Phase 1 that weren't fully resolved — tracked here so
they don't get lost in subsequent work.

### LocationMap: Prev/Next buttons close the popup

**Where:** `src/lib/components/charts/LocationMap.svelte` (clustered-marker
map used on `/languages?code=…` and any future entity-detail layout with a
`locations` slot).

**Symptom:** On a marker with ≥ 6 items, the popup renders a paginated list
with Prev / Next buttons. Clicking either button closes the popup instead of
paginating.

**What was tried (and didn't fix it):**

1. Replaced the `popupContainer.outerHTML = …` mutation with the MapLibre
   `popup.setHTML(…)` API — avoids MapLibre treating the DOM swap as an
   outside-click. Helped but insufficient.
2. Used `event.target.closest('.popup-page-btn')` so clicks on a button's
   descendant text/entity resolve to the button. Verified via browser MCP
   that the correct button is matched and `.stopPropagation()` fires.
3. Guarded `map.on('click', …)` so it skips `closeOtherPopups()` when the
   event originated inside `.maplibregl-popup`. Verified the guard runs;
   popup still closes.

**Hypothesis:** MapLibre's internal popup anchor / re-position logic runs on
`setHTML` and in some edge cases decides the popup is now outside viewport
bounds → removes it. Or a second click bubble we haven't located is
triggering `popup.remove()`.

**Next steps (separate issue):**

- Try `popup.setDOMContent()` with a pre-built `DocumentFragment` instead of
  `setHTML` — avoids the HTML parser round-trip.
- Re-implement the popup as a Svelte component mounted into
  `popup.getElement()` via `popup.on('open')`, dropping the imperative
  `buildPopupHtml` string builder entirely. This is the cleaner long-term
  refactor and should naturally avoid the close-on-click issue.
- Alternatively: MapLibre `closeOnMove: false` + a global `mousedown` capture
  on `.popup-page-btn` that calls `event.preventDefault()` before MapLibre's
  dispatcher sees the click.

## Scope boundaries

**Out of scope for this roadmap:**

- Redesign of existing cross-cutting pages (`/network`, `/semantic-map`, `/project-explorer`, `/whats-new`) — they're already rich.
- Replacing MapLibre or ECharts.
- Theming / dark mode parity between dashboard and module (tracked separately if desired).
- Authentication-gated features — this stays a static public site.

**Dependencies / unknowns flagged during planning:**

- Subject trends and co-subject aggregation need us to agree on the LCSH-vs-tag policy (module treats LCSH as authority, tags as free-text; dashboard currently merges them in `/subjects`). Decide before Phase 2 implementation on subjects.
- Choropleth needs country-level GeoJSON bundled once; pick Natural Earth 10m or 50m and commit to `static/data/geo/`.
- Semantic kNN on `/research-items/[id]` reuses existing embeddings pipeline; confirm all items have embeddings or gracefully skip the "similar items" strip.
