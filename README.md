# WissKI Dashboard

Interactive visualization dashboard for WissKI/MongoDB research data from the Africa Multiple Cluster of Excellence, built with SvelteKit 5, ECharts, and Tailwind CSS.

## Features

- **Overview Dashboard**: Summary cards, timeline, resource distribution, and word clouds
- **Collections Browser**: Explore collections across four partner universities (UBT, UNILAG, UJKZ, UFBA) with geographic maps, charts, and detailed visualizations
- **Compare View**: Side-by-side comparison of different collections with overlap analysis
- **Research Sections**: Browse the six thematic research areas (Affiliations, Arts & Aesthetics, Knowledges, Learning, Mobilities, Moralities) with descriptions, objectives, work programmes, PIs, and members
- **Projects Explorer**: Browse research projects with faceted filtering, click into project detail views with description, PIs, members, institutions, and linked collection items
- **Research Items**: Browse 2200+ collection items with text search, resource type filter, and collapsible subject (LCSH) and tag facets — full detail view with metadata, contributors, subjects, and identifiers
- **People**: Searchable directory of researchers, PIs, and members — view their projects, research sections, and collection items with pagination
- **Network Visualization**: Interactive force-directed graphs showing contributor-project relationships and institution collaborations

All entities are cross-linked: clicking a PI navigates to their People profile, clicking a project shows its detail view, clicking a collection item opens its full metadata, and clicking a research section badge navigates to the Research Sections page.

## Tech Stack

- **Framework**: SvelteKit 5 with Svelte 5 runes
- **Build**: Vite 8 with Rolldown
- **Charts**: ECharts 6 + echarts-wordcloud
- **Maps**: MapLibre GL
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/vite`) with HSL CSS variable theming and dark mode
- **UI Components**: Custom shadcn-svelte style components
- **Icons**: Lucide Svelte
- **Deployment**: GitHub Pages with static adapter

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
```

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/          # Reusable UI components (Card, Badge, Pagination, etc.)
│   │   ├── charts/      # ECharts wrappers (Bar, Pie, Timeline, Network, Map, etc.)
│   │   └── layout/      # Sidebar, Header, FilterPanel
│   ├── stores/          # Svelte stores for data, filters, and theme
│   ├── styles/          # Design tokens (CSS variables + TypeScript exports)
│   ├── types/           # TypeScript interfaces
│   └── utils/           # Data loading, transformation, URL helpers
├── routes/
│   ├── +page.svelte           # Overview dashboard
│   ├── collections/           # Collections browser
│   ├── compare/               # Comparison view
│   ├── research-sections/     # Research sections with descriptions, PIs, members
│   ├── projects/              # Projects explorer with facets and detail view
│   ├── research-items/        # Collection items browser with subject/tag facets
│   ├── people/                # People directory with profile detail
│   └── network/               # Network visualization
└── app.css                    # Global styles and Tailwind config
static/
└── data/
    ├── dev/                   # MongoDB export data (projects, persons, institutions, geolocation)
    ├── manual/                # Hand-curated data (research section descriptions, PIs, members)
    ├── projects_metadata_ubt/ # UBT collection metadata
    ├── projects_metadata_unilag/
    ├── projects_metadata_ujkz/
    └── projects_metadata_ufba/
```

## Data Sources

### MongoDB exports (`static/data/dev/`)

- `dev.projectsData.json` — Research projects metadata
- `dev.persons.json` — Person records
- `dev.institutions.json` — Institution records
- `dev.groups.json` — Research groups
- `dev.collections.json` — Development collection items
- `dev.geoloc_*.json` — Geolocation data (countries, regions, subregions with Wikidata coordinates)

### University collections (`static/data/projects_metadata_*/`)

Collection item metadata from four partner universities: University of Bayreuth (UBT), University of Lagos (UNILAG), Université Joseph Ki-Zerbo (UJKZ), and Federal University of Bahia (UFBA).

### Manual data (`static/data/manual/`)

Hand-curated data not sourced from MongoDB:

- `researchSections.json` — Research section descriptions, objectives, work programmes, principal investigators, and members

## Deployment

The project is configured for automatic deployment to GitHub Pages. Push to `main` branch to trigger deployment.

## License

MIT
