#!/usr/bin/env python3
"""
Precompute per-entity dashboard JSON for the WissKI dashboard.

Reads research items from MongoDB (or the committed local JSON dumps when
`--from-local` is passed), runs entity-specific aggregators from the
`precompute/` package, and writes one JSON per entity instance under
`static/data/entity_dashboards/<type>/<slug>.json` plus a top-level
`manifest.json` listing every generated file.

Filename convention: every non-language entity is slugified via
`precompute.aggregators.slugify()` so the disk path matches what the
frontend loader computes from the display name (see
`src/lib/utils/slugify.ts` and `entityDashboardLoader.ts`).

READ-ONLY: this script never modifies MongoDB.

Usage:
    python scripts/precompute_entity_dashboards.py --entity all --from-local
    python scripts/precompute_entity_dashboards.py --entity subject
    python scripts/precompute_entity_dashboards.py --entity language --dry-run

Requires:
    pip install pymongo  (already in scripts/requirements.txt)

You must be connected to the university VPN when running without --from-local.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Callable, Iterable

from bson import json_util  # ships with pymongo

from precompute import aggregators as agg
from precompute import config
from precompute import db
from precompute import generators


# --------------------------------------------------------------------------
# Shared helper for index-driven entity generators
# --------------------------------------------------------------------------


def _emit_from_index(
    entity: str,
    items: list[dict],
    out_root: str,
    *,
    index_fn: Callable[[list[dict]], dict[str, list[dict]]],
    generate_fn: Callable[[str, list[dict]], dict],
    slug_fn: Callable[[str], str] | None = None,
    min_count: int = 1,
) -> list[dict]:
    """
    Generic entity dispatcher.

    `index_fn` groups items by the entity's display name, `generate_fn` emits
    the per-entity JSON payload, and `slug_fn` (defaulting to `agg.slugify`)
    derives the on-disk filename from the display name. Entities with fewer
    than `min_count` items are skipped silently.
    """
    dir_name = config.ENTITY_DIRS[entity]
    out_dir = os.path.join(out_root, dir_name)
    os.makedirs(out_dir, exist_ok=True)

    index = index_fn(items)
    slug = slug_fn or agg.slugify
    entries: list[dict] = []

    for name, bucket in sorted(index.items()):
        if len(bucket) < min_count:
            continue
        file_slug = slug(name)
        if not file_slug:
            continue
        payload = generate_fn(name, items)
        out_path = os.path.join(out_dir, f"{file_slug}.json")
        _write_json(out_path, payload)
        entries.append(
            {
                "id": file_slug,
                "name": payload["meta"]["name"],
                "count": payload["meta"]["count"],
            }
        )
        print(f"  {dir_name}/{file_slug}.json  ({payload['meta']['count']} items)")
    return entries


# --------------------------------------------------------------------------
# Per-entity dispatchers
# --------------------------------------------------------------------------


def generate_language_dashboards(items: list[dict], out_root: str) -> list[dict]:
    out_dir = os.path.join(out_root, config.ENTITY_DIRS["language"])
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


def generate_subject_dashboards(items: list[dict], out_root: str) -> list[dict]:
    return _emit_from_index(
        "subject",
        items,
        out_root,
        index_fn=generators.subject_index,
        generate_fn=generators.generate_subject_dashboard,
    )


def generate_tag_dashboards(items: list[dict], out_root: str) -> list[dict]:
    return _emit_from_index(
        "tag",
        items,
        out_root,
        index_fn=generators.tag_index,
        generate_fn=generators.generate_tag_dashboard,
    )


def generate_genre_dashboards(items: list[dict], out_root: str) -> list[dict]:
    return _emit_from_index(
        "genre",
        items,
        out_root,
        index_fn=generators.genre_index,
        generate_fn=generators.generate_genre_dashboard,
    )


def generate_resource_type_dashboards(items: list[dict], out_root: str) -> list[dict]:
    return _emit_from_index(
        "resource-type",
        items,
        out_root,
        index_fn=generators.resource_type_index,
        generate_fn=generators.generate_resource_type_dashboard,
    )


def generate_group_dashboards(items: list[dict], out_root: str) -> list[dict]:
    return _emit_from_index(
        "group",
        items,
        out_root,
        index_fn=generators.group_index,
        generate_fn=generators.generate_group_dashboard,
    )


def generate_person_dashboards(items: list[dict], out_root: str) -> list[dict]:
    # The frontend /people page lists 806 unique names; many only appear once
    # as a project member or a bare record with no items attached. Ship
    # dashboards only for people who actually contributed to a research item
    # — everything else is an empty shell.
    return _emit_from_index(
        "person",
        items,
        out_root,
        index_fn=generators.person_index,
        generate_fn=generators.generate_person_dashboard,
        min_count=1,
    )


def generate_institution_dashboards(items: list[dict], out_root: str) -> list[dict]:
    return _emit_from_index(
        "institution",
        items,
        out_root,
        index_fn=generators.institution_index,
        generate_fn=generators.generate_institution_dashboard,
    )


def generate_location_dashboards(items: list[dict], out_root: str) -> list[dict]:
    return _emit_from_index(
        "location",
        items,
        out_root,
        index_fn=generators.location_index,
        generate_fn=generators.generate_location_dashboard,
    )


def generate_project_dashboards(items: list[dict], out_root: str) -> list[dict]:
    """One JSON per project id. Filenames are slugified so the runtime
    loader — which calls `slugify(id)` for every non-language entity —
    lands on the correct file regardless of casing/underscores."""
    dir_name = config.ENTITY_DIRS["project"]
    out_dir = os.path.join(out_root, dir_name)
    os.makedirs(out_dir, exist_ok=True)

    index = generators.project_index(items)
    names = generators.project_name_lookup(items)
    geo = db.load_geo()
    entries: list[dict] = []

    for pid, bucket in sorted(index.items()):
        if not bucket:
            continue
        slug = agg.slugify(pid)
        if not slug:
            continue
        payload = generators.generate_project_dashboard(pid, items, names.get(pid), geo=geo)
        out_path = os.path.join(out_dir, f"{slug}.json")
        _write_json(out_path, payload)
        entries.append(
            {
                "id": slug,
                "name": payload["meta"]["name"],
                "count": payload["meta"]["count"],
            }
        )
        print(f"  {dir_name}/{slug}.json  ({payload['meta']['count']} items)")
    return entries


def generate_research_section_dashboards(items: list[dict], out_root: str) -> list[dict]:
    """Research sections aren't in the items stream directly — they're a project
    attribute — so we load `dev.projectsData.json` and resolve items ∈ section
    via `project.researchSection`. Keep this dispatcher specialised rather
    than threading projects through the generic helper."""
    projects = db.load_projects_from_local()
    geo = db.load_geo()
    dir_name = config.ENTITY_DIRS["research-section"]
    out_dir = os.path.join(out_root, dir_name)
    os.makedirs(out_dir, exist_ok=True)

    index = generators.research_section_index(items, projects)
    entries: list[dict] = []

    for name, bucket in sorted(index.items()):
        if not bucket:
            continue
        slug = agg.slugify(name)
        if not slug:
            continue
        payload = generators.generate_research_section_dashboard(name, items, projects, geo=geo)
        out_path = os.path.join(out_dir, f"{slug}.json")
        _write_json(out_path, payload)
        entries.append(
            {
                "id": slug,
                "name": payload["meta"]["name"],
                "count": payload["meta"]["count"],
            }
        )
        print(f"  {dir_name}/{slug}.json  ({payload['meta']['count']} items)")
    return entries


ENTITY_DISPATCH: dict[str, Callable[[list[dict], str], list[dict]]] = {
    "language": generate_language_dashboards,
    "subject": generate_subject_dashboards,
    "tag": generate_tag_dashboards,
    "genre": generate_genre_dashboards,
    "resource-type": generate_resource_type_dashboards,
    "group": generate_group_dashboards,
    "person": generate_person_dashboards,
    "institution": generate_institution_dashboards,
    "location": generate_location_dashboards,
    "research-section": generate_research_section_dashboards,
    "project": generate_project_dashboards,
}


# --------------------------------------------------------------------------
# IO helpers
# --------------------------------------------------------------------------


def _write_json(path: str, payload: dict) -> None:
    """Serialize with MongoDB Extended JSON so `{$date: ...}` round-trips."""
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(json_util.dumps(payload, ensure_ascii=False, indent=2))


def _write_manifest(out_root: str, manifest: dict[str, list[dict]]) -> None:
    """Merge entries for the regenerated entity types into the existing
    manifest on disk, preserving entries for types that weren't part of this
    run. A `--entity person` run shouldn't wipe out the institutions list."""
    path = os.path.join(out_root, "manifest.json")
    merged: dict[str, list[dict]] = {}
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as fh:
                existing = json.load(fh)
            if isinstance(existing, dict):
                merged.update(existing)
        except Exception as e:  # noqa: BLE001
            print(f"  (could not read existing manifest, starting fresh: {e})")
    merged.update(manifest)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(merged, fh, ensure_ascii=False, indent=2)
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
        for entity in ENTITY_DISPATCH if args.entity == "all" else [args.entity]:
            print(f"\n--- {entity} ---")
            if entity == "language":
                index = generators.language_index(items)
            elif entity == "subject":
                index = generators.subject_index(items)
            elif entity == "tag":
                index = generators.tag_index(items)
            elif entity == "genre":
                index = generators.genre_index(items)
            elif entity == "resource-type":
                index = generators.resource_type_index(items)
            elif entity == "group":
                index = generators.group_index(items)
            elif entity == "person":
                index = generators.person_index(items)
            elif entity == "institution":
                index = generators.institution_index(items)
            elif entity == "location":
                index = generators.location_index(items)
            elif entity == "research-section":
                index = generators.research_section_index(
                    items, db.load_projects_from_local()
                )
            elif entity == "project":
                index = generators.project_index(items)
            else:
                print(f"  (no dry-run inventory for '{entity}')")
                continue
            print(f"  {len(index)} unique {entity}s")
            top = sorted(index.items(), key=lambda kv: -len(kv[1]))[:5]
            for name, bucket in top:
                print(f"    {name}: {len(bucket)} items")
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
