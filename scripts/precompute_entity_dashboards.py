#!/usr/bin/env python3
"""
Precompute per-entity dashboard JSON for the WissKI dashboard.

Reads research items from MongoDB, runs entity-specific aggregators from the
`precompute/` package, and writes one JSON per entity instance under
`static/data/entity_dashboards/<type>/<id>.json` plus a top-level
`manifest.json` listing every generated file.

READ-ONLY: this script never modifies MongoDB.

Usage:
    python scripts/precompute_entity_dashboards.py --entity language
    python scripts/precompute_entity_dashboards.py --entity all
    python scripts/precompute_entity_dashboards.py --entity language --dry-run

The first reference implementation covers `language`; additional entity types
land as separate follow-ups under AM-Digital-Research-Environment/amira#10.

Requires:
    pip install pymongo  (already in scripts/requirements.txt)

You must be connected to the university VPN.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Iterable

from bson import json_util  # ships with pymongo

from precompute import aggregators as agg
from precompute import config
from precompute import db
from precompute import generators


# --------------------------------------------------------------------------
# Entity dispatch
# --------------------------------------------------------------------------


def generate_language_dashboards(
    items: list[dict], out_root: str
) -> list[dict]:
    """
    Emit one JSON per language code present in the archive.

    Returns manifest entries (`{id, name, count}`) for inclusion in the
    top-level manifest file.
    """
    out_dir = os.path.join(out_root, "languages")
    os.makedirs(out_dir, exist_ok=True)

    index = generators.language_index(items)
    entries: list[dict] = []

    for code, code_items in sorted(index.items()):
        if not code_items:
            continue
        payload = generators.generate_language_dashboard(code, items)
        out_path = os.path.join(out_dir, f"{code}.json")
        _write_json(out_path, payload)
        entries.append(
            {
                "id": code,
                "name": payload["meta"]["name"],
                "count": payload["meta"]["count"],
            }
        )
        print(f"  languages/{code}.json  ({payload['meta']['count']} items)")
    return entries


ENTITY_DISPATCH = {
    "language": generate_language_dashboards,
    # Phase 2 adds: subject, tag, person, institution, genre, resource-type,
    # group, location, research-section, project, research-item.
}


# --------------------------------------------------------------------------
# IO helpers
# --------------------------------------------------------------------------


def _write_json(path: str, payload: dict) -> None:
    """Serialize with MongoDB Extended JSON so `{$date: ...}` round-trips."""
    with open(path, "w", encoding="utf-8") as fh:
        # json_util handles ObjectId, datetime, Decimal128, etc. The frontend
        # loader calls `transformMongoJSON()` to re-hydrate these wrappers.
        fh.write(json_util.dumps(payload, ensure_ascii=False, indent=2))


def _write_manifest(out_root: str, manifest: dict[str, list[dict]]) -> None:
    path = os.path.join(out_root, "manifest.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)
    print(f"\nWrote manifest: {path}")


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--entity",
        choices=sorted(list(ENTITY_DISPATCH.keys()) + ["all"]),
        required=True,
        help="Entity type to precompute. Use 'all' to run every registered generator.",
    )
    parser.add_argument(
        "--uri",
        help="MongoDB connection URI. Falls back to $MONGO_URI.",
    )
    parser.add_argument(
        "--auth-db",
        help="Auth database name, appended as ?authSource=... if not in URI.",
    )
    parser.add_argument(
        "--out",
        default=config.OUTPUT_ROOT,
        help=f"Output root. Defaults to {config.OUTPUT_ROOT}.",
    )
    parser.add_argument(
        "--skip-external",
        action="store_true",
        help="Skip the external_metadata database.",
    )
    parser.add_argument(
        "--from-local",
        action="store_true",
        help=(
            "Skip MongoDB and read items from the committed static JSON dumps "
            "under static/data/projects_metadata_*. Useful offline and in CI."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Count items and print what would be generated without writing files.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.from_local:
        print("Loading items from local JSON dumps...", flush=True)
        items = db.load_all_items_from_local(include_external=not args.skip_external)
    else:
        print("Connecting to MongoDB...", flush=True)
        client = db.connect(uri=args.uri, auth_db=args.auth_db)
        print("Loading research items...", flush=True)
        items = db.load_all_items(client, include_external=not args.skip_external)
    print(f"Loaded {len(items)} items across {len(config.UNIVERSITY_DATABASES)} universities.")

    if args.dry_run:
        # Quick integrity probe — counts per language, etc.
        index = generators.language_index(items)
        print(f"\nLanguages present: {len(index)}")
        for code, code_items in sorted(index.items()):
            print(f"  {code}: {len(code_items)} items")
        return 0

    os.makedirs(args.out, exist_ok=True)
    manifest: dict[str, list[dict]] = {}

    entities: Iterable[str] = (
        ENTITY_DISPATCH.keys() if args.entity == "all" else [args.entity]
    )

    for entity in entities:
        dispatch = ENTITY_DISPATCH.get(entity)
        if dispatch is None:
            print(f"  [skip] No generator registered for '{entity}' yet.")
            continue
        dir_name = config.ENTITY_DIRS[entity]
        print(f"\nGenerating {entity} dashboards -> {dir_name}/")
        manifest[dir_name] = dispatch(items, args.out)

    _write_manifest(args.out, manifest)
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
