# WissKI Dashboard — Refactoring Roadmap

> Last updated: 2026-03-18

## Overview

This roadmap addresses dead code, code duplication, CSS consistency, and tooling gaps
identified during a comprehensive codebase audit. Work is organized into phases that can
be tackled incrementally without breaking the running application.

---

## Phase 1 — Tooling: ESLint + Prettier

**Goal:** Establish automated formatting and lint rules so future code stays consistent.

| Task | Files |
|------|-------|
| Install `eslint`, `prettier`, `eslint-plugin-svelte`, `eslint-config-prettier`, `typescript-eslint` | `package.json` |
| Create `eslint.config.js` (flat config) | new file |
| Create `.prettierrc` | new file |
| Create `.prettierignore` | new file |
| Add `lint`, `lint:fix`, `format`, `format:check` scripts | `package.json` |
| Run initial format pass and fix lint errors | all `src/` files |

**Acceptance:** `npm run lint` and `npm run format:check` pass with zero errors.

---

## Phase 2 — Dead Code Removal

**Goal:** Remove exports, functions, types, stores, and components that are never imported.

### 2a — Stores (`src/lib/stores/data.ts`)

| Item | Lines | Action |
|------|-------|--------|
| `artWorldCollection` | 31-34 | Remove |
| `clnckCollection` | 35-38 | Remove |

### 2b — Data Loader (`src/lib/utils/dataLoader.ts`)

| Item | Action |
|------|--------|
| `loadArtWorldCollection()` | Remove |
| `loadCLnCKCollection()` | Remove |
| `loadAllUBTCollections()` | Remove |
| `getUBTCollectionNames()` | Remove |
| `getAllCollectionNames()` | Remove |
| `getUniversity()` | Remove |
| `getUniversityCollectionNames()` | Remove |
| `UBT_COLLECTIONS` private const | Remove (only used by removed functions) |
| `loadProjects`, `loadPersons`, `loadInstitutions`, `loadGroups`, `loadDevCollections` | Remove `export` keyword (keep as private helpers for `loadAllData`) |

### 2c — URL helpers (`src/lib/utils/urls.ts`)

| Item | Action |
|------|--------|
| `projectsUrl()` | Remove |

### 2d — Data transforms (`src/lib/utils/dataTransform.ts`)

| Item | Action |
|------|--------|
| `extractLocales()` | Remove |

### 2e — Types (`src/lib/types/index.ts`)

| Item | Action |
|------|--------|
| `MaybeNaN<T>` | Remove |

### 2f — Chart utilities (`src/lib/components/charts/utils/`)

| Item | File | Action |
|------|------|--------|
| `simpleFormatter()` | `formatters.ts` | Remove |
| `percentageFormatter()` | `formatters.ts` | Remove |
| `buildLargeDatasetConfig()` | `optionBuilders.ts` | Remove |
| `buildLegend()` | `optionBuilders.ts` | Remove |
| `buildTooltip()` | `optionBuilders.ts` | Remove |
| Corresponding re-exports | `utils/index.ts` | Remove |

### 2g — Components (`src/lib/components/charts/`)

| Item | Action |
|------|--------|
| `GeoMap.svelte` | Remove file + remove export from `charts/index.ts` |

### 2h — Filter store (`src/lib/stores/filters.ts`)

| Item | Action |
|------|--------|
| `setDateRange()` | Remove |
| `setResourceTypes()` | Remove |
| `setLanguages()` | Remove |
| `setSubjects()` | Remove |
| `setProjects()` | Remove |
| `setUniversities()` | Remove |

### 2i — Design tokens (`src/lib/styles/tokens.ts`)

| Item | Action |
|------|--------|
| `CHART_COLORS_SEQUENTIAL` | Remove |
| `CHART_COLORS_DIVERGING` | Remove |
| `FONT_SIZE`, `FONT_WEIGHT`, `SPACING`, `BORDER_RADIUS`, `SHADOW` | Remove (CSS tokens.css is the source of truth; these are never read at runtime) |
| `DURATION`, `EASING`, `Z_INDEX`, `LAYOUT` | Remove |
| All key-type exports (`FontSizeKey`, `FontWeightKey`, `SpacingKey`, etc.) | Remove |
| `TOKENS_CSS_PATH` in `styles/index.ts` | Remove |

**Keep:** `CHART_COLORS`, `CHART_COLORS_EXTENDED`, `CHART_COLORS_SIMPLE`, `THEME_COLORS`,
`FONT_FAMILY`, `ECHARTS_THEME_LIGHT/DARK`, `ECHARTS_PERFORMANCE`, and their helper functions
(`getEChartsTheme`, `getChartColor`, `getThemeColors`) — all actively imported.

---

## Phase 3 — Shared Helpers (Deduplicate Logic)

**Goal:** Extract repeated per-page functions into shared utilities.

### 3a — `src/lib/utils/helpers.ts` (new file)

```ts
// Functions duplicated across 5-7 page components:
export function formatDate(date: Date | null): string;
export function getItemTitle(item: CollectionItem): string;
export function getProjectTitle(project: Project): string;
```

Then update all pages that define these locally to import from `$lib/utils/helpers`.

**Pages affected:** institutions, people, projects, languages, locations,
research-items, research-sections, resource-types, subjects

### 3b — `src/lib/utils/urlSelection.ts` (new file)

Extract the repeated URL-param selection pattern:

```ts
export function createUrlSelection(paramName: string): {
  selected: { value: string };
  select: (value: string) => void;
  clear: () => void;
  initFromUrl: (url: URL) => void;
};
```

**Pages affected:** institutions, people, languages, locations, subjects,
resource-types, projects (7 pages)

### 3c — `src/lib/utils/indexing.ts` (new file)

Generic data-indexing utility to replace repeated `Map` building:

```ts
export function buildIndex<T>(
  items: T[],
  keyExtractor: (item: T) => string | string[],
): Map<string, { name: string; count: number; items: T[] }>;
```

**Pages affected:** institutions, people, languages, locations, subjects,
resource-types (6 pages)

---

## Phase 4 — Shared Components (Deduplicate Markup)

### 4a — `CollectionItemRow.svelte` (new component)

Replace the identical `<li>` collection item rendering in 7 pages with a
reusable component:

```svelte
<CollectionItemRow {item} />
```

### 4b — `SelectableListHeader.svelte` (new component)

Replace the repeated "Back to list" + Badge header in sidebar panels.

### 4c — Consistent `EmptyState` usage

`empty-state.svelte` already exists but several pages use inline empty-state
markup. Convert those to use the shared component.

---

## Phase 5 — CSS Consistency

### 5a — Fix hardcoded colors in map components

| File | Issue | Fix |
|------|-------|-----|
| `LocationMap.svelte:447` | `'2px solid white'` | Use `hsl(var(--card))` or a semantic variable |
| `LocationMap.svelte:453` | `color = 'white'` | Use `hsl(var(--card))` |
| `LocationMap.svelte:448` | `rgba(0,0,0,0.3)` shadow | Use shadow token |
| `LocationMap.svelte:456` | `rgba(0,0,0,0.5)` text shadow | Use shadow token |
| `MiniMap.svelte:61` | `'2px solid white'` | Use `hsl(var(--card))` |
| `MiniMap.svelte:62` | `rgba(0,0,0,0.3)` shadow | Use shadow token |
| `app.css:443` | `.sidebar-logo-icon color: white` | Use `hsl(var(--primary-foreground))` |
| `app.css:607` | `.btn-primary color: white` | Use `hsl(var(--primary-foreground))` |

### 5b — Align CSS ↔ TypeScript chart colors

`tokens.css` defines `--chart-1` through `--chart-10` in HSL.
`tokens.ts` defines `CHART_COLORS` in hex.
**These are different colors.** Align them so the palette is single-source.

### 5c — Remove redundant CSS variable aliases

`app.css:233-234` defines `--sidebar-width: var(--layout-sidebar-width)`.
Use the token variable directly and remove the alias.

---

## Phase 6 — Future Improvements (Lower Priority)

- Create a generic search/filter composable for the repeated text-search pattern
- Create a pagination composable to replace per-page pagination state
- Audit unused CSS custom properties in `tokens.css` (~70 defined but unused)
- Consider whether `tokens.ts` runtime duplicates of CSS tokens are worth keeping
  vs. reading CSS custom property values at runtime

---

## Progress Tracker

| Phase | Status |
|-------|--------|
| 1 — ESLint + Prettier | **Done** (2026-03-18) |
| 2 — Dead code removal | **Done** (2026-03-18) |
| 3a — Shared helpers (`helpers.ts`) | **Done** (2026-03-18) |
| 3b — URL selection composable | **Done** (2026-03-18) |
| 3c — Data indexing utility | Deferred (pages too divergent for a single generic) |
| 4a — `CollectionItemRow` component | **Done** (2026-03-18) |
| 4b — `BackToList` component | **Done** (2026-03-18) |
| 4c — Consistent EmptyState | Skipped (inline `<p>` hints are appropriate in lists) |
| 5a — Hardcoded colors/shadows | **Done** (2026-03-18) |
| 5b — CSS ↔ TS chart color alignment | **Done** (2026-03-18) |
| 5c — CSS variable aliases | Skipped (scoped aliases are fine) |
| 6 — Future improvements | Not started |
