# AMIRA — Africa Multiple Interactive Research Atlas

Interactive research atlas for the [Africa Multiple Cluster of Excellence](https://www.africamultiple.uni-bayreuth.de/), exposing the cluster's WissKI/MongoDB archive as a browsable, analysable, visually-rich web app. Built with SvelteKit 5, ECharts 6, MapLibre GL 5, and Tailwind CSS 4 — shipped as an installable static PWA to GitHub Pages.

**Live:** <https://am-digital-research-environment.github.io/amira/>

## Scope

- **3,975** research items across **92** projects
- **1,394** persons, **492** institutions, **84** groups
- **146** cluster publications harvested from ERef Bayreuth and EPub Bayreuth, deduplicated across the two repositories
- **13** research sections — 6 Phase 1 (Affiliations, Arts & Aesthetics, Knowledges, Learning, Mobilities, Moralities), 6 Phase 2 (Accumulation, Digitalities, Ecologies, In/securities, Re:membering, Translating), and an "External" pseudo-section
- 4 partner universities (Bayreuth lead + UNILAG, UJKZ, Moi, Rhodes) plus 1 privileged partner (UFBA's CEAO, Salvador de Bahia)
- 2 external collections (BayGlo2025, ILAM)
- **Per-entity detail dashboards** for languages, subjects, tags, people, institutions, genres, resource types, groups, locations, research sections, and projects — all backed by precomputed JSON dumps under `static/data/entity_dashboards/`

## Features

### Dashboard

- **Overview** — summary stat cards (items, projects, contributors, institutions, languages, countries, subjects/tags), a cluster-locations MiniMap showing the geographic reach of the partnership, a featured-collections sneak-peek grid, global filter panel (resource type, language, university), stacked timeline by type, resource-type pie, subject bar chart, tag word cloud, research-section distribution, and a Research Section × University heatmap matrix. Phase 1 sections chart separately from Phase 2 (which begins June 2026).
- **What's New** — recent additions within a selectable window (3 / 6 / 12 months): top projects by new-item count, list of the most recent items, and a quick pivot into the detail views.

### Research

- **Research Sections** — the 13 sections with full descriptions, objectives, work programmes, spokespeople / PIs, members, and project Gantt timelines. Phase 1 sections show project charts; Phase 2 sections surface spokesperson info only (no projects until June 2026). Each section also opens an `EntityDashboard` of stacked timeline, resource type / language / subject breakdowns, decade heatmap, subject trends, time-aware chord, contributor network, and origin → current geo flows.
- **Projects** — faceted browser (research section, institution) with detail views showing description, PIs, members, institutions, paginated items, and WissKI links. Overview adds a Gantt timeline, beeswarm (projects by section and year, sized by item count), and bar charts for sections and institutions. Per-project detail pages now ship the full Phase 4 dashboard: stacked timeline, type / language / role pies, subjects bar, word cloud, type × decade heatmap, subject trends, sunburst, chord + time-aware chord, sankey, contributor network, geo flows, locations map, and knowledge graph.
- **Research Items** — full-text search and collapsible facets (subject, tag, country, project, language, resource type) over all 3,975 items, with a sortable table view. Detail view exposes title, abstract, contributors (role-qualified persons / institutions / groups), subjects (LCSH), tags, origin locations on a MiniMap, dates, language, identifiers, project, and a per-item entity knowledge graph with fullscreen mode. Below the detail card you'll find a `SiblingItemsSparkline` (year-by-year project timeline with the current item highlighted) and a `SimilarItemsStrip` (top-8 semantic-kNN matches via Gemini embeddings).
- **Publications** — cluster bibliography synced from [ERef Bayreuth](https://eref.uni-bayreuth.de/view/projekt/EXC_2052=3A_Africa_Multiple=3A_Reconfiguring_African_Studies.html) (EXC 2052 project view) and [EPub Bayreuth](https://epub.uni-bayreuth.de/view/divisions/340050.html) (Africa Multiple division view). The fetcher dedupes by DOI / ISBN / fuzzy title+year+author and merges cross-listed records; each card shows DOI, ERef, and / or EPub buttons depending on which repos carry the item. Stat cards (total, types, languages, matched authors), per-year stacked-by-type timeline, language pie, keyword wordcloud, full-text search across title / abstract / journal / author / DOI / keyword, faceted filters (type, year, language, keyword), and per-item BibTeX / RIS export plus bulk export of any filtered subset.

### Collections

- **Featured Collections** — curated showcase of photography and multimedia collections. Detail pages offer three synchronised views of the same deduped item set:
  - **Masonry** — responsive photo grid that reshuffles on resize and opens items in a photo lightbox (keyboard nav, metadata sidebar, deep-link to WissKI).
  - **Map** — MapLibre GL cluster map of capture locations with SPA-routed popups.
  - **Timeline** — chronological stacked view with zoom and type breakdown.
  - Faceted filters (creator, subject, tag, country, year), WebP thumbnails shipped with the build for fast first paint, and deduped `alias` counts for photos that appear in multiple records.
  - **History-aware navigation** — tab switches push to browser history and the open photo is mirrored to the URL (`?photo=…`), so browser Back closes the lightbox and steps through tab changes instead of jumping to the collections list.

### Directory and Categories — unified card-based browse + per-entity dashboards

All directory and category pages (**People**, **Groups**, **Institutions**, **Genres**, **Languages**, **Locations**, **Resource Types**, **Subjects & Tags**) share a consistent card-grid layout backed by reusable components (`EntityCard`, `EntityBrowseGrid`, `EntityToolbar`, `EntityDetailHeader`, `EntityItemsCard`) and utilities (`applyEntitySort`). Each card shows the entity name, descriptor, icon, count with label ("items", "projects", etc.), and type-specific meta chips; pages use a single toolbar with full-text search, count / alphabetical sort toggles, and a results badge. The grid paginates at 48 cards per page to keep long lists (1,000+ subjects, tags, cities) fast.

Detail views are opened via URL query params (e.g. `/people?name=John%20Doe`, `/genres?genre=Broadcast`) and the selection is driven by a writable `$derived` over `$page.url.searchParams` — so browser Back automatically clears the detail view and restores the card grid, deep links are shareable, and reload preserves state.

Each entity detail page now mounts an `<EntityDashboard>` populated from a precomputed per-entity JSON file. Layouts are declared in [`entityDashboardLayouts.ts`](src/lib/components/dashboards/entityDashboardLayouts.ts); slots auto-hide when their payload is empty, so the grid never carries placeholder cards.

#### Directory

- **People** — affiliation filter (searchable combobox), role filter, "hide empty" toggle, and rich profile views with research sections, projects (as PI or member), affiliations, a per-person dashboard (stacked timeline, resource types / languages / roles, top subjects, co-credited persons chord, projects + co-contributors network, affiliated institutions network, locations), paginated items with a per-item role badge, and a collaboration & influence knowledge graph.
- **Groups** — research groups and organisational units that author items, with per-group dashboards (timeline, types, languages, subjects, members & collaborators, locations) and knowledge graph.
- **Institutions** — partner / contributor filter toggle, per-institution dashboard (stacked timeline, types / languages, top subjects, affiliated contributors, contributor + affiliation networks, locations), projects (with PIs, dates, sections), people, items, and knowledge graph.

#### Categories

- **Genres** — MARC genre classification with a top-20 bar chart, a genre × language heatmap, and a card grid; per-genre detail pages include the standard `EntityDashboard` (timeline, types / languages, subjects, contributors, locations).
- **Languages** — ISO 639-2/3 codes rendered as full English names throughout. List page adds a stacked-area timeline and a language × resource-type heatmap; per-language detail pages render a 9-card dashboard plus a country choropleth.
- **Locations** — country / region / city browser with a **MapLibre GL browse map on top of the list** (markers coloured by type, clickable popups that SPA-route into the detail page), a country choropleth, top-cities bar, and tagged-items timeline. Each location detail shows a self-location MiniMap, the standard dashboard, and the knowledge graph.
- **Resource Types** — text, sound recording, still image, moving image, cartographic, mixed material, etc., with pie and bar charts, a stacked-area timeline, and a type × language heatmap; per-type detail pages render a full dashboard with subject trends.
- **Subjects & Tags** — toggle between LCSH controlled vocabulary and free-form tags, unified tag icon across both views, animated word cloud (up to 200 terms, adjustable size) with click-through, plus subject-trends overlay and an LCSH-vs-tag pie. Per-subject / per-tag detail pages add a co-subject network and the standard dashboard.

### Visualize

- **Project Explorer** — cross-project analytical workspace with section / project selectors and synchronised charts.
- **Compare** — single page (`/compare/[type]`) with a tab bar that switches among **projects**, **people**, **institutions**, **subjects**, **languages**, and **genres**. Every type renders the same primitives — stat row, 6-axis profile radar, shared-subjects chips, side-by-side stacked timelines + resource-type pies + top-subjects bars + language bars + contributor bars — with the data source swapped per type. `/compare/projects` covers university × project filters via on-the-fly aggregation off the loaded collections; the other types load precomputed entity-dashboard JSON. The legacy `/compare-projects` URL still works as a redirect to `/compare/projects`.
- **Network** — five interactive force-directed graph tabs, all weighted (edge thickness = strength of tie) and community-coloured:
  - **Contributors ↔ Projects** — weighted bipartite graph; edge width equals the number of items a person contributed to that project
  - **Co-authorship** — person ↔ person projection of the contributor graph, edges for pairs with ≥ 2 shared items
  - **People ↔ Institutions** — bipartite affiliations view
  - **Institution collaborations** — institutions joined when they share people on the same project
  - **Discursive communities** — Louvain communities detected across the whole archive, with the top-PageRank anchor of each cluster, built from the precomputed `_meta.json`
  - Filters: university, max nodes, resource type
- **Semantic Map** — 2D UMAP projection of Gemini-embedded item vectors. Scatter colourable by university, resource type, language, or research section; searchable and filterable; click a point to see the item and its top-12 cosine-similar neighbours. Similar-items payload is lazy-loaded on first selection.

### Cross-linking, WissKI, PWA, and SEO

Every named entity is a link:

- PIs, members, and contributors → People (persons) or Institutions / Groups (by qualifier)
- Project names → project detail
- Item titles → item detail + knowledge graph
- Section badges → section detail
- Institution badges → institutions page
- Language badges → languages page
- Location origins (city / region / country) → locations page
- Resource-type badges → resource types page
- Subject and tag badges → subjects & tags page

**WissKI Navigate** — Optional deep-links to WissKI entities surface throughout the dashboard via pre-computed URL mappings (`dev.wisski_urls.*.json`), connecting every dashboard record back to its source in the WissKI knowledge base.

**Chart downloads** — Every ECharts visualisation exposes a download button in its card header that exports the chart as a PNG with the card title, subtitle, and export date composited on top, using the site's typography and theme (light or dark).

**PWA** — The site ships a Web App Manifest ([`static/manifest.json`](static/manifest.json)) and a service worker ([`src/service-worker.js`](src/service-worker.js)) so it installs as a standalone app on desktop and mobile, with offline shell and shortcuts to What's New / Projects / Research Items / Network. Theme colour, maskable icons, and orientation hints are all set.

**SEO** — Every route ships a `<SEO>` component that emits Open Graph + Twitter Card tags and a canonical URL; the build also pre-renders [`/sitemap.xml`](src/routes/sitemap.xml/+server.ts) covering both static routes and every entity-detail URL discovered by scanning `static/data/entity_dashboards/`.

**Mobile UX** — The whole app is touch-friendly on a phone: pagination controls scroll the list back into view on tap, stat cards stack with sensible truncation, the Gantt timeline collapses to a vertical list, empty states render at full card width, and the sidebar slides over the content rather than reflowing it.

## Tech Stack

- **Framework** — [SvelteKit](https://svelte.dev/docs/kit) 5 with [Svelte 5 runes](https://svelte.dev/docs/svelte/what-are-runes) (`$state`, `$derived`, `$derived.by`, `$effect`, `$props`)
- **Build** — [Vite](https://vite.dev/) 8 with Rolldown
- **Charts** — [ECharts](https://echarts.apache.org/) 6 + [echarts-wordcloud](https://github.com/ecomfe/echarts-wordcloud)
- **Maps** — [MapLibre GL](https://maplibre.org/) 5 (LocationMap, MiniMap, ChoroplethMap, GeoFlowMap, PhotoMap — all with a Flat / Globe projection toggle where applicable)
- **Embeddings** — Gemini Embedding 2 (`gemini-embedding-2-preview`, 768-dim) projected to 2D with UMAP for the semantic map
- **Styling** — [Tailwind CSS](https://tailwindcss.com/) 4 via `@tailwindcss/vite`, HSL CSS-variable theming, dark mode
- **UI Components** — custom shadcn-svelte-inspired primitives (Card, Badge, Pagination, StatCard, ChartCard, Tabs, Select, Combobox, ScrollableTable, EmptyState, SEO…)
- **Icons** — [`@lucide/svelte`](https://lucide.dev/)
- **Linting** — ESLint 10 + typescript-eslint + eslint-plugin-svelte
- **Formatting** — Prettier 3 + prettier-plugin-svelte
- **Deployment** — GitHub Pages via `@sveltejs/adapter-static` and GitHub Actions

## Chart Components

| Component              | Type             | Description                                                                                                                                                                        |
| ---------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Timeline`             | Bar              | Count-by-year timeline                                                                                                                                                             |
| `StackedTimeline`      | Stacked bar      | Items per year, broken down by resource type                                                                                                                                       |
| `StackedAreaChart`     | Stacked area     | Subject / language trends over time (top-N stream)                                                                                                                                 |
| `BarChart`             | Bar              | Horizontal / vertical bar with pagination for long lists                                                                                                                           |
| `PieChart`             | Pie / donut      | Categorical distribution with click selection                                                                                                                                      |
| `WordCloud`            | Word cloud       | Animated tag / subject cloud with adjustable max words                                                                                                                             |
| `HeatmapChart`         | Heatmap          | Matrix cross-tabulation with colour intensity                                                                                                                                      |
| `CalendarHeatmap`      | Calendar         | Year × month / day activity intensity                                                                                                                                              |
| `BeeswarmChart`        | Scatter / jitter | Beeswarm distribution using ECharts 6 axis jitter                                                                                                                                  |
| `BoxPlot`              | Box plot         | Five-number summary + outliers, computed from raw observations                                                                                                                     |
| `RadarChart`           | Radar            | 5–7 axis polygon overlay; powers the compare-page profile                                                                                                                          |
| `GanttChart`           | Custom bar range | Project timelines with start / end bars, category colouring                                                                                                                        |
| `SankeyChart`          | Sankey           | Multi-level flow diagram (e.g. contributor → project → type)                                                                                                                       |
| `SunburstChart`        | Sunburst         | Hierarchical drill-down visualisation                                                                                                                                              |
| `TreemapChart`         | Treemap          | Proportional rectangles for hierarchical breakdowns                                                                                                                                |
| `ChordDiagram`         | Chord            | Co-occurrence relationships between categories                                                                                                                                     |
| `TimeAwareChord`       | Chord + slider   | Chord diagram with year slider + play/pause; data is sparse year buckets                                                                                                           |
| `SemanticScatter`      | Scatter          | UMAP projection of Gemini embeddings; colourable by four dimensions                                                                                                                |
| `NetworkGraph`         | Force graph      | Weighted force-directed network: edge width follows edge value, dashed for latent ties, solid for direct metadata edges; optional community halos                                  |
| `ContributorNetwork`   | Force graph      | Bipartite person ↔ project / institution graph built on `NetworkGraph`                                                                                                             |
| `EntityKnowledgeGraph` | Force graph      | Per-entity ego graph with IDF-weighted direct edges + latent edges via Jaccard / personalised PageRank, discursive communities, PageRank-sized nodes, facet panel, fullscreen mode |
| `LocationMap`          | Map              | MapLibre GL multi-marker map with clustered popups, Flat / Globe projection toggle                                                                                                 |
| `MiniMap`              | Map              | Lightweight single-location map with marker                                                                                                                                        |
| `ChoroplethMap`        | Map              | Country-level fill on Natural Earth 110m, log-spaced colour ramp                                                                                                                   |
| `GeoFlowMap`           | Map              | Great-circle origin → current arcs on MapLibre                                                                                                                                     |
| `LocationsMapView`     | Map switcher     | Toggles a single dashboard slot between `LocationMap` (points) and `ChoroplethMap` (countries)                                                                                     |
| `EChart`               | Base wrapper     | Shared ECharts wrapper: dynamic theme switching via `setTheme()`, zoom controls, resize handling, performance heuristics                                                           |
| `ChartDownloadButton`  | Action           | Exports the parent chart as a PNG with title, subtitle, and export date composited on top; auto-wired to any chart hosted inside a `ChartCard`                                     |

## Development

```bash
npm install
npm run dev           # dev server
npm run build         # production build
npm run preview       # preview production build
npm run check         # svelte-kit sync + svelte-check
npm run lint          # ESLint
npm run format        # Prettier write
npm run format:check  # Prettier check (CI uses this)
```

CI runs `format:check`, so run `npm run format` locally before committing if the check fails.

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/              # Reusable UI primitives
│   │   │   ├── card*.svelte, badge, button, input, select, combobox, tabs
│   │   │   ├── pagination, stat-card, chart-card, scrollable-table
│   │   │   ├── collection-item-row, back-to-list, empty-state
│   │   │   ├── section-badge, wisski-link, scroll-to-top, seo
│   │   ├── charts/          # ECharts + MapLibre chart components
│   │   │   ├── EChart.svelte              # Base wrapper
│   │   │   ├── ChartDownloadButton.svelte # PNG export with title / subtitle composited
│   │   │   ├── chart-registry.ts          # Context bridge: chart instance ↔ ChartCard header
│   │   │   ├── Timeline, StackedTimeline, StackedAreaChart
│   │   │   ├── BarChart, PieChart, WordCloud
│   │   │   ├── HeatmapChart, CalendarHeatmap, BeeswarmChart, BoxPlot
│   │   │   ├── RadarChart, GanttChart
│   │   │   ├── SankeyChart, SunburstChart, TreemapChart
│   │   │   ├── ChordDiagram, TimeAwareChord
│   │   │   ├── NetworkGraph, ContributorNetwork, EntityKnowledgeGraph
│   │   │   ├── SemanticScatter
│   │   │   ├── LocationMap, MiniMap, ChoroplethMap, GeoFlowMap, LocationsMapView
│   │   │   ├── map/                       # Projection toggle, marker / popup builders
│   │   │   └── utils/                     # Shared option builders & tooltip formatters
│   │   ├── dashboards/      # Per-entity detail dashboards
│   │   │   ├── EntityDashboard.svelte         # Generic chart-grid renderer
│   │   │   ├── EntityDashboardSection.svelte  # Loader wrapper for pages
│   │   │   ├── ChartSlot.svelte               # Dispatches chart key → component
│   │   │   └── entityDashboardLayouts.ts      # ENTITY_LAYOUTS + ChartKey + emptiness rules
│   │   ├── compare/         # Side-by-side compare primitives
│   │   │   ├── CompareTabs, CompareStatRow, CompareSharedSubjects
│   │   │   ├── CompareProfileRadar, ComparePair
│   │   │   ├── ProjectsCompare (on-the-fly aggregation)
│   │   │   ├── EntityCompare (precomputed JSON)
│   │   │   └── compareTypes.ts, compareProfile.ts
│   │   ├── collections/     # Featured-collection components
│   │   │   ├── CollectionHeader, CollectionIndexCard
│   │   │   ├── PhotoCard, PhotoFacets, PhotoLightbox
│   │   │   ├── PhotoMasonry, PhotoMap, PhotoTimeline
│   │   │   ├── ViewModeTabs, photoHelpers.ts
│   │   ├── entity-browse/   # Unified card-grid components for directory / categories
│   │   │   ├── EntityCard, EntityCardGrid, EntityBrowseGrid (grid + pagination)
│   │   │   ├── EntityToolbar (search + sort + total), EntityDetailHeader
│   │   │   ├── EntityItemsCard, SearchableItemsCard
│   │   │   ├── EntityEmptyHint, sort.ts (applyEntitySort)
│   │   ├── layout/          # Sidebar (grouped nav), Header, FilterPanel
│   │   └── research-items/  # ItemDetail, ItemFilters, ItemTable, itemHelpers,
│   │       │                # SiblingItemsSparkline, SimilarItemsStrip
│   ├── stores/
│   │   ├── data.ts          # Raw data + derived stores (projects, persons, collections…)
│   │   └── filters.ts       # Global filter state
│   ├── styles/              # Tokens, animations, component CSS, sidebar, maplibre
│   ├── types/               # TS interfaces (domain, collection, charts, geo, mongo, embeddings, category-index)
│   └── utils/
│       ├── transforms/      # dates, grouping, extractors, network, charts, filters
│       ├── loaders/         # mongoJSON, collectionLoader, geolocLoader, embeddingsLoader,
│       │                    # entityDashboardLoader (per-entity JSON + manifest)
│       ├── external.ts      # Virtual external projects (BayGlo2025, ILAM) + pseudo-section
│       ├── helpers.ts       # formatDate, getItemTitle, getProjectTitle, getSectionColor
│       ├── languages.ts     # ISO 639-2/3 → English name mapping
│       ├── urls.ts          # Cross-linking URL builders
│       ├── urlSelection.ts  # URL query-param sync for selection state
│       ├── search.ts        # Generic text-search filter factory
│       ├── pagination.ts    # Generic pagination utility
│       ├── slugify.ts       # URL-safe slug generator (kept in sync with the precompute pipeline)
│       ├── wisskiUrl.svelte.ts  # WissKI navigate URL lookup (Svelte store)
│       ├── featuredCollectionLoader.ts  # Featured collections card builder
│       ├── collectionsRegistry.ts       # Featured collection metadata registry
│       ├── revealOnScroll.ts            # IntersectionObserver-based reveal actions
│       └── cn.ts            # Classname merging (clsx + tailwind-merge)
├── routes/
│   ├── +page.svelte              # Overview dashboard
│   ├── +layout.svelte            # Global layout (Header, Sidebar, data init)
│   ├── whats-new/                # Recent additions (3 / 6 / 12 months)
│   ├── research-sections/        # 13 sections + per-section EntityDashboard
│   ├── projects/                 # Projects + per-project full-parity dashboard
│   ├── research-items/           # Research items browser; detail = KG + sparkline + similar
│   ├── publications/             # Cluster bibliography (ERef + EPub Bayreuth, deduped)
│   ├── people/                   # People directory + per-person dashboard
│   ├── groups/                   # Research groups + per-group dashboard
│   ├── institutions/             # Institutions + per-institution dashboard
│   ├── collections/              # Featured collections index
│   ├── collections/[slug]/       # Collection detail: masonry / map / timeline
│   ├── genres/                   # Genres + per-genre dashboard
│   ├── languages/                # Languages + per-language dashboard
│   ├── locations/                # Locations + browse map + per-location dashboard
│   ├── resource-types/           # Resource types + per-type dashboard
│   ├── subjects/                 # Subjects & Tags + per-entity dashboard
│   ├── project-explorer/         # Cross-project analytical workspace
│   ├── compare/[type]/           # Generic compare (projects | people | institutions |
│   │                             #   subjects | languages | genres) — uses CompareTabs
│   ├── compare-projects/         # Legacy redirect → /compare/projects
│   ├── network/                  # Network visualisation (5 tabs)
│   ├── semantic-map/             # UMAP embedding scatter with similar-items
│   └── sitemap.xml/              # Prerendered sitemap (static + entity-detail URLs)
├── service-worker.js             # PWA shell + asset cache
└── app.css                       # Global styles and Tailwind v4 config

static/
├── manifest.json                # PWA manifest (name, icons, shortcuts, theme colour)
├── robots.txt
├── icons/                       # PWA icons (192 / 512 + maskable)
├── data/
│   ├── manifest.json              # Per-university collection inventory
│   ├── dev/                       # MongoDB exports + WissKI URL mappings
│   ├── manual/                    # Hand-curated supplements (e.g. projectLinks)
│   ├── geo/                       # Natural Earth 110m country GeoJSON for choropleth
│   ├── entity_dashboards/         # Precomputed per-entity dashboard JSON
│   │   ├── manifest.json            # `{ <dir>: [{id, name, count}, ...] }`
│   │   ├── languages/, subjects/, tags/, people/, institutions/,
│   │   ├── genres/, resource-types/, groups/, locations/,
│   │   └── research-sections/, projects/
│   ├── knowledge_graphs/          # Pre-computed ego graphs per entity type + _meta.json
│   ├── embeddings/                # map.json (UMAP) + similar.json (top-K neighbours)
│   ├── projects_metadata_ubt/     # University of Bayreuth (21 collections)
│   ├── projects_metadata_unilag/  # University of Lagos (8 collections)
│   ├── projects_metadata_ujkz/    # Université Joseph Ki-Zerbo (7 collections)
│   ├── projects_metadata_ufba/    # Federal University of Bahia (1 collection)
│   └── external_metadata/         # External collections (BayGlo2025, ILAM)
└── logos/                         # Partner institution logos used across the UI
```

## Data Sources

### MongoDB exports — `static/data/dev/`

- **`dev.projectsData.json`** — 92 projects with PIs, members, dates, research sections, institutions, RDSpace references
- **`dev.persons.json`** — 1,394 person records with institutional affiliations
- **`dev.institutions.json`** — 492 institution records
- **`dev.groups.json`** — 84 research-group records
- **`dev.collections.json`** — development-only collection items
- **`dev.researchSections.json`** — all 13 research sections (Phase 1 + Phase 2 + External)
- **`dev.geo.json`** — country / region / subregion / city geolocations with Wikidata coordinates
- **`dev.wisski_urls.*.json`** — pre-computed WissKI navigate URL mappings for every entity type (projects, persons, institutions, items, subjects, tags, countries, regions, cities, genres, groups, languages, research sections, resource types)

### Partner-university collections — `static/data/projects_metadata_*/`

3,975 research items across four partners. Each item carries title, contributors (person / institution / group qualifier with roles), subjects (LCSH), tags, language (ISO 639-2/3), location (country / region / city), dates (created, issued, captured), identifiers, physical description, access conditions, and bitstream / URL references.

### External collections — `static/data/external_metadata/`

Items contributed from outside the cluster's partner universities. Tagged `university: "external"` so they count toward global totals but can be filtered out of per-university views:

- **`BayGlo2025`** — Bayreuth Global / Bayreuth Postkolonial; affiliated with the University of Bayreuth
- **`ILAM`** — International Library of African Music (Rhodes University)

Surfaced across the dashboard as virtual projects (`Ext_BayGlo2025`, `Ext_ILAM`) under an **External** pseudo research section, with a dedicated chip in the global filter panel and a dedicated group in the Project Explorer and Compare selectors. Virtual-project definitions live in [`src/lib/utils/external.ts`](src/lib/utils/external.ts).

### Entity dashboards — `static/data/entity_dashboards/`

Pre-computed JSON dumps powering the per-entity detail pages and the `/compare/[type]` selectors. One file per entity instance, organised by directory:

```
entity_dashboards/
├── manifest.json                # `{ <dir>: [{id, name, count}, ...] }`
├── languages/{code}.json        # 28 entries
├── subjects/{slug}.json         # 620 entries
├── tags/{slug}.json             # 1,100 entries
├── people/{slug}.json           # 1,174 entries
├── institutions/{slug}.json     # 459 entries
├── genres/{slug}.json           # 129 entries
├── resource-types/{slug}.json   # 11 entries
├── groups/{slug}.json           # 84 entries
├── locations/{slug}.json        # 252 entries
├── research-sections/{slug}.json # 6 entries
└── projects/{id}.json           # 38 entries
```

Each JSON contains all the chart payloads needed to render its entity's dashboard (`timeline`, `stackedTimeline`, `types`, `languages`, `subjects`, `wordCloud`, `contributors`, `roles`, `heatmap`, `chord`, `coContributors`, `coSubjects`, `sankey`, `sunburst`, `treemap`, `subjectTrends`, `locations`, `selfLocation`, `geoFlows`, `contributorNetwork`, `affiliationNetwork`, `collabNetwork`, `meta`, `items`). Generated by [`scripts/precompute_entity_dashboards.py`](scripts/precompute_entity_dashboards.py); the loader lives at [`src/lib/utils/loaders/entityDashboardLoader.ts`](src/lib/utils/loaders/entityDashboardLoader.ts).

### Knowledge graphs — `static/data/knowledge_graphs/`

Structural ego graphs pre-computed by [`scripts/generate_knowledge_graphs.py`](scripts/generate_knowledge_graphs.py) — one JSON file per entity organised by type:

```
knowledge_graphs/
├── _meta.json            # Global community labels + top-PageRank nodes
├── items/                # Research-item ego graphs
├── persons/
├── projects/
├── institutions/
├── subjects/
├── tags/
├── locations/
└── genres/
```

Each graph combines **direct** metadata edges (IDF-weighted so distinctive relationships look heavier than ubiquitous ones), **latent** structural edges (Jaccard on shared neighbourhoods + personalised PageRank for multi-hop relevance), and global analysis results (Louvain community membership, PageRank-based centrality) so the UI can reveal discursive communities and key nodes that local co-occurrence alone would miss.

### Embeddings — `static/data/embeddings/`

- **`map.json`** — per-item `{id, x, y, lowSignal, title, project, university, typeOfResource}` for the 2D UMAP scatter
- **`similar.json`** — per-item top-12 cosine-similar neighbours keyed by `dre_id` (lazy-loaded on first selection on `/semantic-map`, also consumed by `SimilarItemsStrip` on `/research-items?id=…`)
- `cache.json` — full 768-dim Gemini vectors + SHA-256 hashes used for incremental re-embedding; gitignored

Pipelined by [`scripts/generate_embeddings.py`](scripts/generate_embeddings.py). See [scripts/README.md](scripts/README.md) for details.

### Cluster publications — `static/data/publications.json`

146 publications harvested from two University of Bayreuth EPrints repositories and merged into a single normalised payload:

- **ERef Bayreuth** ([EXC 2052 projekt view](https://eref.uni-bayreuth.de/view/projekt/EXC_2052=3A_Africa_Multiple=3A_Reconfiguring_African_Studies.html)) — 127 records; the cluster's primary archive
- **EPub Bayreuth** ([Africa Multiple division view](https://epub.uni-bayreuth.de/view/divisions/340050.html)) — 50 records; open-access repository

Three EPrints 3 export endpoints are consumed per source: bulk **BibTeX** (canonical metadata), **RSS** (deposit dates → year / quarter buckets), and **EP3 XML** (abstracts, structured keywords, GND author IDs, languages, related / publisher DOIs, volume editors). Cross-source deduplication runs three tiers — **DOI** (with author / title sanity guard so book-level DOIs don't merge sibling chapters), **ISBN** (books and periodicals only), and **fuzzy** (normalized title + year + first-author surname) — folding the 31 cross-listed records into single entries that carry both `eref_url` and `epub_url`. Generated by [`scripts/fetch_publications.py`](scripts/fetch_publications.py); the loader lives at [`src/lib/utils/loaders/publicationsLoader.ts`](src/lib/utils/loaders/publicationsLoader.ts).

### Geographic data — `static/data/geo/`

- **`world-countries-110m.json`** — Natural Earth 110m country boundaries (TopoJSON) used by `ChoroplethMap`. Bundled once with the build; smaller than the 50m / 10m datasets at the cost of coastline detail.

### Manual data — `static/data/manual/`

Hand-curated data not sourced from MongoDB:

- `projectLinks.json` — supplementary project-to-entity links

## Scripts

Python pipelines live in [`scripts/`](scripts/) and cover MongoDB export, WissKI URL generation, thumbnail fetching, knowledge-graph generation, embedding generation, per-entity dashboard precompute, and data slimming. Setup:

```bash
python -m venv .venv
.venv/Scripts/pip install -r scripts/requirements.txt
```

Key scripts (see [scripts/README.md](scripts/README.md) for the full list and inputs / outputs):

- **`fetch_from_mongodb.py`** — pull research items + reference data from the WissKI MongoDB
- **`generate_wisski_urls.py`** — emit pre-computed `dev.wisski_urls.*.json` lookups for the WissKI Navigate links
- **`fetch_thumbnails.py`** — download remote `previewImage` URLs as local WebP thumbnails so the first paint doesn't hit the public archive
- **`fetch_publications.py`** — harvest BibTeX / RSS / EP3 XML from ERef Bayreuth (projekt view) and EPub Bayreuth (Africa Multiple division view), deduplicate across sources by DOI / ISBN / fuzzy title-author-year, and emit `static/data/publications.json`
- **`generate_knowledge_graphs.py`** — compute the ego-graph JSON consumed by `EntityKnowledgeGraph` and `/network?tab=communities`
- **`generate_embeddings.py`** — run Gemini Embedding 2 over the corpus, project to 2D with UMAP, emit `map.json` + `similar.json`
- **`precompute_entity_dashboards.py`** — generate one JSON per entity under `static/data/entity_dashboards/`, plus the global manifest. Supports `--from-local`, per-type runs, and `--dry-run`. The manifest writer merges with the existing file so a single-entity run doesn't wipe the others' entries
- **`slim_data.py`** — strip development-only fields before shipping production data

Regenerate everything after a metadata refresh:

```bash
.venv/Scripts/python scripts/generate_knowledge_graphs.py
.venv/Scripts/python scripts/generate_embeddings.py --scope missing
.venv/Scripts/python scripts/precompute_entity_dashboards.py --entity all --from-local
```

## Deployment

Deploys automatically to GitHub Pages on push to `main`:

- **Workflow:** [.github/workflows/deploy.yml](.github/workflows/deploy.yml) — `npm ci` → `npm run build` with `BASE_PATH=/${{ github.event.repository.name }}` → `actions/upload-pages-artifact` → `actions/deploy-pages`
- **Adapter:** [`@sveltejs/adapter-static`](https://svelte.dev/docs/kit/adapter-static) pre-renders every route into `build/`
- **Live URL:** <https://am-digital-research-environment.github.io/amira/>
- **CI:** [.github/workflows/ci.yml](.github/workflows/ci.yml) runs `npm run format:check`, `npm run lint`, `npm run check`, and `npm run build` on every push and PR

## Credits

Developed by [Frédérick Madore](https://www.frederickmadore.com/) for the [Digital Research Environment (DRE)](https://www.africamultiple.uni-bayreuth.de/en/1_5-Digital-Solutions1/index.html) of the [Africa Multiple Cluster of Excellence](https://www.africamultiple.uni-bayreuth.de/), University of Bayreuth.

## License

MIT
