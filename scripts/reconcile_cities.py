"""
Reconcile collection item cities with Wikidata.
Queries Wikidata SPARQL endpoint for each city+country pair to find the best match.
Outputs dev.geoloc_cities.json in the same format as the existing geoloc files.
"""

import json
import glob
import os
import sys
import time
import urllib.request
import urllib.parse
import urllib.error

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'static', 'data')
OUTPUT_FILE = os.path.join(DATA_DIR, 'dev', 'dev.geoloc_cities.json')

WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql'

# Load existing countries to get country URI mapping
with open(os.path.join(DATA_DIR, 'dev', 'dev.geoloc_countries.json'), 'r', encoding='utf-8') as f:
    countries_data = json.load(f)

country_name_to_uri = {c['name']: c['uri'] for c in countries_data}


def get_cities_from_collection_items():
    """Extract all unique city|country pairs from collection item metadata."""
    cities = set()
    for folder in glob.glob(os.path.join(DATA_DIR, 'projects_metadata_*')):
        for filepath in glob.glob(os.path.join(folder, '*.json')):
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if not isinstance(data, list):
                data = [data]
            for item in data:
                if not isinstance(item, dict):
                    continue
                loc = item.get('location')
                if not isinstance(loc, dict):
                    continue
                for origin in (loc.get('origin') or []):
                    if isinstance(origin, dict):
                        l3 = origin.get('l3', '')
                        l1 = origin.get('l1', '')
                        if isinstance(l3, str) and l3 and isinstance(l1, str) and l1:
                            cities.add((l3, l1))
    return sorted(cities)


def sparql_query(query):
    """Execute a SPARQL query against Wikidata."""
    url = WIKIDATA_SPARQL + '?' + urllib.parse.urlencode({
        'query': query,
        'format': 'json'
    })
    req = urllib.request.Request(url, headers={
        'User-Agent': 'WissKI-Dashboard-CityReconciler/1.0 (research project)',
        'Accept': 'application/sparql-results+json'
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"    Rate limited, waiting 30s...")
            time.sleep(30)
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode('utf-8'))
        raise


def reconcile_city(city_name, country_name):
    """
    Query Wikidata for a city by name, optionally filtering by country.
    Returns (uri, lat, lon, wikidata_label) or None.
    """
    country_uri = country_name_to_uri.get(country_name)

    # Escape quotes in city name for SPARQL
    escaped_name = city_name.replace('\\', '\\\\').replace('"', '\\"')

    if country_uri:
        # Strategy 1: Search by label + country constraint
        query = f"""
        SELECT ?item ?itemLabel ?coord WHERE {{
          ?item rdfs:label "{escaped_name}"@en .
          ?item wdt:P17 <{country_uri}> .
          OPTIONAL {{ ?item wdt:P625 ?coord . }}
          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
        }}
        LIMIT 5
        """
        results = sparql_query(query)
        bindings = results.get('results', {}).get('bindings', [])

        if bindings:
            return parse_result(bindings[0], city_name)

        # Strategy 2: Try with broader search (label contains)
        query = f"""
        SELECT ?item ?itemLabel ?coord WHERE {{
          ?item rdfs:label ?label .
          FILTER(LANG(?label) = "en")
          FILTER(CONTAINS(LCASE(?label), LCASE("{escaped_name}")))
          ?item wdt:P17 <{country_uri}> .
          OPTIONAL {{ ?item wdt:P625 ?coord . }}
          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
        }}
        LIMIT 5
        """
        results = sparql_query(query)
        bindings = results.get('results', {}).get('bindings', [])

        if bindings:
            return parse_result(bindings[0], city_name)

    # Strategy 3: Search without country (fallback)
    query = f"""
    SELECT ?item ?itemLabel ?coord WHERE {{
      ?item rdfs:label "{escaped_name}"@en .
      ?item wdt:P31/wdt:P279* wd:Q486972 .
      OPTIONAL {{ ?item wdt:P625 ?coord . }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
    }}
    LIMIT 5
    """
    results = sparql_query(query)
    bindings = results.get('results', {}).get('bindings', [])

    if bindings:
        return parse_result(bindings[0], city_name)

    return None


def parse_result(binding, original_name):
    """Parse a SPARQL result binding into (uri, lat, lon, label)."""
    uri = binding.get('item', {}).get('value', '')
    label = binding.get('itemLabel', {}).get('value', original_name)

    coord_str = binding.get('coord', {}).get('value', '')
    lat, lon = None, None
    if coord_str and coord_str.startswith('Point('):
        # Format: Point(longitude latitude)
        parts = coord_str.replace('Point(', '').replace(')', '').split()
        if len(parts) == 2:
            try:
                lon = float(parts[0])
                lat = float(parts[1])
            except ValueError:
                pass

    return uri, lat, lon, label


def main():
    cities = get_cities_from_collection_items()
    print(f"Found {len(cities)} unique city|country pairs to reconcile")

    results = []
    failed = []

    for i, (city, country) in enumerate(cities):
        print(f"[{i+1}/{len(cities)}] {city} | {country} ... ", end='', flush=True)

        try:
            result = reconcile_city(city, country)
        except Exception as e:
            print(f"ERROR: {e}")
            failed.append((city, country, str(e)))
            time.sleep(2)
            continue

        if result:
            uri, lat, lon, label = result
            entry = {
                "name": city,
                "country": country,
                "country_uri": country_name_to_uri.get(country, ''),
                "uri": uri,
                "wikidata_label": label,
                "coordinates": {
                    "latitude": lat,
                    "longitude": lon
                }
            }
            results.append(entry)
            coords = f"({lat}, {lon})" if lat is not None else "(no coords)"
            print(f"OK -> {uri} {coords}")
        else:
            print("NOT FOUND")
            failed.append((city, country, 'not found'))

        # Be polite to Wikidata
        time.sleep(1.5)

    # Write output
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"Reconciled: {len(results)}/{len(cities)}")
    print(f"Failed: {len(failed)}")
    print(f"Output: {OUTPUT_FILE}")

    if failed:
        print(f"\nFailed entries:")
        for city, country, reason in failed:
            print(f"  {city} | {country}: {reason}")


if __name__ == '__main__':
    main()
