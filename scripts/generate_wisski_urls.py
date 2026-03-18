#!/usr/bin/env python3
"""
Generate dev.wisski_urls.json by querying the public GraphDB SPARQL endpoint.

Resolves WissKI navigate URLs for all entity types via owl:sameAs triples.
Output: static/data/dev/dev.wisski_urls.json

Usage:
    python scripts/generate_wisski_urls.py
"""

import json
import urllib.request
import urllib.parse
from pathlib import Path

SPARQL_ENDPOINT = "https://lod.wisski.uni-bayreuth.de/repositories/wisski_2024-08-13"
OUTPUT_FILE = Path(__file__).parent.parent / "static" / "data" / "dev" / "dev.wisski_urls.json"

PREFIXES = """
PREFIX am: <http://www.wisski.uni-bayreuth.de/ontologies/africamultiple/240307/>
PREFIX ecrm: <http://erlangen-crm.org/240307/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
"""

WISSKI_NAVIGATE_PREFIX = "https://www.wisski.uni-bayreuth.de/wisski/navigate/"

# Queries that return ?label (lookup key) and ?url (navigate URL)
BATCH_QUERIES = {
    "projects": f"""{PREFIXES}
SELECT ?label ?url WHERE {{
    ?id rdf:type am:project .
    ?id ecrm:P48_has_preferred_identifier ?labelEntity .
    ?labelEntity rdf:type ecrm:E42_Identifier .
    ?labelEntity ecrm:P3_has_note ?label .
    ?id owl:sameAs ?url .
    FILTER(STRSTARTS(STR(?url), "{WISSKI_NAVIGATE_PREFIX}"))
}}""",
    "persons": f"""{PREFIXES}
SELECT ?label ?url WHERE {{
    ?id rdf:type ecrm:E21_Person .
    ?id ecrm:P1_is_identified_by ?labelEntity .
    ?labelEntity rdf:type ecrm:E41_Appellation .
    ?labelEntity am:person_name ?label .
    ?id owl:sameAs ?url .
    FILTER(STRSTARTS(STR(?url), "{WISSKI_NAVIGATE_PREFIX}"))
}}""",
    "institutions": f"""{PREFIXES}
SELECT ?label ?url WHERE {{
    ?id rdf:type am:institution .
    ?id ecrm:P1_is_identified_by ?labelEntity .
    ?labelEntity rdf:type ecrm:E41_Appellation .
    ?labelEntity ecrm:P3_has_note ?label .
    ?id owl:sameAs ?url .
    FILTER(STRSTARTS(STR(?url), "{WISSKI_NAVIGATE_PREFIX}"))
}}""",
    "groups": f"""{PREFIXES}
SELECT ?label ?url WHERE {{
    ?id rdf:type ecrm:E74_Group .
    MINUS {{?id rdf:type am:project}} .
    MINUS {{?id rdf:type am:institution}} .
    ?id ecrm:P1_is_identified_by ?labelEntity .
    ?labelEntity rdf:type ecrm:E41_Appellation .
    ?labelEntity ecrm:P3_has_note ?label .
    ?id owl:sameAs ?url .
    FILTER(STRSTARTS(STR(?url), "{WISSKI_NAVIGATE_PREFIX}"))
}}""",
    "countries": f"""{PREFIXES}
SELECT ?label ?url WHERE {{
    ?id rdf:type am:country .
    ?id ecrm:P1_is_identified_by ?labelEntity .
    ?labelEntity rdf:type ecrm:E41_Appellation .
    ?labelEntity ecrm:P3_has_note ?label .
    ?id owl:sameAs ?url .
    FILTER(STRSTARTS(STR(?url), "{WISSKI_NAVIGATE_PREFIX}"))
}}""",
    "languages": f"""{PREFIXES}
SELECT ?label ?url WHERE {{
    ?id rdf:type ecrm:E56_Language .
    ?id ecrm:P1_is_identified_by ?labelEntity .
    ?labelEntity ecrm:P3_has_note ?label .
    ?id owl:sameAs ?url .
    FILTER(STRSTARTS(STR(?url), "{WISSKI_NAVIGATE_PREFIX}"))
}}""",
    "resourceTypes": f"""{PREFIXES}
SELECT ?label ?url WHERE {{
    ?id rdf:type am:information_carrier_type .
    ?id ecrm:P1_is_identified_by ?labelEntity .
    ?labelEntity rdf:type ecrm:E41_Appellation .
    ?labelEntity ecrm:P3_has_note ?label .
    ?id owl:sameAs ?url .
    FILTER(STRSTARTS(STR(?url), "{WISSKI_NAVIGATE_PREFIX}"))
}}""",
    "subjects": f"""{PREFIXES}
SELECT ?label ?url WHERE {{
    ?id rdf:type am:subject .
    ?id ecrm:P1_is_identified_by ?labelEntity .
    ?labelEntity rdf:type ecrm:E41_Appellation .
    ?labelEntity ecrm:P3_has_note ?label .
    ?id owl:sameAs ?url .
    FILTER(STRSTARTS(STR(?url), "{WISSKI_NAVIGATE_PREFIX}"))
}}""",
    "tags": f"""{PREFIXES}
SELECT ?label ?url WHERE {{
    ?id rdf:type am:key_word .
    ?id ecrm:P1_is_identified_by ?labelEntity .
    ?labelEntity rdf:type ecrm:E41_Appellation .
    ?labelEntity ecrm:P3_has_note ?label .
    ?id owl:sameAs ?url .
    FILTER(STRSTARTS(STR(?url), "{WISSKI_NAVIGATE_PREFIX}"))
}}""",
    "researchItems": f"""{PREFIXES}
SELECT ?label ?url WHERE {{
    ?id rdf:type am:information_carrier .
    ?id ecrm:P1_is_identified_by ?idEntity .
    ?idEntity rdf:type ecrm:E42_Identifier .
    ?idEntity ecrm:P3_has_note ?label .
    ?id owl:sameAs ?url .
    FILTER(STRSTARTS(STR(?url), "{WISSKI_NAVIGATE_PREFIX}"))
}}""",
    "genres": f"""{PREFIXES}
SELECT ?label ?url WHERE {{
    ?id rdf:type am:taxonomy_tag .
    ?id ecrm:P1_is_identified_by ?labelEntity .
    ?labelEntity ecrm:P3_has_note ?label .
    ?id owl:sameAs ?url .
    FILTER(STRSTARTS(STR(?url), "{WISSKI_NAVIGATE_PREFIX}"))
}}""",
}


def sparql_query(query: str) -> list[dict]:
    """Execute a SPARQL SELECT query and return the bindings."""
    url = f"{SPARQL_ENDPOINT}?query={urllib.parse.quote(query)}"
    req = urllib.request.Request(url, headers={"Accept": "application/sparql-results+json"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    return data["results"]["bindings"]


def main():
    result = {}

    for category, query in BATCH_QUERIES.items():
        print(f"Querying {category}...", end=" ", flush=True)
        try:
            bindings = sparql_query(query)
            lookup = {}
            for b in bindings:
                label = b["label"]["value"]
                url = b["url"]["value"]
                lookup[label] = url
            result[category] = lookup
            print(f"{len(lookup)} entries")
        except Exception as e:
            print(f"ERROR: {e}")
            result[category] = {}

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    total = sum(len(v) for v in result.values())
    print(f"\nWrote {total} total URLs to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
