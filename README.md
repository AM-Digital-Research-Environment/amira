# WissKI Dashboard

Interactive visualization dashboard for WissKI/MongoDB research data from the [Africa Multiple Cluster of Excellence](https://www.africamultiple.uni-bayreuth.de/), built with SvelteKit 5, ECharts 6, and Tailwind CSS 4.

## Features

### Browse

- **Research Sections**: Browse the six thematic research areas (Affiliations, Arts & Aesthetics, Knowledges, Learning, Mobilities, Moralities) with descriptions, objectives, work programmes, PIs, and members. An additional **External** pseudo-section groups collections that don't belong to the six thematic fields (e.g. BayGlo2025, ILAM). Section detail view includes a Gantt chart showing project timelines within that section.
- **Projects**: Browse research projects with faceted filtering by research section and institution. Detail views show description, PIs (linked), members (linked), institutions (linked), and paginated research items. Overview includes a Gantt timeline, beeswarm chart (projects by section and year, sized by item count), and bar charts for research sections and institutions.
- **Research Items**: Browse 2,200+ research items with full-text search, resource type filter, and collapsible facets for subjects (LCSH), tags, countries, projects, and languages. Table view with sortable columns. Detail view shows title, abstract, contributors (person/institution/group with roles), subjects, tags, origin locations with interactive map, dates, language, identifiers, project, and per-item knowledge graph with fullscreen mode.
- **People**: Searchable directory of researchers, PIs, and research item contributors with affiliations. Profile view shows research sections, projects (as PI or member), and paginated research items.
- **Institutions**: Partner institutions (from projects) and contributor organizations (institutions/groups appearing on research items). Shows associated projects, people, and item counts.
- **Locations**: Browse by country, region, or city with item counts. Detail view includes an interactive map (with fallback to country-level coordinates) and paginated items.
- **Languages**: Browse items by language. ISO 639-2/3 codes are displayed as full English names throughout the dashboard.
- **Subjects & Tags**: Toggle between LCSH controlled vocabulary subjects and free-form tags. Interactive word cloud (adjustable size, up to 200 terms) — click a word to view its items. Searchable list with counts and pagination.
- **Resource Types**: Browse items by resource type (text, sound recording, still image, moving image, cartographic, mixed material, etc.) with interactive pie and bar charts — click to filter. Shows percentage distribution.
- **Genres**: Browse items by MARC genre classification with word cloud visualization and item counts.

### Visualize

- **Overview Dashboard**: Summary stat cards (documents, projects, contributors, universities), university breakdown with logos, global filter panel (resource type, language, university), stacked timeline by type, resource type pie chart, subject bar chart, tag word cloud, research section distribution, and a Research Section × University heatmap matrix.
- **Collections**: Explore collections across four partner universities with collection/project selector. Includes geographic map (clickable marker popups), stacked timeline, bar/pie charts, word cloud, Sankey flow diagram (contributor → project → resource type), sunburst hierarchy (resource type → language → subject), chord diagram (subject co-occurrence), and Resource Type × Language heatmap matrix.
- **Compare**: Side-by-side comparison of two university/project selections with synchronized stacked timelines, subject distributions, resource type breakdowns, and language distributions.
- **Network**: Five interactive force-directed graph tabs, all weighted (edge thickness = strength of tie) and community-coloured:
  - **Contributors ↔ Projects**: weighted bipartite graph — edge width equals the number of items a person contributed to that project
  - **Co-authorship**: person ↔ person projection of the contributor graph, edges for pairs with ≥ 2 shared items
  - **People ↔ Institutions**: bipartite affiliations view
  - **Institution collaborations**: institutions joined when they share people on the same project
  - **Discursive communities**: the Louvain communities detected across the whole archive, with the top-PageRank anchor of each cluster. Built from the precomputed `_meta.json`.
  - Filters: university, max nodes, resource type

### Cross-linking & WissKI Integration

All entities are deeply cross-linked throughout the dashboard:

- PI and member names link to People profiles
- Project names link to project detail views
- Research item titles link to item detail with knowledge graph
- Research section badges link to the relevant section detail
- Institution badges link to Institutions page
- Language badges link to Languages page
- Location origins (city, region, country) link to Locations page
- Resource type badges link to Resource Types page
- Subject and tag badges link to Subjects page
- Contributors are routed to People (persons) or Institutions (institutions/groups) based on their qualifier

**WissKI Navigate**: Optional deep-links to WissKI entities are displayed throughout the dashboard via pre-computed URL mappings, connecting dashboard items back to their source records in the WissKI knowledge base.

## Tech Stack

- **Framework**: [SvelteKit](https://svelte.dev/docs/kit) 5 with [Svelte 5 runes](https://svelte.dev/docs/svelte/what-are-runes) (`$state`, `$derived`, `$effect`, `$props`)
- **Build**: [Vite](https://vite.dev/) 8 with Rolldown
- **Charts**: [ECharts](https://echarts.apache.org/) 6 (16 chart types) + [echarts-wordcloud](https://github.com/ecomfe/echarts-wordcloud)
- **Maps**: [MapLibre GL](https://maplibre.org/) 5 (LocationMap for multi-marker views, MiniMap for single locations)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) 4 (via `@tailwindcss/vite`) with HSL CSS variable theming and dark mode
- **UI Components**: Custom shadcn-svelte inspired components (Card, Badge, Pagination, StatCard, ChartCard, Tabs, Select, etc.)
- **Icons**: [Lucide Svelte](https://lucide.dev/)
- **Linting**: ESLint 10 with typescript-eslint + eslint-plugin-svelte
- **Formatting**: Prettier 3 with prettier-plugin-svelte
- **Deployment**: GitHub Pages via static adapter and GitHub Actions

## Chart Components

| Component              | Type             | Description                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Timeline`             | Line             | Simple count-by-year timeline                                                                                                                                                                                                                                                                                                  |
| `StackedTimeline`      | Stacked bar      | Items by year broken down by resource type                                                                                                                                                                                                                                                                                     |
| `BarChart`             | Bar              | Horizontal/vertical bar with pagination for long lists                                                                                                                                                                                                                                                                         |
| `PieChart`             | Pie/donut        | Categorical distribution with click selection                                                                                                                                                                                                                                                                                  |
| `WordCloud`            | Word cloud       | Animated tag/subject cloud with adjustable max words                                                                                                                                                                                                                                                                           |
| `HeatmapChart`         | Heatmap          | Matrix cross-tabulation with color intensity (ECharts 6)                                                                                                                                                                                                                                                                       |
| `BeeswarmChart`        | Scatter/jitter   | Beeswarm distribution using ECharts 6 axis jitter                                                                                                                                                                                                                                                                              |
| `GanttChart`           | Custom bar range | Project timelines with start/end bars, category coloring                                                                                                                                                                                                                                                                       |
| `SankeyChart`          | Sankey           | Multi-level flow diagram (e.g. contributor → project → type)                                                                                                                                                                                                                                                                   |
| `SunburstChart`        | Sunburst         | Hierarchical drill-down visualization                                                                                                                                                                                                                                                                                          |
| `ChordDiagram`         | Chord            | Co-occurrence relationships between categories                                                                                                                                                                                                                                                                                 |
| `NetworkGraph`         | Force graph      | Weighted force-directed network: edge width follows edge value, dashed for latent/structural ties, solid for direct metadata edges; optional community halos                                                                                                                                                                   |
| `LocationMap`          | Map              | MapLibre GL multi-marker map with clustered popups                                                                                                                                                                                                                                                                             |
| `MiniMap`              | Map              | Lightweight single-location map with marker                                                                                                                                                                                                                                                                                    |
| `EntityKnowledgeGraph` | Force graph      | Per-entity ego graph (items, persons, projects, institutions, subjects, tags, locations, genres) with IDF-weighted direct edges + latent edges via Jaccard / personalised PageRank, discursive communities, PageRank-sized nodes, facet panel (entity-type / community / weight threshold / direct-vs-latent), fullscreen mode |
| `EChart`               | Base wrapper     | Shared ECharts wrapper with theme, zoom, resize, and performance optimization                                                                                                                                                                                                                                                  |

All chart components use the shared `EChart` base wrapper which provides:

- Dynamic theme switching via ECharts 6 `setTheme()` API
- Automatic performance optimization for large datasets
- Zoom controls and resize handling
- Dark/light mode reactivity

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npm run check

# Lint
npm run lint

# Format
npm run format
```

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/              # Reusable UI components
│   │   │   ├── card.svelte, card-header.svelte, card-title.svelte, card-content.svelte
│   │   │   ├── badge.svelte, button.svelte, input.svelte, select.svelte
│   │   │   ├── pagination.svelte, tabs.svelte
│   │   │   ├── stat-card.svelte, chart-card.svelte
│   │   │   ├── collection-item-row.svelte, back-to-list.svelte, empty-state.svelte
│   │   │   ├── section-badge.svelte       # Research section badge with color dot
│   │   │   └── wisski-link.svelte
│   │   ├── charts/          # ECharts + MapLibre chart components (16 total)
│   │   │   ├── EChart.svelte          # Base wrapper (theme, zoom, perf)
│   │   │   ├── Timeline.svelte, StackedTimeline.svelte
│   │   │   ├── BarChart.svelte, PieChart.svelte, WordCloud.svelte
│   │   │   ├── HeatmapChart.svelte, BeeswarmChart.svelte, GanttChart.svelte
│   │   │   ├── SankeyChart.svelte, SunburstChart.svelte, ChordDiagram.svelte
│   │   │   ├── NetworkGraph.svelte, EntityKnowledgeGraph.svelte
│   │   │   ├── LocationMap.svelte, MiniMap.svelte
│   │   │   └── utils/                 # Shared option builders & tooltip formatters
│   │   ├── layout/          # Sidebar (grouped nav), Header, FilterPanel
│   │   └── research-items/  # ItemDetail, ItemFilters, ItemTable
│   ├── stores/
│   │   ├── data.ts          # Raw data + derived stores (projects, persons, collections, etc.)
│   │   └── filters.ts       # Global filter state management
│   ├── styles/
│   │   ├── tokens.css       # CSS custom properties (colors, spacing, typography)
│   │   ├── tokens.ts        # TypeScript design tokens (CHART_COLORS, THEME_COLORS, etc.)
│   │   ├── animations.css   # Slide-in, fade animations
│   │   ├── components.css   # Component-specific Tailwind utilities
│   │   ├── sidebar.css      # Sidebar navigation styles
│   │   └── maplibre.css     # MapLibre GL custom styling
│   ├── types/               # TypeScript interfaces
│   │   ├── domain.ts        # Project, Person, Institution, Group
│   │   ├── collection.ts    # CollectionItem with all metadata fields
│   │   ├── charts.ts        # Chart data types (Heatmap, Beeswarm, Gantt, Network, etc.)
│   │   ├── geo.ts           # Geolocation types (enriched locations, Wikidata)
│   │   └── mongo.ts         # MongoDB-specific type helpers
│   └── utils/
│       ├── transforms/      # Data transformation modules
│       │   ├── dates.ts         # Year extraction from various date formats
│       │   ├── grouping.ts      # Group by year, year+type, project year
│       │   ├── extractors.ts    # Extract subjects, types, languages, tags, locations, etc.
│       │   ├── network.ts       # Build contributor, affiliation, collaboration networks
│       │   ├── charts.ts        # Build heatmap, beeswarm, Gantt, Sankey, sunburst data
│       │   └── filters.ts      # Collection filtering logic
│       ├── loaders/         # Data loading modules
│       │   ├── mongoJSON.ts     # Parse MongoDB JSON exports
│       │   ├── collectionLoader.ts  # Load university collection metadata
│       │   └── geolocLoader.ts  # Load enriched geolocation data
│       ├── external.ts      # Virtual external projects (BayGlo2025, ILAM) + External pseudo-section
│       ├── helpers.ts       # Display helpers (formatDate, getItemTitle, getProjectTitle, getSectionColor)
│       ├── languages.ts     # ISO 639-2/3 language code to English name mapping
│       ├── urls.ts          # Cross-linking URL builders for all entity types
│       ├── urlSelection.ts  # URL query parameter sync for selection state
│       ├── search.ts        # Generic text search filter factory
│       ├── pagination.ts    # Generic pagination utility
│       ├── wisskiUrl.ts     # WissKI navigate URL lookup
│       └── cn.ts            # Classname merging (clsx + tailwind-merge)
├── routes/
│   ├── +page.svelte              # Overview dashboard
│   ├── +layout.svelte            # Global layout (Header, Sidebar, data init)
│   ├── research-sections/        # Research sections with Gantt timelines
│   ├── projects/                 # Projects with facets, Gantt, beeswarm
│   ├── research-items/           # Research items browser with facets, table, detail
│   ├── people/                   # People directory with profiles
│   ├── institutions/             # Institutions (partner + contributor)
│   ├── locations/                # Country/region/city browser with maps
│   ├── languages/                # Language browser
│   ├── subjects/                 # Subjects & Tags with word cloud
│   ├── resource-types/           # Resource type browser with pie/bar
│   ├── genres/                   # Genre browser with word cloud
│   ├── collections/              # Collection explorer with all chart types
│   ├── compare/                  # Side-by-side collection comparison
│   └── network/                  # Network visualization (3 tabs)
└── app.css                       # Global styles and Tailwind v4 config

static/
└── data/
    ├── dev/                      # MongoDB exports
    │   ├── dev.projectsData.json     # Research projects (PIs, members, dates, sections, institutions)
    │   ├── dev.persons.json          # Person records with affiliations
    │   ├── dev.institutions.json     # Institution records
    │   ├── dev.groups.json           # Research group records
    │   ├── dev.collections.json      # Development collection items
    │   ├── dev.wisski_urls.json      # Pre-computed WissKI navigate URL mappings
    │   ├── dev.geoloc_countries.json # Countries with Wikidata coordinates
    │   ├── dev.geoloc_regions.json   # Regions with coordinates
    │   ├── dev.geoloc_subregions.json # Subregions with coordinates
    │   └── dev.geoloc_cities.json    # Curated cities reconciled with Wikidata (96 entries)
    ├── manual/
    │   └── researchSections.json     # Section descriptions, objectives, PIs, members
    ├── knowledge_graphs/             # 2,228 per-item knowledge graph JSON files
    ├── projects_metadata_ubt/        # University of Bayreuth (20 collections)
    ├── projects_metadata_unilag/     # University of Lagos (8 collections)
    ├── projects_metadata_ujkz/       # Université Joseph Ki-Zerbo (4 collections)
    ├── projects_metadata_ufba/       # Federal University of Bahia (1 collection)
    └── external_metadata/            # External collections (BayGlo2025, ILAM)
```

## Data Sources

### MongoDB exports (`static/data/dev/`)

Core research data exported from the WissKI MongoDB database:

- **Projects**: Research projects with PIs, members, dates, research sections, institutions, and RDSpace references
- **Persons**: Person records with institutional affiliations
- **Institutions**: Institution and organization records
- **Groups**: Research group records
- **Geolocation**: Countries (217), regions (3,800+), subregions (37,000+), and curated cities (96) with Wikidata-reconciled coordinates
- **WissKI URLs**: Pre-computed navigate URL mappings for deep-linking back to WissKI entities

### University collections (`static/data/projects_metadata_*/`)

2,200+ research item metadata from four partner universities: University of Bayreuth (UBT), University of Lagos (UNILAG), Université Joseph Ki-Zerbo (UJKZ), and Federal University of Bahia (UFBA). Each item includes title, contributors (with person/institution/group qualifier and roles), subjects (LCSH controlled vocabulary), tags, language (ISO 639-2/3), location (country/region/city), dates (created, issued, captured), identifiers, physical description, and access conditions.

### External collections (`static/data/external_metadata/`)

Research items contributed from sources outside the cluster's partner universities. Items carry `university: "external"` so they can be included in global totals but filtered out of per-university views:

- **`BayGlo2025`** — Bayreuth Global / Bayreuth Postkolonial; affiliated with the University of Bayreuth.
- **`ILAM`** — International Library of African Music (Rhodes University); standalone external source.

External collections are surfaced across the dashboard as virtual projects (IDs `Ext_BayGlo2025`, `Ext_ILAM`) under an **External** pseudo research section, with a dedicated chip in the global filter panel and a dedicated group in the Project Explorer and Compare Projects selectors. The virtual project definitions (institution mapping, descriptions) live in `src/lib/utils/external.ts`.

### Knowledge graphs (`static/data/knowledge_graphs/`)

Structural ego graphs pre-computed by [`scripts/generate_knowledge_graphs.py`](scripts/generate_knowledge_graphs.py). One JSON file per entity, organised by type:

```
static/data/knowledge_graphs/
├── _meta.json            # Global community labels + top-PageRank nodes
├── items/                # Research-item ego graphs
├── persons/              # Person ego graphs
├── projects/             # Project ego graphs
├── institutions/
├── subjects/
├── tags/
├── locations/
└── genres/
```

Each graph combines **direct** metadata edges (IDF-weighted so distinctive relationships look heavier than ubiquitous ones), **latent** structural edges (Jaccard on shared neighbourhoods + personalised PageRank for multi-hop relevance), and global analysis results (Louvain community membership, PageRank-based centrality) so the UI can reveal discursive communities and key discursive nodes that local co-occurrence alone would miss. Regenerate after any metadata change:

```bash
.venv/Scripts/python scripts/generate_knowledge_graphs.py
```

See [scripts/README.md](scripts/README.md) for the algorithm details.

### Manual data (`static/data/manual/`)

Hand-curated data not sourced from MongoDB:

- `researchSections.json` — Research section descriptions, objectives, work programmes, principal investigators, and members for all six thematic sections

## Deployment

The project deploys automatically to GitHub Pages:

- **Trigger**: Push to `main` branch (or manual dispatch)
- **Workflow**: `.github/workflows/deploy.yml` — builds with `npm run build`, sets `BASE_PATH` for subpath deployment, uploads to GitHub Pages
- **Adapter**: `@sveltejs/adapter-static` pre-renders all routes to the `build/` directory

## License

MIT
