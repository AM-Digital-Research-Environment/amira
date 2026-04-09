"""
Slim and split heavy JSON payloads after fetch_from_mongodb.py runs.

Reads the raw MongoDB dumps in static/data/ and produces:

  static/data/dev/dev.geo.json
      A single combined geolocation file containing only countries / regions /
      cities that are actually referenced by collection items, with coordinates
      stored as compact [lat, lon] arrays rounded to 5 decimals (~1m precision).

  static/data/dev/dev.wisski_urls.<category>.json
      One small file per category from dev.wisski_urls.json, so the dashboard
      can lazy-load only the categories a given page actually needs.

This is called automatically at the end of fetch_from_mongodb.py, but can also
be run on its own:

    python scripts/slim_data.py
"""

from __future__ import annotations

import glob
import io
import json
import os
import sys
from typing import Any, Iterable

# Force UTF-8 stdout on Windows so progress messages render correctly.
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    except Exception:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "static", "data")
DEV_DIR = os.path.join(DATA_DIR, "dev")

# Coordinate precision: 5 decimals ≈ 1.1 m, more than enough for map markers.
COORD_DECIMALS = 5


def _round(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return round(float(value), COORD_DECIMALS)
    except (TypeError, ValueError):
        return None


def _load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: str, data: Any) -> int:
    """Write `data` as compact JSON. Returns the byte size of the file."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        # Compact separators — no whitespace. Saves a lot vs indented JSON.
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(path)


# ---------------------------------------------------------------------------
# Collect referenced location names from collection items
# ---------------------------------------------------------------------------


def _as_strings(value: Any) -> Iterable[str]:
    """Yield string values from `value`, which may be a string, list, or None."""
    if value is None:
        return
    if isinstance(value, str):
        if value:
            yield value
    elif isinstance(value, list):
        for v in value:
            if isinstance(v, str) and v:
                yield v


def collect_referenced_locations() -> tuple[set[str], set[str], set[str]]:
    """Walk all collection JSONs and return (countries, regions, cities) sets.

    Region and city sets contain composite "name|country" keys to match the
    lookup format used by the dashboard.
    """
    countries: set[str] = set()
    regions: set[str] = set()
    cities: set[str] = set()

    pattern = os.path.join(DATA_DIR, "projects_metadata_*", "*.json")
    for path in glob.glob(pattern):
        try:
            items = _load_json(path)
        except Exception as exc:
            print(f"  WARN: failed to read {path}: {exc}")
            continue
        if not isinstance(items, list):
            continue
        for item in items:
            loc = item.get("location") if isinstance(item, dict) else None
            if not isinstance(loc, dict):
                continue
            for origin in loc.get("origin") or []:
                if not isinstance(origin, dict):
                    continue
                # l1/l2/l3 can be either a string or a list of strings.
                l1_values = list(_as_strings(origin.get("l1")))
                l2_values = list(_as_strings(origin.get("l2")))
                l3_values = list(_as_strings(origin.get("l3")))
                for l1 in l1_values:
                    countries.add(l1)
                    for l2 in l2_values:
                        regions.add(f"{l2}|{l1}")
                    for l3 in l3_values:
                        cities.add(f"{l3}|{l1}")

    return countries, regions, cities


# ---------------------------------------------------------------------------
# Build the slim, filtered geo file
# ---------------------------------------------------------------------------


def build_geo_file() -> None:
    countries_path = os.path.join(DEV_DIR, "dev.geoloc_countries.json")
    regions_path = os.path.join(DEV_DIR, "dev.geoloc_regions.json")
    subregions_path = os.path.join(DEV_DIR, "dev.geoloc_subregions.json")
    cities_path = os.path.join(DEV_DIR, "dev.geoloc_cities.json")

    if not os.path.exists(countries_path):
        print(f"  WARN: {countries_path} not found, skipping geo slim")
        return

    raw_countries = _load_json(countries_path)
    raw_regions = _load_json(regions_path) if os.path.exists(regions_path) else []
    raw_subregions = _load_json(subregions_path) if os.path.exists(subregions_path) else []
    raw_cities = _load_json(cities_path) if os.path.exists(cities_path) else []

    print(
        f"  Raw rows — countries={len(raw_countries)}, regions={len(raw_regions)}, "
        f"subregions={len(raw_subregions)}, cities={len(raw_cities)}"
    )

    # Build country URI → name lookup so we can resolve regions/subregions which
    # only carry a country_uri.
    uri_to_country: dict[str, str] = {}
    for c in raw_countries:
        uri = c.get("uri")
        name = c.get("name")
        if uri and name:
            uri_to_country[uri] = name

    referenced_countries, referenced_regions, referenced_cities = collect_referenced_locations()
    print(
        f"  Referenced — countries={len(referenced_countries)}, "
        f"regions={len(referenced_regions)}, cities={len(referenced_cities)}"
    )

    # Countries: keyed by name
    countries_out: dict[str, list[float]] = {}
    for c in raw_countries:
        name = c.get("name")
        if not name or name not in referenced_countries:
            continue
        coords = c.get("coordinates") or {}
        lat = _round(coords.get("lat"))
        lon = _round(coords.get("long"))
        if lat is None or lon is None:
            continue
        countries_out[name] = [lat, lon]

    # Regions: keyed by "name|country"
    regions_out: dict[str, list[float]] = {}
    for r in raw_regions:
        name = r.get("name")
        country = uri_to_country.get(r.get("country_uri", ""), "")
        if not name or not country:
            continue
        key = f"{name}|{country}"
        if key not in referenced_regions:
            continue
        coords = r.get("coordinates") or {}
        lat = _round(coords.get("lat"))
        lon = _round(coords.get("long"))
        if lat is None or lon is None:
            continue
        regions_out[key] = [lat, lon]

    # Cities: keyed by "name|country". Subregions form the base; cities overlay
    # them (cities take precedence — same logic as the original loader).
    cities_out: dict[str, list[float]] = {}
    for s in raw_subregions:
        name = s.get("name")
        country = uri_to_country.get(s.get("country_uri", ""), "")
        if not name or not country:
            continue
        key = f"{name}|{country}"
        if key not in referenced_cities:
            continue
        coords = s.get("coordinates") or {}
        lat = _round(coords.get("latitude"))
        lon = _round(coords.get("longitude"))
        if lat is None or lon is None:
            continue
        cities_out[key] = [lat, lon]

    for c in raw_cities:
        name = c.get("name")
        # The cities collection stores the country name directly.
        country = c.get("country") or uri_to_country.get(c.get("country_uri", ""), "")
        if not name or not country:
            continue
        key = f"{name}|{country}"
        if key not in referenced_cities:
            continue
        coords = c.get("coordinates") or {}
        lat = _round(coords.get("lat"))
        lon = _round(coords.get("long"))
        if lat is None or lon is None:
            continue
        cities_out[key] = [lat, lon]

    out = {
        "countries": countries_out,
        "regions": regions_out,
        "cities": cities_out,
    }

    out_path = os.path.join(DEV_DIR, "dev.geo.json")
    size = _write_json(out_path, out)
    print(
        f"  Wrote {out_path}: {size:,} bytes "
        f"({len(countries_out)} countries, {len(regions_out)} regions, {len(cities_out)} cities)"
    )

    # Drop the raw MongoDB dumps now that the slim file has replaced them.
    for path in (countries_path, regions_path, subregions_path, cities_path):
        if os.path.exists(path):
            os.remove(path)
            print(f"  Removed {os.path.basename(path)}")


# ---------------------------------------------------------------------------
# Split dev.wisski_urls.json into per-category files
# ---------------------------------------------------------------------------


def split_wisski_urls() -> None:
    src = os.path.join(DEV_DIR, "dev.wisski_urls.json")
    if not os.path.exists(src):
        print(f"  WARN: {src} not found, skipping wisski_urls split")
        return

    data = _load_json(src)
    if not isinstance(data, dict):
        print(f"  WARN: {src} is not an object, skipping")
        return

    total_size = 0
    for category, mapping in data.items():
        if not isinstance(mapping, dict):
            continue
        out_path = os.path.join(DEV_DIR, f"dev.wisski_urls.{category}.json")
        size = _write_json(out_path, mapping)
        total_size += size
        print(f"  Wrote dev.wisski_urls.{category}.json: {size:,} bytes ({len(mapping)} entries)")

    print(f"  Total per-category bytes: {total_size:,}")

    # Drop the original combined file — every page now reads per-category files.
    os.remove(src)
    print(f"  Removed {os.path.basename(src)}")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


def main() -> None:
    print("Slimming geolocation data...")
    build_geo_file()
    print("\nSplitting wisski_urls per category...")
    split_wisski_urls()
    print("\nDone.")


if __name__ == "__main__":
    main()
