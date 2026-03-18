# WissKI Dashboard

Interactive visualization dashboard for WissKI/MongoDB research data from the Africa Multiple Cluster of Excellence, built with SvelteKit 5, ECharts, and Tailwind CSS.

## Features

### Browse

- **Research Sections**: Browse the six thematic research areas (Affiliations, Arts & Aesthetics, Knowledges, Learning, Mobilities, Moralities) with descriptions, objectives, work programmes, PIs, and members. Section cards have anchor links for direct navigation.
- **Projects**: Browse 92 research projects with faceted filtering by research section and institution. Click into project detail views with description, PIs (linked), members (linked), institutions (linked), and paginated collection items.
- **Research Items**: Browse 2200+ collection items with text search, resource type filter, and collapsible subject (LCSH) and tag facets. Detail view shows title, abstract, contributors (person/institution/group), subjects, tags, origin locations with map, dates, language, identifiers, and project.
- **People**: Searchable directory of researchers, PIs, and collection item contributors. Profile view shows research sections, projects (as PI/member), and paginated collection items.
- **Institutions**: Partner institutions (with projects, people, collection items) separated from contributor organizations (institutions/groups appearing on collection items).
- **Locations**: Browse by country, region, or city with item counts. Detail view includes an interactive map (with fallback to country coordinates) and paginated items.
- **Languages**: Browse items by language. ISO 639-2 codes are displayed as full English names throughout the dashboard.
- **Subjects & Tags**: Combined page with toggle between LCSH controlled subjects and free-form tags. Interactive word cloud (top 100 terms) — click a word to view its items. Searchable list with counts.

### Visualize

- **Overview**: Summary stat cards, timeline, resource distribution, word clouds, and filterable panels (by resource type, language, university).
- **Collections**: Explore collections across four partner universities with geographic map (clickable item popups), stacked timeline, bar/pie charts, word clouds, Sankey diagrams, sunburst charts, and chord diagrams.
- **Compare**: Side-by-side comparison of different collections with overlap analysis.
- **Network**: Interactive force-directed graphs showing contributor-project relationships and institution collaborations.

### Cross-linking

All entities are deeply cross-linked throughout the dashboard:
- PI and member names link to People profiles
- Project names link to project detail views
- Collection item titles link to Research Items detail
- Research section badges link with anchor scrolling to the relevant section card
- Institution badges link to Institutions page
- Language badges link to Languages page
- Location origins (city, region, country) link to Locations page
- Contributors are routed to People (persons) or Institutions (institutions/groups) based on their type

## Tech Stack

- **Framework**: SvelteKit 5 with Svelte 5 runes
- **Build**: Vite 8 with Rolldown
- **Charts**: ECharts 6 + echarts-wordcloud
- **Maps**: MapLibre GL (LocationMap for multi-marker views, MiniMap for single locations)
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/vite`) with HSL CSS variable theming and dark mode
- **UI Components**: Custom shadcn-svelte style components (Card, Badge, Pagination, StatCard, ChartCard, etc.)
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
│   │   ├── ui/          # Reusable UI (Card, Badge, Pagination, StatCard, etc.)
│   │   ├── charts/      # ECharts wrappers (Bar, Pie, Timeline, Network, WordCloud, MiniMap, etc.)
│   │   └── layout/      # Sidebar (grouped nav), Header, FilterPanel
│   ├── stores/          # Svelte stores (data, filters, theme)
│   ├── styles/          # Design tokens (CSS variables + TypeScript exports)
│   ├── types/           # TypeScript interfaces
│   └── utils/           # Data loading, transformation, URL helpers, language mapping
├── routes/
│   ├── +page.svelte           # Overview dashboard
│   ├── research-sections/     # Research sections with descriptions, PIs, members
│   ├── projects/              # Projects explorer with facets and detail view
│   ├── research-items/        # Collection items browser with subject/tag facets and map
│   ├── people/                # People directory with profile detail
│   ├── institutions/          # Partner institutions and contributor organizations
│   ├── locations/             # Country/region/city browser with maps
│   ├── languages/             # Language browser
│   ├── subjects/              # Subjects & Tags with word cloud
│   ├── collections/           # Collections browser with charts and maps
│   ├── compare/               # Collection comparison view
│   └── network/               # Network visualization
└── app.css                    # Global styles and Tailwind v4 config
static/
└── data/
    ├── dev/                   # MongoDB export data (projects, persons, institutions, geolocation)
    ├── manual/                # Hand-curated data (research section descriptions, PIs, members)
    ├── projects_metadata_ubt/ # University of Bayreuth collection metadata
    ├── projects_metadata_unilag/ # University of Lagos collection metadata
    ├── projects_metadata_ujkz/   # Université Joseph Ki-Zerbo collection metadata
    └── projects_metadata_ufba/   # Federal University of Bahia collection metadata
```

## Data Sources

### MongoDB exports (`static/data/dev/`)

- `dev.projectsData.json` — 92 research projects with PIs, members, dates, research sections, institutions
- `dev.persons.json` — 1200+ person records with affiliations
- `dev.institutions.json` — 450 institution records
- `dev.groups.json` — Research groups
- `dev.collections.json` — Development collection items
- `dev.geoloc_countries.json` — 217 countries with Wikidata coordinates
- `dev.geoloc_regions.json` — 3800+ regions with coordinates
- `dev.geoloc_subregions.json` — 37000+ cities/subregions with coordinates

### University collections (`static/data/projects_metadata_*/`)

2200+ collection item metadata from four partner universities: University of Bayreuth (UBT), University of Lagos (UNILAG), Université Joseph Ki-Zerbo (UJKZ), and Federal University of Bahia (UFBA). Each item includes title, contributors (with person/institution/group qualifier), subjects (LCSH), tags, language, location, dates, identifiers, and physical description.

### Manual data (`static/data/manual/`)

Hand-curated data not sourced from MongoDB:

- `researchSections.json` — Research section descriptions, objectives, work programmes, principal investigators, and members for all six sections

## Deployment

The project is configured for automatic deployment to GitHub Pages. Push to `main` branch to trigger deployment.

## License

MIT
