# Refactoring Roadmap

A staged, test-backed plan to reduce duplication and tighten module boundaries in the
WissKI Dashboard. Each phase ends with a green test suite, a clean `format:check`, a
successful `build`, and a single commit per logical unit. Work pauses after each phase
for review.

## Goals

- **Modularity** — collection-/entity-specific behaviour expressed as opt-in flags,
  config, or new components, never as `if (slug === ...)` inside shared UI.
- **Eliminate duplication** — shared logic factored into `utils/`,
  `utils/transforms/`, `utils/loaders/`, or new shared components.
- **No functionality loss** — every refactor lands behind a green test suite that
  pins the original behaviour first.
- **Smaller files** — break monolithic components (`ItemDetail.svelte` 794 lines,
  `ItemFilters.svelte` 680 lines, `entityDashboardLayouts.ts` 493 lines) into
  single-responsibility units.

## Non-goals

- Adding features.
- Changing visual design beyond accidental fixes that fall out of refactoring.
- Achieving 100% test coverage. Tier 1 (pure utilities) targets ~90%; Tier 2 (new
  shared components) ~70%; everything else stays uncovered.

---

## Phase tracker

| Phase | Status | Description                                                                                                    |
| ----- | ------ | -------------------------------------------------------------------------------------------------------------- |
| 0     | done   | Test harness — Vitest, Testing Library, Playwright, seed unit tests                                            |
| 1     | done   | Low-risk cleanups — barrel deletions, helpers split, fetch/cache helpers                                       |
| 2     | done   | UI primitives — `Modal`, `FilterToggleBar`, expanded `optionBuilders`                                          |
| 3     | done   | Component splits — `ItemDetail`, `ItemFilters`, dashboard layouts, maps                                        |
| 4     | active | Architectural shells — `EntityPageContainer`, `EntityDetailViewShell`, `detailListState` |

After each phase: `npm run format:check`, `npm run check`, `npm run lint`,
`npm run test`, and `npm run build` all pass. Commit, pause for review, then
resume.

---

## Phase 0 — Test harness

**Why first:** zero tests exist today. Refactoring without a safety net is how
regressions ship. Vitest is Vite-native and shares config; Svelte 5 runes are
supported via `@testing-library/svelte` 5.x.

### Packages

- `vitest` — test runner
- `@vitest/ui` — interactive runner UI
- `@vitest/coverage-v8` — coverage
- `jsdom` — DOM env for component tests
- `@testing-library/svelte` — Svelte 5 / runes-compatible
- `@testing-library/jest-dom` — extended matchers
- `@playwright/test` — e2e

### Files added

- `vitest.config.ts` — runner config, jsdom env, alias resolution from svelte-kit
- `src/test-setup.ts` — jest-dom matcher import
- `playwright.config.ts` — single project, dev server hook
- `tests/e2e/smoke.spec.ts` — one Playwright smoke flow
- Co-located `*.test.ts` next to source files for unit tests

### Seed unit tests (Tier 1)

- `src/lib/utils/slugify.test.ts`
- `src/lib/utils/pagination.test.ts`
- `src/lib/utils/search.test.ts`
- `src/lib/utils/urlSelection.test.ts`
- `src/lib/utils/helpers.test.ts`
- `src/lib/utils/transforms/dates.test.ts`
- `src/lib/utils/transforms/extractors.test.ts`
- `src/lib/utils/transforms/filters.test.ts`
- `src/lib/utils/transforms/grouping.test.ts`

### npm scripts added

```
test            vitest run
test:watch      vitest
test:ui         vitest --ui
test:coverage   vitest run --coverage
test:e2e        playwright test
```

### Done when

- `npm run test` passes.
- `npm run build` still succeeds.
- `format:check`, `check`, `lint` all green.
- Commit message: `Add Vitest + Playwright test harness with seed utility tests`.

---

## Phase 1 — Low-risk cleanups

Mechanical moves that improve module boundaries without behaviour change. Each step
is one commit; tests gate each.

### 1.1 Delete redundant barrels

- **Delete** `src/lib/utils/dataLoader.ts` (re-exports `./loaders`)
- **Delete** `src/lib/utils/dataTransform.ts` (re-exports `./transforms`)
- **Delete** `src/routes/compare/[type]/compareTypes.ts` (re-exports lib version)
- Update ~10 import sites to import from `$lib/utils/loaders` and
  `$lib/utils/transforms` directly.

### 1.2 Split `utils/helpers.ts`

- **Create** `src/lib/utils/formatters.ts` — `formatDate`, `getItemTitle`,
  `getProjectTitle`.
- **Create** `src/lib/utils/theme.ts` — `getSectionColor`, `getSectionColorHsl`,
  `getSectionColorResolved`.
- `helpers.ts` becomes a deprecated re-export shim (delete in a follow-up phase).
- **Remove duplicate `getItemTitle()`** in
  `src/lib/components/charts/map/markerBuilder.ts` — import from `formatters.ts`.

### 1.3 Move `itemHelpers.ts` into transforms

- **Move** `src/lib/components/research-items/itemHelpers.ts` →
  `src/lib/utils/transforms/itemExtractors.ts` (extractors) and
  `src/lib/utils/transforms/itemFormatters.ts` (formatDate, formatDateInfo, etc.).
- **Re-export** from `src/lib/components/research-items/index.ts` for back-compat.

### 1.4 Centralize data paths

- **Export** `DATA_PATHS` constant from
  `src/lib/utils/loaders/collectionLoader.ts`.
- **Consume** in `src/lib/utils/offlinePrefetch.ts` so prefetch never drifts from
  real loaders.

### 1.5 Add `fetchHelpers.ts`

- **Create** `src/lib/utils/loaders/fetchHelpers.ts` with
  `fetchAndTransformJSON<T>(path, opts)`.
- **Refactor** `mongoJSON.ts`, `embeddingsLoader.ts`, `geolocLoader.ts`,
  `wisskiUrl.svelte.ts`, `entityDashboardLoader.ts` to use it.

### 1.6 Add `cacheFactory.ts`

- **Create** `src/lib/utils/loaders/cacheFactory.ts` with
  `createLazyLoader<T>()` (cache + inflight-promise dedup).
- **Refactor** lazy-load patterns in `stores/data.ts`, `wisskiUrl.svelte.ts`,
  `entityDetailState.svelte.ts`.

### 1.7 Add `transforms/indexing.ts`

- **Create** `src/lib/utils/transforms/indexing.ts` — `countByProjectId`,
  `indexByProjectId`, `indexByPersonName`, `buildProjectMetaMap`,
  `buildPersonAffiliationMap`.
- **Refactor** consumers in `transforms/charts.ts`, `transforms/network.ts`,
  `stores/filters.ts`.

### Done when

- All seed tests still green; new utilities have their own tests.
- ~250 lines net deletion; clearer module map.
- Commits (one per sub-phase): see commit-message conventions in 1.1–1.7.

---

## Phase 2 — UI primitives + shared components

### 2.1 `ui/modal.svelte` primitive ✅

- **Create** `src/lib/components/ui/modal.svelte` — backdrop, Escape key,
  body-scroll lock, focus trap, `aria-labelledby` / `aria-label`, focus
  restoration on close, dual `align="center" | "start"` mode.
- **Refactor** `collections/PhotoLightbox.svelte` and
  `collections/IssueTocModal.svelte` to use it.
- Inner `transition:scale` on the lightbox / TOC frames is replaced by a
  CSS `@keyframes` animation that respects `prefers-reduced-motion` —
  Svelte 5's bidirectional `transition:` directive fights with conditional
  outros nested inside a child component's `{#if}` block (an outro can
  finish at `currentTime: 0` but leave the element mounted).
- Backdrop fade is also a CSS animation for the same reason.
- Tests: `src/lib/components/ui/modal.test.ts` (10 tests covering open
  state, ARIA, scroll lock, Escape, backdrop click, inner click, close
  button, `showClose=false`, `align="start"`).
- Test harness: jsdom does not implement the Web Animations API, so
  `src/test-setup.ts` now stubs `Element.prototype.animate` to a no-op
  Animation — required for any component that imports
  `svelte/transition`.

### 2.2 `entity-browse/FilterToggleBar.svelte` ✅

- **Create** `src/lib/components/entity-browse/FilterToggleBar.svelte`
  with `options`, `value`, `onChange`, `size` (sm | md), `fullWidth`,
  `capitalize`, plus `aria-labelledby` / `aria-label` and
  `aria-pressed` on the active button.
- **Adopt** in:
  - `routes/projects/+page.svelte` — research-items presence (sm + fullWidth)
  - `routes/institutions/+page.svelte` — partner / contributor (md, with counts)
  - `routes/locations/+page.svelte` — view mode (md, capitalize)
- Tests: `FilterToggleBar.test.ts` (12 tests covering options render,
  active state, click → onChange, size variants, count rendering,
  fullWidth, capitalize, aria attributes).

### 2.3 Shared collection-loading hook ✅

- **Create** `src/lib/components/entity-browse/useEntityCollectionLoader.svelte.ts` —
  the identical `onMount + $effect → ensureCollections` block that lived in 9 entity
  pages, plus an optional `onMountExtra` for page-specific side effects.
- **Adopted** in: `people` (with `loadWisskiUrls('persons')` extra), `locations`
  (with `ensureEnrichedLocations(base)` extra), `institutions`, `subjects`,
  `languages`, `genres`, `groups`, `resource-types`, `research-sections`.
  `projects` is left as-is — it has a simpler unconditional `onMount` and no
  duplication to fold in.

### 2.4 Adopt `EntityDetailHeader` in people / projects ✅

- Extend `EntityDetailHeader.svelte` with a `content` snippet (rendered as
  `<CardContent>` beneath the header) and a `hideWisskiLink` flag — both
  needed so the projects header (which has structured detail rows and an
  inline `WissKILink`) can be expressed without losing fidelity.
- `routes/people/+page.svelte` — 47-line header → ~30-line snippet usage.
  All custom badges (Section PI, Spokesperson, PI of N, Member of N,
  research items) live in the `badges` snippet; `WissKILink` is auto-rendered
  from `wisskiCategory`/`wisskiKey`.
- `routes/projects/+page.svelte` — 65-line header → uses the new `content`
  snippet for the structured detail rows (identifier, research section,
  duration, project link). `hideWisskiLink` is set so the inline
  `WissKILink` inside `content` isn't duplicated.
- Tests: `EntityDetailHeader.test.ts` (10 tests covering title, subtitle,
  count pluralisation, percent badge, empty-row suppression, content
  snippet wiring, badges snippet, and the `hideWisskiLink` flag).

### 2.5 Expand chart `optionBuilders` ✅

- **Add** to `src/lib/components/charts/utils/optionBuilders.ts`:
  - `buildTooltip(opts)` — collapses the `confine: true, trigger, axisPointer.{type}, formatter, position, triggerOn` boilerplate into a single call.
  - `buildLegend(opts)` — `position` preset (`top` / `bottom` / `left` /
    `right`) maps to `orient` + `left`/`top`/`bottom`, with `scroll` on
    by default and `data` / `textStyle` forwarded.
  - `buildVisualMap(opts)` — required `min` / `max` / `colors`, optional
    `orient`, `position`, `itemWidth`, `itemHeight`, `textStyle`,
    `calculable`, `offset`. Replaces the verbose duplicated heatmap legend
    config in two charts.
  - `buildAxisLabel(opts)` — spreads a theme `baseStyle` then layers
    `rotate` / `fontSize` / `width` / `overflow` / `interval`.
- **Migrated**: `BarChart`, `HeatmapChart`, `StackedAreaChart`, `PieChart`,
  `SankeyChart`. Remaining charts (BeeswarmChart, BoxPlot, GanttChart,
  ChordDiagram, NetworkGraph, RadarChart, SemanticScatter, StackedTimeline,
  SunburstChart, Timeline, TreemapChart, WordCloud, CalendarHeatmap) keep
  their inline configs and can be folded in piecemeal later.
- Tests: `optionBuilders.test.ts` — 28 tests covering every builder
  (defaults, overrides, position presets, scroll toggle, optional-field
  omission).

### Done when

- Each new component has tests (mount, props, callbacks).
- A11y: focus-trap test for `Modal`; `aria-labelledby` linked.
- Phase 2 commit per sub-phase.

---

## Phase 3 — Component splits

### 3.1 Split `ItemDetail.svelte` ✅

Coordinator shrinks from 794 → 170 lines (78% drop). 13 single-responsibility
sub-components live under `src/lib/components/research-items/sections/`:

- `ItemHeader.svelte` — title, alt titles, project link, type / genre /
  institution / language / dates row, WissKILink.
- `ItemAbstract.svelte`
- `ItemContributors.svelte`
- `ItemLocation.svelte` — origins + currentLocations.
- `ItemSubjects.svelte`
- `ItemTags.svelte`
- `ItemPhysical.svelte`
- `ItemIdentifiers.svelte`
- `ItemUrls.svelte`
- `ItemSponsors.svelte`
- `ItemAudience.svelte`
- `ItemNote.svelte`
- `ItemMap.svelte` — exports the `ItemMapMarker` type.

Each section guards its own `{#if data}` so the coordinator's two-column
grid auto-flows around empty slots. Index barrel at
`sections/index.ts` re-exports the components and the marker type.

### 3.2 Split `ItemFilters.svelte` ✅

`ItemFilters.svelte` shrinks from 680 → 320 lines (53% drop). The 7
near-identical facet blocks (countries, projects, languages, subjects,
tags, audiences, methods) collapse to a single `ItemFilterGroup`
invocation each. `src/lib/components/research-items/filters/`:

- `ItemFilterGroup.svelte` — expand toggle + pills + optional search
  input + option list. Takes a `theme` (one of `FILTER_THEMES`) for
  the per-facet colour, `formatLabel` for languages, `searchEnabled`
  to disable the search input (methods), and `searchHideThreshold`
  to gate it on minimum option count.
- `ItemFilterTypeSelect.svelte` — the resource-type dropdown.
- `ItemFilterPills.svelte` — the selected-values pill strip with a
  Clear chip; reused inside `ItemFilterGroup`.
- `ItemFilterOptionList.svelte` — the scrollable option list with
  active-row highlighting; reused inside `ItemFilterGroup`.
- `filterThemes.ts` — frozen `FILTER_THEMES` registry mapping facet
  names (`primary`, `accent`, `chart-1`…`chart-5`) to pill / active
  Tailwind class strings.

The 7 per-facet `filtered…Options` $derived blocks collapse to a
single `trimToVisible()` helper used per facet, and the per-facet
`searchHideThreshold` (10 in the original `length > 10` check)
becomes a single prop.

### 3.3 Split `entityDashboardLayouts.ts` ✅

`entityDashboardLayouts.ts` shrinks from 493 → 251 lines and now owns
only the type system, `CHART_METADATA`, the empty-payload helpers, and
the `shouldRenderSlot` dispatcher. The 11 entity layouts move to
`src/lib/components/dashboards/layouts/`:

- `fragments.ts` — shared slot constants (`stackedTimelineWide`,
  `wordCloudWide`, `subjectTrendsWide`, `heatmapResourceTypeByDecade`,
  `locationsTrailing`, `geoFlowsCard`) and slot groups
  (`typesAndLanguages`, `subjectsAndContributors`).
- One file per entity: `language.ts`, `subject.ts`, `tag.ts`, `genre.ts`,
  `resource-type.ts`, `group.ts`, `person.ts`, `institution.ts`,
  `location.ts`, `research-section.ts`, `project.ts`. Each exports a
  single `EntityLayout` constant composed from the fragments.
- `index.ts` — assembles the imported layouts into the
  `ENTITY_LAYOUTS` registry.

`entityDashboardLayouts.ts` re-exports `ENTITY_LAYOUTS` from the new
module so existing consumers keep working unchanged.

### 3.4 Move map module ✅

- **Move**: `charts/map/{mapHelpers,markerBuilder,popupBuilder,
MapProjectionToggle.svelte}` → `src/lib/maps/`. All 7 consumer
  components (PhotoMap, ChoroplethMap, GeoFlowMap, LocationMap,
  LocationsMapView, MiniMap, ChartSlot) updated to the new path.
- **Add** `src/lib/maps/BaseMapController.ts` — class that owns the
  shared MapLibre lifecycle: `init()` (creates the map, applies the
  initial style, adds the optional NavigationControl, wires `load`
  → `onStyleReady`), `setTheme()` (no-ops on the current theme,
  re-applies the style and re-fires `onStyleReady` after `style.load`
  on a real swap), `destroy()`. Plus a `map` getter for components
  that bind the live instance to projection toggles.
- **Add** `src/lib/maps/index.ts` barrel exporting the controller, the
  toggle, and the existing helpers/builders.
- **Refactored** onto the controller: `MiniMap`, `PhotoMap`. Each loses
  its inline `new maplibregl.Map`, theme-tracking `initialTheme`, and
  manual `setStyle` / `style.load` plumbing.
- **Not refactored** (kept inline for now): `ChoroplethMap`, `GeoFlowMap`,
  `LocationMap`. These three add `FullscreenControl`, set
  `setProjection({type:'globe'})` post-construction, and use a
  `load`/`idle`/`styledata` triple with a 1.5 s resize-fallback to
  dodge MapLibre's silent canvas stall in deeply-nested flex layouts.
  Migrating them needs the controller to grow surface area for those
  cases — left as a follow-up; the import paths still moved to the
  new module.
- **Tests**: `BaseMapController.test.ts` (12 tests covering init
  defaults, `light`/`dark` style URLs, center/zoom forwarding,
  optional navigation control, `onStyleReady` firing on load and on
  theme swap, `setTheme` no-op + swap returns, and `destroy`
  idempotency). MapLibre is fully mocked so the test doesn't need
  WebGL.

### Done when

- Snapshot tests for each new sub-component with representative item fixtures.
- Unit test for `BaseMapController` lifecycle (mock MapLibre).
- ~700–900 lines reclaimed.

---

## Phase 4 — Architectural shells

### 4.1 `EntityPageContainer.svelte` ✅

- **Add** `src/lib/components/entity-browse/EntityPageContainer.svelte` —
  outer shell that owns: the `space-y-8 animate-slide-in-up` wrapper,
  the `page-title` / `page-subtitle` header pair, the `{#if selected()}`
  detail/list snippet switch, and the `useEntityCollectionLoader` hook
  call (with optional `onMountExtra`).
- Snippets renamed to `detailView` / `listView` to avoid clashing with
  the conventional `const detail = createEntityDetailState(...)` that
  every entity page declares.
- Both `selected` and `onMountExtra` are read through closures inside
  the loader call so svelte-check doesn't flag them as initial-value
  captures (`state_referenced_locally`).
- **Adopted** by all 10 entity pages: `genres`, `groups`, `languages`,
  `resource-types`, `subjects`, `institutions`, `locations`,
  `research-sections`, `people`, `projects`. Each page sheds the outer
  wrapper + header block + `useEntityCollectionLoader` call (~12-14
  lines each → ~120 lines total reclaimed).
- Pages that need TypeScript narrowing on the selection (institutions,
  locations, people, projects, research-sections) keep an inner
  `{#if selectedX}` inside the `detailView` snippet — the container's
  outer gate is the runtime contract; the inner check is solely for
  the type system.
- The `projects` page's bare `onMount + ensureCollections` is replaced
  by the container's hook — projects already had a precomputed-items
  fallback so direct detail-URL hits still render without the 13 MB
  collections payload.
- Tests: `EntityPageContainer.test.ts` (7 tests covering title/subtitle
  rendering, `page-title`/`page-subtitle` classes, list/detail snippet
  switching, the `space-y-8 animate-slide-in-up` wrapper, and the
  `onMountExtra` lifecycle wiring). Uses a small Svelte harness so
  snippets can be exercised from JavaScript test code.

### 4.2 `EntityDetailViewShell.svelte` ✅

The original plan called for a **fixed** layout (Back + Header + Items

- Dashboard + Graph), but in practice 5 of the 10 entity pages have
  substantially different inner structure: institutions has paginated
  projects, locations has region/city sub-cards, people has 5 extra
  info cards (affiliations / profile / sections / projects PI /
  projects member), projects has its own description/PIs/members/
  institutions cards, research-sections has a custom Card-based header
- description / spokesperson / PIs / members / objectives / work
  programme / projects / Gantt cards. Forcing a rigid layout would
  push half the pages off the shell.

The shipped shell instead owns the universally-shared parts: the
`space-y-6` wrapper, the `BackToList`, and the loading / empty-state
fallback. Pages provide a single `body` snippet with their full
detail content.

- **Add** `src/lib/components/entity-browse/EntityDetailViewShell.svelte`
  — generic on `T` so the `body` snippet receives the resolved
  (non-null) entity (`Snippet<[T]>`). Simple pages exploit this for
  TypeScript narrowing without an extra `{#if}`. Complex pages
  (institutions, locations, people, projects, research-sections)
  ignore the param and keep an inner `{#if selectedX}` for narrowing
  when the entity is referenced both at script level and in the
  template — this avoids renaming dozens of references inside the
  body snippet.
- Props: `backLabel`, `onBack`, `resolved` (truthy gate),
  `loading?` (drives the "Loading dashboard…" branch),
  `emptyMessage?`, `body: Snippet<[T]>`.
- **Adopted** by all 10 entity pages: `genres`, `groups`, `languages`,
  `resource-types`, `subjects`, `institutions`, `locations`,
  `research-sections`, `people`, `projects`. Each page sheds its
  inline `<div class="space-y-6">` + `BackToList` + `{#if X}{:else
if loading}{:else}{/if}` block (~10 lines each).
- The projects page's bespoke inline back-button (a custom
  `<button>` with `<ArrowLeft>` icon) is replaced by the standard
  `BackToList` inside the shell. The `ArrowLeft` import is dropped.
- Tests: `EntityDetailViewShell.test.ts` (8 tests covering the
  BackToList wiring + label, body rendering on truthy resolved,
  loading state, default empty state, custom emptyMessage, the
  `space-y-6` wrapper class, and a parameterised falsy-values pass
  ensuring `0`, `''`, `null`, `undefined`, and `false` all hit the
  empty branch).

### 4.3 `detailListState.svelte.ts` ✅

- **Add** `src/lib/utils/loaders/detailListState.svelte.ts` —
  `createDetailListState({ paramName, scroll? })` returns a `{ key,
select, clear }` triple. The factory owns the `$derived` that reads
  the URL param via `$app/state`'s `page`, plus `select(value)` /
  `clear()` writers that go through `createUrlSelection` (so other
  query params survive a back-out) and call `scrollToTop()` by
  default.
- The factory is created from a component's `<script>`; the rune
  binds to the host component's lifecycle, so the URL → `key` sync
  follows the page's reactivity.
- **Adopted by** `routes/research-sections/+page.svelte` (was
  `createUrlSelection('section')` + an explicit `$state` mirror) and
  `routes/research-items/+page.svelte` (was raw `goto('?id=...')` /
  `goto('?')` calls). The research-items page kept its own `$effect`
  for the deep-link-only `audience` / `method` params, which the
  factory deliberately doesn't try to own.
- Behaviour change worth flagging: research-items `clearSelection`
  used to wipe ALL query params (`goto('?')`); after adoption it
  only drops `id` and preserves anything else in the URL. That's
  the intended `removeFromUrl` semantics — deep-link filter context
  now survives a detail-view back-out, matching the rest of the
  dashboard.
- Tests: `detailListState.test.ts` (13 tests covering initial-key
  read, distinct param names, ignoring unrelated params, `select()`
  navigation + URL encoding + scroll, `clear()` navigation +
  param-preservation + bare-? fallback + scroll, and the
  `scroll: false` opt-out for both writers).
- vitest config gains `environmentOptions.jsdom.url =
'http://localhost/'` so `window.history.replaceState(...)` doesn't
  fail with `SecurityError` on jsdom's default `about:blank`.

### 4.4 `filterApplicationEngine.ts`

- Pull the 50-line filter pipeline out of `stores/filters.ts` so the store stays
  pure state.
- `filteredCollections` derived store calls `applyFilters(state)`.

### 4.5 `entityResolver.ts`

- `getUniversityById`, `resolveCollectionUniversity`, `getProjectById`.
- Replaces ID lookups in `collectionLoader`, `transforms/charts.ts`, `external.ts`.

### Done when

- Integration test per shell component (mount with fixture data → list view →
  click → detail view).
- Playwright smoke for: entity browse select-then-filter; research-items
  filter-then-open.
- ~1,200–1,500 lines reclaimed across the 9 pages.

---

## Folder structure (after Phase 4)

```
src/lib/
  components/
    charts/                  (chart components only)
    collections/
    compare/
    dashboards/
      layouts/               # NEW: per-entity layout files + fragments
    entity-browse/
      shells/                # NEW: EntityPageContainer, EntityDetailViewShell
    layout/
    research-items/
      sections/              # NEW: 13 ItemDetail sub-components
      filters/               # NEW: ItemFilterGroup et al
    ui/
      modal.svelte           # NEW
  maps/                      # NEW top-level: shared MapLibre infra
  stores/
    data.ts
    filters.ts               (pure state — logic moves out)
  styles/
  types/
  utils/
    formatters.ts            # NEW (split from helpers.ts)
    theme.ts                 # NEW (split from helpers.ts)
    entityResolver.ts        # NEW
    filterApplicationEngine.ts # NEW
    loaders/
      fetchHelpers.ts        # NEW
      cacheFactory.ts        # NEW
      detailListState.svelte.ts # NEW
    transforms/
      indexing.ts            # NEW
      itemExtractors.ts      # NEW (from research-items/itemHelpers.ts)
      itemFormatters.ts      # NEW
```

---

## Testing strategy

| Tier | Targets                                                                                                                                                      | Coverage goal | Where                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ---------------------- |
| 1    | Pure utilities (`utils/transforms/*`, `utils/helpers`, `utils/loaders/mongoJSON`, `utils/urlSelection`, `utils/search`, `utils/pagination`, `utils/slugify`) | ~90%          | Co-located `*.test.ts` |
| 2    | New shared components (`Modal`, `FilterToggleBar`, `EntityPageContainer`, `ItemFilterGroup`, `BaseMapController`)                                            | ~70%          | Co-located `*.test.ts` |
| 3    | Critical user journeys (entity select-then-filter, research-items filter-then-open)                                                                          | 1–2 flows     | `tests/e2e/*.spec.ts`  |

Tests are written **with** each refactor PR, not as a separate effort. Pattern:

1. Write tests against current behaviour.
2. Refactor.
3. Tests still pass.

---

## Risk and sequencing

| Phase | Risk     | Effort | Reclaimable lines |
| ----- | -------- | ------ | ----------------- |
| 0     | low      | 1.5 d  | 0                 |
| 1     | very low | 2–3 d  | ~250              |
| 2     | low–med  | 3–4 d  | ~250 + a11y       |
| 3     | medium   | 4–5 d  | ~700–900          |
| 4     | high     | 5–7 d  | ~1,200–1,500      |

Phases 1 and 2 are reversible and can be merged independently. Phases 3 and 4
should each go in their own PR and lean on the test suite that grew during 0–2.

---

## Conventions

- One commit per logical unit (e.g., "Phase 1.5: add fetchHelpers and migrate 5
  loaders"). Going wider than that makes review and bisecting harder.
- Always run all checks before committing:
  `npm run format:check && npm run check && npm run lint && npm run test && npm run build`.
- Pause after each phase for user review.
- Never push without explicit approval.
- Track per-phase status in the [Phase tracker](#phase-tracker) above.
