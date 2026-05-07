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

| Phase | Status | Description                                                                                                                                                 |
| ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | done   | Test harness — Vitest, Testing Library, Playwright, seed unit tests                                                                                         |
| 1     | done   | Low-risk cleanups — barrel deletions, helpers split, fetch/cache helpers                                                                                    |
| 2     | done   | UI primitives — `Modal`, `FilterToggleBar`, expanded `optionBuilders`                                                                                       |
| 3     | done   | Component splits — `ItemDetail`, `ItemFilters`, dashboard layouts, maps                                                                                     |
| 4     | done   | Architectural shells — `EntityPageContainer`, `EntityDetailViewShell`, `detailListState`, publications helpers, `filterApplicationEngine`, `entityResolver` |
| 5     | active | Test net + cleanup — Playwright flows, untested utilities, delete `helpers.ts` shim, perf nibbles                                                           |

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

### 4.4 `filterApplicationEngine.ts` ✅

- **Add** `src/lib/utils/filterApplicationEngine.ts` — three pure
  exports:
  - `applyFilters(items, state)` runs the universities → dateRange →
    resourceTypes → languages → subjects → projects pipeline. Order is
    cheap-discrete-first for performance; the result is order-
    independent. `locations` lives in `FilterState` but isn't applied
    here (reserved for a future location facet on the FilterPanel).
  - `countActiveFilters(state)` returns the badge count — `dateRange`
    counts once if either bound is set; `locations` is intentionally
    ignored, matching the pipeline.
  - `emptyFilterState()` returns a fresh empty `FilterState`. Using a
    function (not a const) means every caller gets a new object that
    can be mutated freely; `resetFilters()` and tests both use it.
- **Refactor** `stores/filters.ts` from 125 → 56 lines (-55 %). The
  store is now a thin wrapper: state writable, three `toggleX`
  helpers, and two `derived(...)` stores that call into the engine.
  All public exports kept (`filters`, `resetFilters`,
  `toggleResourceType`, `toggleLanguage`, `toggleUniversity`,
  `filteredCollections`, `activeFilterCount`) — `FilterPanel.svelte`
  and `routes/+page.svelte` work unchanged.
- Tests: `filterApplicationEngine.test.ts` (24 tests covering each
  facet in isolation, the multi-facet conjunction, dateRange with
  start-only / end-only / both bounds and the no-date passthrough,
  the language B/T-variant normalisation on both item and filter
  sides, subject `authLabel` vs `origLabel` fallback, the reserved
  `locations` facet being a no-op, input-not-mutated guard, and
  university-undefined exclusion).

### 4.5 `entityResolver.ts` ✅

- **Add** `src/lib/utils/entityResolver.ts` with four exports:
  - `getUniversityById(id)` — find a `University` record by id.
    Returns `undefined` for the External pseudo-source and any
    unknown id; callers that need a label for External use
    `getUniversityName` instead.
  - `getUniversityName(id)` — display name for a university id, with
    the External pseudo-source spelled `'External'`. Returns `null`
    for unknown ids so callers can decide whether to render a
    fallback or hide.
  - `resolveCollectionUniversity(institutions)` — resolve the hosting
    university for an external collection from the institution names
    on its virtual project (e.g. `['Rhodes University']` → `'rhodes'`).
    Falls back to `EXTERNAL_SOURCE_ID` when no name matches.
  - `getProjectById(projects, id)` — permissive project lookup; tries
    `id`, then `_id`, then `idShort` (the `/projects` page lets users
    land via any of those).
- **Refactor** five call sites:
  - `loaders/collectionLoader.ts` drops the private `getUniversity()`
    helper and the inline `universities.find((u) => institutions
.includes(u.name))` resolver; both flow through the resolver.
  - `components/layout/FilterPanel.svelte` — chip relabel collapses
    from a two-line `{@const}` pair to a single `getUniversityName`
    call, drops the `EXTERNAL_SOURCE_ID` import.
  - `components/research-items/sections/ItemHeader.svelte` —
    `universityRecord` derived becomes a one-liner; drops the
    `universities` import.
  - `components/compare/ProjectsCompare.svelte` — `getSelectionName`
    helper uses `getUniversityName(id) ?? 'All'`, preserving the
    'All' fallback for unknown / `'all'` sentinels.
  - `routes/whats-new/+page.svelte` and `routes/projects/+page.svelte`
    — `$projects.find(...)` lookups become `getProjectById($projects,
id)`. The projects page's three-key `id || _id || idShort`
    chain shrinks to one call.
- Tests: `entityResolver.test.ts` (21 tests covering each export's
  happy path, null/undefined/empty input handling, the External
  fallback, the institutions-array resolver's ordering and empty
  list, and `getProjectById`'s id-then-\_id-then-idShort precedence).
- Note: `entityResolver` imports `EXTERNAL_SOURCE_ID` from
  `loaders/collectionLoader.ts`, and `collectionLoader` now imports
  back from `entityResolver`. The cycle is harmless — symbols are
  read at call time, never at module load — and avoiding it would
  require moving `EXTERNAL_SOURCE_ID` to a third file just to break
  a cycle that doesn't manifest. Worth flagging if a future change
  pulls these into top-level evaluation contexts.

### 4.6 Publications module — tests + filter / facet helpers ✅

The publications module wasn't part of the original Phase 4 plan but
matched the same pattern: pure utilities with no tests, plus inline
filter / facet builders on the page that mirrored the work
already done in Phase 3 for research-items. Folded in as 4.6.

- **`formatPublication.test.ts`** — 28 tests covering
  `publicationsByContributor` / `publicationsByContributorWithRole`
  (id-vs-name match, role precedence: author > editor > book_editor),
  `formatContributors` (et al. truncation, raw fallback),
  `formatCitationTail` (article / chapter / working-paper / conference
  branches, page-range vs. page-count, volume + issue formatting),
  `publicationTypeLabel` (known + fallback), `quarterLabel`
  (Roman numerals, missing year/quarter, out-of-range fallback).
- **`zoteroExport.test.ts`** — 21 tests covering `buildRis` end-to-end:
  `TY` mapping for every coarse type incl. unknown→GEN fallback,
  AU/ED emission, TI/PY/JO/T2 fields, series→T2 fallback when no
  booktitle, page-range parsing into SP/EP, single-page count
  emitted as SP only, VL/IS, PB/CY with address-vs-event_location
  precedence, C1 for event_dates, DO, SN with ISBN-over-ISSN
  preference, multiple KW lines, UR.
- **`facets.ts` + `facets.test.ts`** — `buildFacetOptions(items, {
getKey, formatLabel, formatValue?, sort? })` collapses the three
  near-identical `$derived.by` facet builders on the publications
  page (`typeOptions`, `yearOptions`, `languageOptions`) into a
  single call each. Three sort modes: `frequency` (default),
  `key-desc` (years 2025 → 2020), `key-asc`. 8 tests.
- **`filterPublications.ts` + `filterPublications.test.ts`** —
  `applyPublicationFilters(pubs, { type, year, language, keyword,
searchQuery })` extracts the 27-line `filtered` `$derived.by` block.
  Pure: takes the filter values, returns a new array. Companion
  `hasActiveFilters(filters)` replaces the inline `||`-chained gate.
  24 tests covering each facet, conjunction, search across every
  field (title / abstract / journal / booktitle / publisher / DOI /
  contributors / keywords), case-insensitive trim, exact-keyword vs.
  substring-search distinction.
- **Page refactor**: `routes/publications/+page.svelte` shrinks from
  445 → ~395 lines. The three `$derived.by` facet builders become
  three `buildFacetOptions` invocations; the 27-line filter block
  becomes `applyPublicationFilters(allPubs, activeFilters)`; the
  6-line `hasFilters` derived becomes `hasActiveFilters(activeFilters)`.

Verification: 81 new tests (28 + 21 + 8 + 24) all green; type-check,
lint, format clean; preview smoke confirms search filter still
narrows count + Clear button hides when no filters active.

### Done when

- Integration test per shell component (mount with fixture data → list view →
  click → detail view).
- Playwright smoke for: entity browse select-then-filter; research-items
  filter-then-open.
- ~1,200–1,500 lines reclaimed across the 9 pages.

The shell-level integration tests and the two Playwright flows landed
as deferred items — see Phase 5.1 / 5.2 for follow-through. The
~1,200-line target was met cumulatively across 4.1–4.6.

---

## Phase 5 — Test net + cleanup + perf nibbles

Phase 4 left two debts on the table: the Playwright "select-then-filter"
and "filter-then-open" flows in the "Done when" block, and the
`helpers.ts` shim that Phase 1.2 marked deprecated. Phase 5 closes
both, picks up the still-untested pure utilities (~995 lines across
4 files), tightens the import graph, and chips at the easiest
performance wins. No new architecture — all in service of locking
in the test net we built and removing dead weight.

### Goals

- **Cover the remaining pure utilities** so refactor regressions show
  up in CI, not at runtime. `transforms/network.ts` (517 lines) is
  the biggest hole.
- **Lock the e2e contract** for the two flows that exercise every
  Phase 4 shell end-to-end. Wire them into CI on PRs.
- **Delete dead code** — `helpers.ts` shim and the
  `entityResolver` ↔ `collectionLoader` import cycle.
- **Pick the lowest-risk perf wins** — search-input debounce — that
  pay off with no architectural shift.

### Non-goals

- Web workers / IndexedDB caching of `$allCollections`. Big payoff,
  big risk; defer to a Phase 6 if profiling shows we need it.
- Pagination URL state. UX nice-to-have, doesn't fit "test net + cleanup".
- New components or features.

### 5.1 Playwright e2e flows — entity browse select→filter, research-items filter→open

The roadmap promised these in Phase 4's "Done when" but they didn't
land. Each is a single `*.spec.ts` under `tests/e2e/`, hitting the
real built site via the existing Playwright config (port 4173,
`build && preview`).

- **`tests/e2e/entity-browse.spec.ts`** — visit `/genres`, click a
  genre card, assert the detail view's `Back to genres` button is
  visible, click back, assert the list view returns. Repeat with
  `/locations` (region/city sub-cards), `/people` (extra info cards),
  and `/research-sections` (Phase 1 + 2 sections). Four flows, ~30
  lines each.
- **`tests/e2e/research-items.spec.ts`** — visit `/research-items`,
  type "religion" in the search box, assert row count drops, click
  the first row, assert detail view title contains the search term
  or the title row renders, click `Back to results`, assert the
  search query survived and the table is back. Then `?audience=youth`
  deep-link path.
- **`tests/e2e/publications.spec.ts`** — visit `/publications`,
  use the type combo to pick "Article", assert the count line
  drops below the total, click `Clear`, assert the count returns to
  total and the Clear button hides. Pins the Phase 4.6 refactor.

### 5.2 Shell integration tests — mount with fixture data → click → detail

The unit tests for `EntityPageContainer` and `EntityDetailViewShell`
verify each shell in isolation; the integration story (one shell
inside another, with real entity data, exercising the URL → state
sync) lives only in the e2e. A jsdom integration test fills the gap
without spinning up a browser.

- **`src/lib/components/entity-browse/integration.test.ts`** — a
  small harness that wires `EntityPageContainer` around
  `EntityDetailViewShell` with fixture entities, simulates the URL
  change that `detailListState.select()` would push, asserts the
  view switches list → detail and back. One test per shell topology
  (simple genre-style, complex locations-style with a body that
  uses an inner `{#if}`). ~6 tests.

### 5.3 Test the still-untested pure utilities

| File                           | Lines | Exports | Tier 1 cost |
| ------------------------------ | ----- | ------- | ----------- |
| `transforms/network.ts`        | 517   | 7       | ~25 tests   |
| `transforms/itemExtractors.ts` | 207   | 18      | ~30 tests   |
| `transforms/charts.ts`         | 217   | 4       | ~12 tests   |
| `transforms/itemFormatters.ts` | 54    | 2       | ~6 tests    |
| `compare/compareProfile.ts`    | 83    | 1–2     | ~6 tests    |
| `charts/utils/formatters.ts`   | 133   | 7       | ~14 tests   |

`network.ts` is the priority — it builds the knowledge-graph adjacency
data the entity pages render, has the most logic, and is the most
likely to regress silently when downstream entity changes ripple
through it. Aim for ~80 new tests across the six files.

### 5.4 Delete `helpers.ts` shim

13 files still import from `$lib/utils/helpers`. Each call site
imports a tiny set of functions (most of them just `formatDate`,
`getProjectTitle`, `getSectionColor`). Migrate each to import from
`$lib/utils/formatters` or `$lib/utils/theme` directly, then delete
`src/lib/utils/helpers.ts`. Mechanical change; pre-existing tests
gate it.

### 5.5 Break the `entityResolver` ↔ `collectionLoader` import cycle

`entityResolver` imports `EXTERNAL_SOURCE_ID` from
`loaders/collectionLoader`; `collectionLoader` imports
`getUniversityById` and `resolveCollectionUniversity` back from
`entityResolver`. ESM tolerates this because both reads are
function-time, but the cycle is a footgun for any future change
that pulls one of these into top-level evaluation.

Fix: extract `EXTERNAL_SOURCE_ID = 'external'` into
`src/lib/utils/loaders/constants.ts` (or `src/lib/types/external.ts`),
update both files to import from the new location. One commit, two
small file edits, zero behavioural change.

### 5.6 Wire e2e into CI

`.github/workflows/ci.yml` runs `format:check`, `lint`, `check`,
`test`, `build` on PRs and pushes to `main`. It does NOT run the
Playwright suite. Add a new job (or step) that runs `npx playwright
install --with-deps chromium` then `npm run test:e2e`. The job runs
on PRs only — main pushes already deploy; e2e on `main` would just
delay the deploy without giving the PR feedback we actually want.

Worth flagging: Playwright's `webServer` config builds + previews
inline, which means CI doesn't need a separate build step for e2e.
The existing `build` job stays.

### 5.7 Debounce the search inputs

`research-items` and `publications` re-run `applyFilters` (or the
publications equivalent) on every keystroke. `applyFilters` scans
`$allCollections` (~10k items × 9 filter passes); on a deep keystroke
sequence the page can drop frames.

Fix: a small `useDebouncedState(initial, ms = 200)` hook in
`src/lib/utils/`, returning a `{ value, debounced }` pair. The page
binds the input to `value` (instant feedback) and reads `debounced`
inside the filter `$derived`. 200ms is the sweet spot — keypress
loops below that get folded into a single filter run; above it the
results feel laggy.

Adopted in: `routes/research-items/+page.svelte` (`searchQuery`
binding), `routes/publications/+page.svelte` (`searchQuery`
binding). Tests for the hook itself; the pages keep working
unchanged from a behavioural standpoint.

### Done when

- All 27+6+~80 = ~113 new unit tests pass.
- Three Playwright spec files cover the Phase 4 shells end-to-end.
- CI runs e2e on every PR.
- `helpers.ts` is deleted; no `$lib/utils/helpers` imports remain.
- `entityResolver` ↔ `collectionLoader` cycle is broken.
- Search inputs in research-items and publications are debounced.
- One commit per sub-phase; pause for review at the seam.

### Risk and sequencing

| Sub-phase               | Risk     | Effort | What it locks down                      |
| ----------------------- | -------- | ------ | --------------------------------------- |
| 5.1 Playwright flows    | low      | 0.5 d  | Phase 4 shell behaviour                 |
| 5.2 Shell integration   | low      | 0.5 d  | EntityPageContainer + Shell composition |
| 5.3 Pure-utility tests  | very low | 1.5 d  | ~995 lines of untested logic            |
| 5.4 Delete `helpers.ts` | very low | 0.25 d | Mechanical                              |
| 5.5 Break cycle         | very low | 0.25 d | Mechanical                              |
| 5.6 e2e in CI           | low      | 0.25 d | Reproducible runs                       |
| 5.7 Debounce search     | low–med  | 0.5 d  | UX for the two largest pages            |

5.4 and 5.5 are independent and reversible — could merge in one
commit if review bandwidth is the bottleneck. 5.7 needs a brief
post-deploy spot-check (the search-feels-laggy class of bug isn't
caught by tests).

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
    publications/
      facets.ts              # NEW: buildFacetOptions
      filterPublications.ts  # NEW: applyPublicationFilters + hasActiveFilters
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
