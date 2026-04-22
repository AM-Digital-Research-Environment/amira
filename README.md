# AMIRA — Africa Multiple Interactive Research Atlas

Interactive research atlas for the [Africa Multiple Cluster of Excellence](https://www.africamultiple.uni-bayreuth.de/), exposing the cluster's WissKI/MongoDB archive as a browsable, analysable, visually-rich web app. Built with SvelteKit 5, ECharts 6, MapLibre GL 5, and Tailwind CSS 4 — shipped as a static site to GitHub Pages.

**Live:** <https://am-digital-research-environment.github.io/amira/>

## Scope

- **3,975** research items across **92** projects
- **1,394** persons, **492** institutions, **84** groups
- **13** research sections — 6 Phase 1 (Affiliations, Arts & Aesthetics, Knowledges, Learning, Mobilities, Moralities), 6 Phase 2 (Accumulation, Digitalities, Ecologies, In/securities, Re:membering, Translating), and an "External" pseudo-section
- 4 partner universities (Bayreuth lead + UNILAG, UJKZ, Moi, Rhodes) plus 1 privileged partner (UFBA's CEAO, Salvador de Bahia)
- 2 external collections (BayGlo2025, ILAM)

## Features

### Dashboard

- **Overview** — summary stat cards (items, projects, contributors, institutions, languages, countries, subjects/tags), a cluster-locations MiniMap showing the geographic reach of the partnership, a featured-collections sneak-peek grid, global filter panel (resource type, language, university), stacked timeline by type, resource-type pie, subject bar chart, tag word cloud, research-section distribution, and a Research Section × University heatmap matrix. Phase 1 sections chart separately from Phase 2 (which begins June 2026).
- **What's New** — recent additions within a selectable window (3 / 6 / 12 months): top projects by new-item count, list of the most recent items, and a quick pivot into the detail views.

### Research

- **Research Sections** — the 13 sections with full descriptions, objectives, work programmes, spokespeople / PIs, members, and project Gantt timelines. Phase 1 sections show project charts; Phase 2 sections surface spokesperson info only (no projects until June 2026).
- **Projects** — faceted browser (research section, institution) with detail views showing description, PIs, members, institutions, paginated items, and WissKI links. Overview adds a Gantt timeline, beeswarm (projects by section and year, sized by item count), and bar charts for sections and institutions.
- **Research Items** — full-text search and collapsible facets (subject, tag, country, project, language, resource type) over all 3,975 items, with a sortable table view. Detail view exposes title, abstract, contributors (role-qualified persons / institutions / groups), subjects (LCSH), tags, origin locations on a MiniMap, dates, language, identifiers, project, and a per-item entity knowledge graph with fullscreen mode.

### Directory

- **People** — searchable directory of researchers, PIs, and item contributors with affiliations. Profile view shows research sections, projects (as PI or member), and paginated items.
- **Groups** — research groups and organisational units that author items.
- **Institutions** — partner institutions (from projects) and contributor organisations (from items) with associated projects, people, and item counts.

### Collections

- **Featured Collections** — curated showcase of photography and multimedia collections. Detail pages offer three synchronised views of the same deduped item set:
  - **Masonry** — responsive photo grid that reshuffles on resize and opens items in a photo lightbox (keyboard nav, metadata sidebar, deep-link to WissKI).
  - **Map** — MapLibre GL cluster map of capture locations with SPA-routed popups.
  - **Timeline** — chronological stacked view with zoom and type breakdown.
  - Faceted filters (creator, subject, tag, country, year), WebP thumbnails shipped with the build for fast first paint, and deduped `alias` counts for photos that appear in multiple records.

### Categories

- **Genres** — MARC genre classification with word cloud and item counts.
- **Languages** — items by language, ISO 639-2/3 codes rendered as full English names throughout the app.
- **Locations** — country / region / city browser with an interactive map (falls back to country centroid when no finer coordinates exist) and paginated items.
- **Resource Types** — text, sound recording, still image, moving image, cartographic, mixed material, etc., with pie and bar charts — click to filter.
- **Subjects & Tags** — toggle between LCSH controlled vocabulary and free-form tags. Animated word cloud (up to 200 terms, adjustable size) with click-through, plus a searchable paginated list.

### Visualize

- **Project Explorer** — cross-project analytical workspace with section / project selectors and synchronised charts.
- **Compare Projects** — side-by-side comparison of two university / project selections with synchronised stacked timelines, subject distributions, resource-type breakdowns, and language distributions.
- **Network** — five interactive force-directed graph tabs, all weighted (edge thickness = strength of tie) and community-coloured:
  - **Contributors ↔ Projects** — weighted bipartite graph; edge width equals the number of items a person contributed to that project
  - **Co-authorship** — person ↔ person projection of the contributor graph, edges for pairs with ≥ 2 shared items
  - **People ↔ Institutions** — bipartite affiliations view
  - **Institution collaborations** — institutions joined when they share people on the same project
  - **Discursive communities** — Louvain communities detected across the whole archive, with the top-PageRank anchor of each cluster, built from the precomputed `_meta.json`
  - Filters: university, max nodes, resource type
- **Semantic Map** — 2D UMAP projection of Gemini-embedded item vectors. Scatter colourable by university, resource type, language, or research section; searchable and filterable; click a point to see the item and its top-12 cosine-similar neighbours. Similar-items payload is lazy-loaded on first selection.

### Cross-linking & WissKI integration

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

## Tech Stack

- **Framework** — [SvelteKit](https://svelte.dev/docs/kit) 5 with [Svelte 5 runes](https://svelte.dev/docs/svelte/what-are-runes) (`$state`, `$derived`, `$derived.by`, `$effect`, `$props`)
- **Build** — [Vite](https://vite.dev/) 8 with Rolldown
- **Charts** — [ECharts](https://echarts.apache.org/) 6 + [echarts-wordcloud](https://github.com/ecomfe/echarts-wordcloud)
- **Maps** — [MapLibre GL](https://maplibre.org/) 5 (LocationMap, MiniMap, PhotoMap — all with a Flat / Globe projection toggle)
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
| `Timeline`             | Line             | Count-by-year timeline                                                                                                                                                             |
| `StackedTimeline`      | Stacked bar      | Items per year, broken down by resource type                                                                                                                                       |
| `BarChart`             | Bar              | Horizontal / vertical bar with pagination for long lists                                                                                                                           |
| `PieChart`             | Pie / donut      | Categorical distribution with click selection                                                                                                                                      |
| `WordCloud`            | Word cloud       | Animated tag / subject cloud with adjustable max words                                                                                                                             |
| `HeatmapChart`         | Heatmap          | Matrix cross-tabulation with colour intensity                                                                                                                                      |
| `BeeswarmChart`        | Scatter / jitter | Beeswarm distribution using ECharts 6 axis jitter                                                                                                                                  |
| `GanttChart`           | Custom bar range | Project timelines with start / end bars, category colouring                                                                                                                        |
| `SankeyChart`          | Sankey           | Multi-level flow diagram (e.g. contributor → project → type)                                                                                                                       |
| `SunburstChart`        | Sunburst         | Hierarchical drill-down visualisation                                                                                                                                              |
| `ChordDiagram`         | Chord            | Co-occurrence relationships between categories                                                                                                                                     |
| `SemanticScatter`      | Scatter          | UMAP projection of Gemini embeddings; colourable by four dimensions                                                                                                                |
| `NetworkGraph`         | Force graph      | Weighted force-directed network: edge width follows edge value, dashed for latent ties, solid for direct metadata edges; optional community halos                                  |
| `EntityKnowledgeGraph` | Force graph      | Per-entity ego graph with IDF-weighted direct edges + latent edges via Jaccard / personalised PageRank, discursive communities, PageRank-sized nodes, facet panel, fullscreen mode |
| `LocationMap`          | Map              | MapLibre GL multi-marker map with clustered popups, Flat / Globe projection toggle                                                                                                 |
| `MiniMap`              | Map              | Lightweight single-location map with marker                                                                                                                                        |
| `EChart`               | Base wrapper     | Shared ECharts wrapper: dynamic theme switching via `setTheme()`, zoom controls, resize handling, performance heuristics                                                           |

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
│   │   │   ├── Timeline, StackedTimeline
│   │   │   ├── BarChart, PieChart, WordCloud
│   │   │   ├── HeatmapChart, BeeswarmChart, GanttChart
│   │   │   ├── SankeyChart, SunburstChart, ChordDiagram
│   │   │   ├── NetworkGraph, EntityKnowledgeGraph
│   │   │   ├── SemanticScatter
│   │   │   ├── LocationMap, MiniMap
│   │   │   ├── map/                       # Projection toggle, marker / popup builders
│   │   │   └── utils/                     # Shared option builders & tooltip formatters
│   │   ├── collections/     # Featured-collection components
│   │   │   ├── CollectionHeader, CollectionIndexCard
│   │   │   ├── PhotoCard, PhotoFacets, PhotoLightbox
│   │   │   ├── PhotoMasonry, PhotoMap, PhotoTimeline
│   │   │   ├── ViewModeTabs, photoHelpers.ts
│   │   ├── layout/          # Sidebar (grouped nav), Header, FilterPanel
│   │   └── research-items/  # ItemDetail, ItemFilters, ItemTable, itemHelpers
│   ├── stores/
│   │   ├── data.ts          # Raw data + derived stores (projects, persons, collections…)
│   │   └── filters.ts       # Global filter state
│   ├── styles/              # Tokens, animations, component CSS, sidebar, maplibre
│   ├── types/               # TS interfaces (domain, collection, charts, geo, mongo, embeddings, category-index)
│   └── utils/
│       ├── transforms/      # dates, grouping, extractors, network, charts, filters
│       ├── loaders/         # mongoJSON, collectionLoader, geolocLoader, embeddingsLoader
│       ├── external.ts      # Virtual external projects (BayGlo2025, ILAM) + pseudo-section
│       ├── helpers.ts       # formatDate, getItemTitle, getProjectTitle, getSectionColor
│       ├── languages.ts     # ISO 639-2/3 → English name mapping
│       ├── urls.ts          # Cross-linking URL builders
│       ├── urlSelection.ts  # URL query-param sync for selection state
│       ├── search.ts        # Generic text-search filter factory
│       ├── pagination.ts    # Generic pagination utility
│       ├── wisskiUrl.svelte.ts  # WissKI navigate URL lookup (Svelte store)
│       ├── featuredCollectionLoader.ts  # Featured collections card builder
│       ├── collectionsRegistry.ts       # Featured collection metadata registry
│       ├── revealOnScroll.ts            # IntersectionObserver-based reveal actions
│       └── cn.ts            # Classname merging (clsx + tailwind-merge)
├── routes/
│   ├── +page.svelte              # Overview dashboard
│   ├── +layout.svelte            # Global layout (Header, Sidebar, data init)
│   ├── whats-new/                # Recent additions (3 / 6 / 12 months)
│   ├── research-sections/        # 13 sections with Gantt timelines
│   ├── projects/                 # Projects with facets, Gantt, beeswarm
│   ├── research-items/           # Research items browser with facets, table, detail
│   ├── people/                   # People directory with profiles
│   ├── groups/                   # Research groups
│   ├── institutions/             # Institutions (partner + contributor)
│   ├── collections/              # Featured collections index
│   ├── collections/[slug]/       # Collection detail: masonry / map / timeline
│   ├── genres/                   # Genre browser with word cloud
│   ├── languages/                # Language browser
│   ├── locations/                # Country / region / city browser with maps
│   ├── resource-types/           # Resource-type browser with pie / bar
│   ├── subjects/                 # Subjects & Tags with word cloud
│   ├── project-explorer/         # Cross-project analytical workspace
│   ├── compare-projects/         # Side-by-side comparison
│   ├── network/                  # Network visualisation (5 tabs)
│   ├── semantic-map/             # UMAP embedding scatter with similar-items
│   └── sitemap.xml/              # Prerendered sitemap
└── app.css                       # Global styles and Tailwind v4 config

static/
├── data/
│   ├── manifest.json               # Per-university collection inventory
│   ├── dev/                        # MongoDB exports + WissKI URL mappings
│   ├── manual/                     # Hand-curated supplements (e.g. projectLinks)
│   ├── knowledge_graphs/           # Pre-computed ego graphs per entity type + _meta.json
│   ├── embeddings/                 # map.json (UMAP) + similar.json (top-K neighbours)
│   ├── projects_metadata_ubt/      # University of Bayreuth (21 collections)
│   ├── projects_metadata_unilag/   # University of Lagos (8 collections)
│   ├── projects_metadata_ujkz/     # Université Joseph Ki-Zerbo (7 collections)
│   ├── projects_metadata_ufba/     # Federal University of Bahia (1 collection)
│   └── external_metadata/          # External collections (BayGlo2025, ILAM)
└── logos/                          # Partner institution logos used across the UI
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

Surfaced across the dashboard as virtual projects (`Ext_BayGlo2025`, `Ext_ILAM`) under an **External** pseudo research section, with a dedicated chip in the global filter panel and a dedicated group in the Project Explorer and Compare Projects selectors. Virtual-project definitions live in [`src/lib/utils/external.ts`](src/lib/utils/external.ts).

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
- **`similar.json`** — per-item top-12 cosine-similar neighbours keyed by `dre_id` (lazy-loaded on first selection on `/semantic-map`)
- `cache.json` — full 768-dim Gemini vectors + SHA-256 hashes used for incremental re-embedding; gitignored

Pipelined by [`scripts/generate_embeddings.py`](scripts/generate_embeddings.py). See [scripts/README.md](scripts/README.md) for details.

### Manual data — `static/data/manual/`

Hand-curated data not sourced from MongoDB:

- `projectLinks.json` — supplementary project-to-entity links

## Scripts

Python pipelines live in [`scripts/`](scripts/) and cover MongoDB export, WissKI URL generation, thumbnail fetching, knowledge-graph generation, embedding generation, and data slimming. Setup:

```bash
python -m venv .venv
.venv/Scripts/pip install -r scripts/requirements.txt
```

See [scripts/README.md](scripts/README.md) for each script's responsibilities and inputs / outputs. Regenerate the knowledge graphs and embeddings after any metadata refresh:

```bash
.venv/Scripts/python scripts/generate_knowledge_graphs.py
.venv/Scripts/python scripts/generate_embeddings.py --scope missing
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
