# Data Enrichment Scripts

Python scripts for enriching WissKI Dashboard data with external sources and for
pre-computing heavy analyses (knowledge graphs, community detection) that the
frontend then loads as static JSON.

## Setup

```bash
python -m venv .venv
.venv/Scripts/pip install -r scripts/requirements.txt
```

## Scripts

### `generate_knowledge_graphs.py`

Pre-computes a structural knowledge graph per entity (research items, persons,
projects, institutions, subjects, tags, locations, genres). This script backs
the `EntityKnowledgeGraph` Svelte component and the
`/network?tab=communities` view.

**What it does**

1. Loads every item from `static/data/projects_metadata_*/` and
   `external_metadata/`.
2. Builds one global weighted graph over the archive:
   - nodes: items + contributors + subjects + tags + locations + projects +
     genres + institutions
   - edges weighted by IDF so that distinctive shared entities count more than
     ubiquitous ones
   - plus derived edges (person ↔ person co-authorship, subject ↔ subject
     co-occurrence, institution ↔ institution collaboration) via bipartite
     projection, pruned to those with at least two shared items
3. Runs global structural analyses:
   - **Louvain community detection** -- each node gets a `cluster` label
     representing its discursive community
   - **PageRank** -- each node gets an `importance` score surfacing the key
     discursive nodes
4. For each entity, extracts an ego graph that combines:
   - direct metadata neighbours (IDF-weighted)
   - Jaccard-similar items (items sharing a _neighbourhood_, not a tag)
   - personalised-PageRank latent neighbours (multi-hop relevance)
   - cross-community bridges for dialectical contrast

**Output**

- `static/data/knowledge_graphs/<type>/<slug>.json` (one per entity, where
  `<type>` is `items`, `persons`, `subjects`, `tags`, `locations`, `projects`,
  `genres`, or `institutions`)
- `static/data/knowledge_graphs/_meta.json` with the global community labels
  and the top-PageRank nodes (consumed by the `/network` page)

**Usage**

```bash
.venv/Scripts/python scripts/generate_knowledge_graphs.py
```

Expect a few minutes on a cold run (Louvain and per-entity personalised
PageRank are the dominant cost). Re-run whenever the archive's metadata
changes.

### `reconcile_cities.py`

Reconciles city names from collection item metadata with Wikidata entities.
Extracts all unique city|country pairs from `static/data/projects_metadata_*/`
files, queries the Wikidata SPARQL endpoint to find matching entities, and
outputs `static/data/dev/dev.geoloc_cities.json`.

**Features:**

- Extracts unique city|country pairs from collection item `location.origin.l3`
  fields
- Queries Wikidata SPARQL with multiple strategies (exact label match, contains
  match, fallback without country)
- Fetches GPS coordinates from Wikidata coordinate claims (P625)
- Rate-limited (1.5s between requests) to respect Wikidata query limits

**Usage:**

```bash
python scripts/reconcile_cities.py
```

### `fix_cities.py`

Post-processing script to fix incorrect Wikidata matches and add manually
curated entries. Run after `reconcile_cities.py`.

**Features:**

- Corrects known wrong matches (e.g., Pasadena TX → Pasadena CA)
- Adds manual entries for places not found via SPARQL (conservancies, national
  parks, etc.)
- Attempts alternative SPARQL search strategies for Mongolian soums and
  parenthetical names

**Usage:**

```bash
python scripts/fix_cities.py
```

### `reconcile_locations.py` (DEPRECATED)

> **Note:** This script is no longer needed. Location data is now loaded
> directly from pre-reconciled geolocation files exported from MongoDB. See
> `reconcile_cities.py` for the current city reconciliation workflow.

## Adding New Scripts

When adding new enrichment scripts:

1. Follow the same pattern of reading from `static/data/`
2. Output enriched data to `static/data/dev/` or `static/data/enriched/`
3. Include proper rate limiting for external APIs
4. Use caching to avoid redundant requests
