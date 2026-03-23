"""
Fix incorrect Wikidata matches and attempt to reconcile remaining failed cities.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.parse

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'static', 'data')
CITIES_FILE = os.path.join(DATA_DIR, 'dev', 'dev.geoloc_cities.json')
WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql'

# Load existing countries
with open(os.path.join(DATA_DIR, 'dev', 'dev.geoloc_countries.json'), 'r', encoding='utf-8') as f:
    countries_data = json.load(f)
country_name_to_uri = {c['name']: c['uri'] for c in countries_data}


# Manual corrections: known wrong matches and missing entries
MANUAL_FIXES = {
    # Wrong matches from automatic reconciliation
    'London': {'uri': 'http://www.wikidata.org/entity/Q84', 'lat': 51.507222222, 'lon': -0.1275, 'label': 'London'},
    'New York': {'uri': 'http://www.wikidata.org/entity/Q60', 'lat': 40.712777777, 'lon': -74.005833333, 'label': 'New York City'},
    'Paris': {'uri': 'http://www.wikidata.org/entity/Q90', 'lat': 48.856944444, 'lon': 2.351388888, 'label': 'Paris'},
    'Pasadena': {'uri': 'http://www.wikidata.org/entity/Q485176', 'lat': 34.156111111, 'lon': -118.131666666, 'label': 'Pasadena'},  # Pasadena, CA
}

# Manual entries for things that are hard to find via SPARQL
MANUAL_ADDITIONS = [
    {
        'name': 'Anabeb Conservancy', 'country': 'Namibia',
        'uri': 'http://www.wikidata.org/entity/Q4750164',
        'lat': -20.05, 'lon': 13.833333333,
        'label': 'Anabeb Conservancy'
    },
    {
        'name': 'Maasai Mara National Reserve', 'country': 'Kenya',
        'uri': 'http://www.wikidata.org/entity/Q272838',
        'lat': -1.5, 'lon': 35.1,
        'label': 'Maasai Mara National Reserve'
    },
    {
        'name': 'Dakawa', 'country': 'Tanzania',
        'uri': 'http://www.wikidata.org/entity/Q5209368',
        'lat': -6.433, 'lon': 37.567,
        'label': 'Dakawa'
    },
    {
        'name': 'Morogoro City', 'country': 'Tanzania',
        'uri': 'http://www.wikidata.org/entity/Q172579',
        'lat': -6.821111111, 'lon': 37.661111111,
        'label': 'Morogoro'
    },
    {
        'name': 'Sesfontein Conservancy', 'country': 'Namibia',
        'uri': 'http://www.wikidata.org/entity/Q7456176',
        'lat': -19.133, 'lon': 13.617,
        'label': 'Sesfontein Conservancy'
    },
    {
        'name': 'Lubombo Transfrontier Conservation and Resource Area', 'country': 'Eswatini',
        'uri': 'http://www.wikidata.org/entity/Q6696427',
        'lat': -26.6, 'lon': 32.05,
        'label': 'Lubombo Transfrontier Conservation Area'
    },
]


def sparql_query(query):
    url = WIKIDATA_SPARQL + '?' + urllib.parse.urlencode({'query': query, 'format': 'json'})
    req = urllib.request.Request(url, headers={
        'User-Agent': 'WissKI-Dashboard-CityReconciler/1.0',
        'Accept': 'application/sparql-results+json'
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"  SPARQL error: {e}")
        return {'results': {'bindings': []}}


def try_alternative_search(name, country):
    """Try alternative SPARQL strategies for hard-to-find places."""
    country_uri = country_name_to_uri.get(country, '')

    # Try searching as a "soum" (Mongolian district)
    if 'Soum' in name:
        base_name = name.replace(' Soum', '')
        escaped = base_name.replace('"', '\\"')
        query = f"""
        SELECT ?item ?itemLabel ?coord WHERE {{
          ?item rdfs:label ?label .
          FILTER(LANG(?label) = "en")
          FILTER(CONTAINS(LCASE(?label), LCASE("{escaped}")))
          {{ ?item wdt:P17 <{country_uri}> . }}
          OPTIONAL {{ ?item wdt:P625 ?coord . }}
          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
        }}
        LIMIT 5
        """
        results = sparql_query(query)
        bindings = results.get('results', {}).get('bindings', [])
        if bindings:
            b = bindings[0]
            uri = b.get('item', {}).get('value', '')
            label = b.get('itemLabel', {}).get('value', name)
            coord_str = b.get('coord', {}).get('value', '')
            lat, lon = parse_coords(coord_str)
            return uri, lat, lon, label

    # Try with parenthetical removed
    if '(' in name:
        base_name = name.split('(')[0].strip()
        escaped = base_name.replace('"', '\\"')
        query = f"""
        SELECT ?item ?itemLabel ?coord WHERE {{
          ?item rdfs:label "{escaped}"@en .
          ?item wdt:P17 <{country_uri}> .
          OPTIONAL {{ ?item wdt:P625 ?coord . }}
          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
        }}
        LIMIT 5
        """
        results = sparql_query(query)
        bindings = results.get('results', {}).get('bindings', [])
        if bindings:
            b = bindings[0]
            uri = b.get('item', {}).get('value', '')
            label = b.get('itemLabel', {}).get('value', name)
            coord_str = b.get('coord', {}).get('value', '')
            lat, lon = parse_coords(coord_str)
            return uri, lat, lon, label

    return None


def parse_coords(coord_str):
    if coord_str and coord_str.startswith('Point('):
        parts = coord_str.replace('Point(', '').replace(')', '').split()
        if len(parts) == 2:
            try:
                return float(parts[1]), float(parts[0])
            except ValueError:
                pass
    return None, None


def main():
    with open(CITIES_FILE, 'r', encoding='utf-8') as f:
        cities = json.load(f)

    # Apply manual fixes
    for city in cities:
        if city['name'] in MANUAL_FIXES:
            fix = MANUAL_FIXES[city['name']]
            old_uri = city['uri']
            city['uri'] = fix['uri']
            city['wikidata_label'] = fix['label']
            city['coordinates'] = {'latitude': fix['lat'], 'longitude': fix['lon']}
            print(f"FIXED: {city['name']} {old_uri} -> {fix['uri']}")

    # Add manual additions
    existing_names = {c['name'] for c in cities}
    for addition in MANUAL_ADDITIONS:
        if addition['name'] not in existing_names:
            cities.append({
                'name': addition['name'],
                'country': addition['country'],
                'country_uri': country_name_to_uri.get(addition['country'], ''),
                'uri': addition['uri'],
                'wikidata_label': addition['label'],
                'coordinates': {
                    'latitude': addition['lat'],
                    'longitude': addition['lon']
                }
            })
            print(f"ADDED: {addition['name']} -> {addition['uri']}")

    # Try alternative search for remaining failed
    still_missing = [
        ('Battsengel Soum', 'Mongolia'),
        ('Delgerhan Soum', 'Mongolia'),
        ('Delgerkhaan Soum', 'Mongolia'),
        ('Khishig-Öndör Soum', 'Mongolia'),
        ('Tsagaan-Ovoo Soum', 'Mongolia'),
        ('Ulziit Soum', 'Mongolia'),
        ('Ivindu', 'Gabon'),
        ('Loita Naimina Enkiyio Forest', 'Kenya'),
        ('Mpuaai', 'Kenya'),
        ('Olepolos', 'Kenya'),
        ('Ndengler (Dingler)', 'Senegal'),
    ]

    existing_names = {c['name'] for c in cities}
    for name, country in still_missing:
        if name in existing_names:
            continue
        print(f"Trying: {name} | {country} ... ", end='', flush=True)
        result = try_alternative_search(name, country)
        if result:
            uri, lat, lon, label = result
            cities.append({
                'name': name,
                'country': country,
                'country_uri': country_name_to_uri.get(country, ''),
                'uri': uri,
                'wikidata_label': label,
                'coordinates': {'latitude': lat, 'longitude': lon}
            })
            print(f"OK -> {uri}")
        else:
            print("still not found")
        time.sleep(1.5)

    # Sort by name
    cities.sort(key=lambda c: c['name'])

    with open(CITIES_FILE, 'w', encoding='utf-8') as f:
        json.dump(cities, f, indent=2, ensure_ascii=False)

    print(f"\nTotal cities: {len(cities)}")
    print(f"Saved to: {CITIES_FILE}")


if __name__ == '__main__':
    main()
