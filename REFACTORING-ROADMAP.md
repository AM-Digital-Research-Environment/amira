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

| Phase | Status  | Description                                                              |
| ----- | ------- | ------------------------------------------------------------------------ |
| 0     | done    | Test harness — Vitest, Testing Library, Playwright, seed unit tests      |
| 1     | done    | Low-risk cleanups — barrel deletions, helpers split, fetch/cache helpers |
| 2     | partial | UI primitives — `Modal`, `FilterToggleBar`, expanded `optionBuilders`    |
| 3     | pending | Component splits — `ItemDetail`, `ItemFilters`, dashboard layouts, maps  |
| 4     | pending | Architectural shells — `EntityPageContainer`, `EntityDetailViewShell`    |

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

### 2.2 `entity-browse/FilterToggleBar.svelte`

- **Create** the component.
- **Adopt** in `routes/projects/+page.svelte`,
  `routes/institutions/+page.svelte`, `routes/locations/+page.svelte`.

### 2.3 Shared collection-loading hook

- **Create** `src/lib/components/entity-browse/useEntityCollectionLoader.ts` — the
  identical `onMount + $effect → ensureCollections` block that lives in all 9
  entity pages.

### 2.4 Adopt `EntityDetailHeader` in people / projects

- `routes/people/+page.svelte` lines 463–511 → `EntityDetailHeader`.
- `routes/projects/+page.svelte` lines 348–413 → `EntityDetailHeader`.
- ~115 lines deleted across the two pages.

### 2.5 Expand chart `optionBuilders`

- **Add** to `src/lib/components/charts/utils/optionBuilders.ts`:
  - `buildTooltip(opts)`
  - `buildLegend(opts)`
  - `buildVisualMap(opts)`
  - `buildAxisLabel(opts)`
- **Migrate** `BarChart`, `HeatmapChart`, `StackedAreaChart`, `PieChart`,
  `SankeyChart` first; remaining charts in follow-ups.

### Done when

- Each new component has tests (mount, props, callbacks).
- A11y: focus-trap test for `Modal`; `aria-labelledby` linked.
- Phase 2 commit per sub-phase.

---

## Phase 3 — Component splits

### 3.1 Split `ItemDetail.svelte`

Coordinator (~150 lines) + 13 sub-components in
`src/lib/components/research-items/sections/`:

- `ItemHeader.svelte`
- `ItemAbstract.svelte`
- `ItemContributors.svelte`
- `ItemLocation.svelte`
- `ItemSubjects.svelte`
- `ItemTags.svelte`
- `ItemPhysical.svelte`
- `ItemIdentifiers.svelte`
- `ItemUrls.svelte`
- `ItemSponsors.svelte`
- `ItemAudience.svelte`
- `ItemNote.svelte`
- `ItemMap.svelte`

### 3.2 Split `ItemFilters.svelte`

`src/lib/components/research-items/filters/`:

- `ItemFilterGroup.svelte` — the expand/search/option-list/pills pattern shared
  by 7 of the 8 filter groups.
- `ItemFilterTypeSelect.svelte`
- `ItemFilterPills.svelte`
- `ItemFilterOptionList.svelte`

`ItemFilters.svelte` shrinks from 680 → ~80 lines.

### 3.3 Split `entityDashboardLayouts.ts`

- **Create** `src/lib/components/dashboards/layouts/`:
  - `language.ts`, `subject.ts`, `tag.ts`, `genre.ts`, `resource-type.ts`,
    `group.ts`, `person.ts`, `institution.ts`, `location.ts`,
    `research-section.ts`, `project.ts`
  - `fragments.ts` — reusable slot groups (timelines, categorical, networks,
    geography)
  - `index.ts` — re-export, rebuild `ENTITY_LAYOUTS`
- Parent file shrinks to ~150 lines (utilities + `CHART_METADATA`).

### 3.4 Move map module

- **Create** `src/lib/maps/` (top-level).
- **Move** `charts/map/{mapHelpers,markerBuilder,popupBuilder,
MapProjectionToggle.svelte}` → `lib/maps/`.
- **Create** `src/lib/maps/BaseMapController.ts` — owns the 47-line MapLibre
  init/theme/projection lifecycle.
- **Refactor** `ChoroplethMap`, `LocationMap`, `GeoFlowMap`, `MiniMap`,
  `PhotoMap`, `LocationsMapView` onto the controller.

### Done when

- Snapshot tests for each new sub-component with representative item fixtures.
- Unit test for `BaseMapController` lifecycle (mock MapLibre).
- ~700–900 lines reclaimed.

---

## Phase 4 — Architectural shells

### 4.1 `EntityPageContainer.svelte`

- Owns the `{#if selectedEntity}` toggle, URL sync, collection loading.
- All 9 entity pages adopt it (~50–80 lines off each).

### 4.2 `EntityDetailViewShell.svelte`

- Back button + `EntityDetailHeader` + `SearchableItemsCard` +
  `EntityDashboardSection` + `EntityKnowledgeGraph` in a fixed layout.
- Pages provide entity-specific snippets only.

### 4.3 `detailListState.svelte.ts`

- Generic factory for detail/list dual-view pages.
- Adopted by `routes/research-items/+page.svelte` and
  `routes/research-sections/+page.svelte`.

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
