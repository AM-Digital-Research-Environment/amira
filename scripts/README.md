# Data Enrichment Scripts

Python scripts for enriching WissKI Dashboard data with external sources.

## Scripts

### `reconcile_cities.py`

Reconciles city names from collection item metadata with Wikidata entities. Extracts all unique city|country pairs from `static/data/projects_metadata_*/` files, queries the Wikidata SPARQL endpoint to find matching entities, and outputs `static/data/dev/dev.geoloc_cities.json`.

**Features:**
- Extracts unique city|country pairs from collection item `location.origin.l3` fields
- Queries Wikidata SPARQL with multiple strategies (exact label match, contains match, fallback without country)
- Fetches GPS coordinates from Wikidata coordinate claims (P625)
- Rate-limited (1.5s between requests) to respect Wikidata query limits

**Usage:**
```bash
python scripts/reconcile_cities.py
```

### `fix_cities.py`

Post-processing script to fix incorrect Wikidata matches and add manually curated entries. Run after `reconcile_cities.py`.

**Features:**
- Corrects known wrong matches (e.g., Pasadena TX → Pasadena CA)
- Adds manual entries for places not found via SPARQL (conservancies, national parks, etc.)
- Attempts alternative SPARQL search strategies for Mongolian soums and parenthetical names

**Usage:**
```bash
python scripts/fix_cities.py
```

### `reconcile_locations.py` (DEPRECATED)

> **Note:** This script is no longer needed. Location data is now loaded directly from pre-reconciled geolocation files exported from MongoDB. See `reconcile_cities.py` for the current city reconciliation workflow.

## Adding New Scripts

When adding new enrichment scripts:
1. Follow the same pattern of reading from `static/data/`
2. Output enriched data to `static/data/dev/` or `static/data/enriched/`
3. Include proper rate limiting for external APIs
4. Use caching to avoid redundant requests
