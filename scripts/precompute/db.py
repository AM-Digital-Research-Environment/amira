"""
MongoDB helpers for the precompute pipeline.

Reuses the connection conventions established in `scripts/fetch_from_mongodb.py`
(SECONDARY_PREFERRED read preference, 5-second timeout, VPN-gated access) and
adds a unified `load_all_items()` that returns every research item across the
four university databases, tagged with its source university code.
"""

import glob
import json
import os
import sys
from pathlib import Path
from typing import Iterable, Iterator

from pymongo import MongoClient, ReadPreference

from . import config


def connect(uri: str | None = None, auth_db: str | None = None) -> MongoClient:
    """
    Open a read-only MongoDB connection.

    Falls back to the `MONGO_URI` environment variable when no URI is passed.
    Raises SystemExit with a VPN-reminder if the server can't be reached.
    """
    uri = uri or os.environ.get("MONGO_URI")
    if not uri:
        sys.exit(
            "No MongoDB URI provided. Pass --uri or set MONGO_URI. "
            "Remember: university VPN must be connected."
        )

    # The auth_db flag is only used when the URI doesn't embed authSource.
    if auth_db and "authSource=" not in uri:
        sep = "&" if "?" in uri else "?"
        uri = f"{uri}{sep}authSource={auth_db}"

    try:
        client = MongoClient(
            uri,
            serverSelectionTimeoutMS=5000,
            read_preference=ReadPreference.SECONDARY_PREFERRED,
        )
        # Force a round-trip so we fail fast on connectivity issues.
        client.admin.command("ping")
        return client
    except Exception as err:
        sys.exit(f"MongoDB connection failed: {err}\nIs the VPN connected?")


def iter_university_items(client: MongoClient) -> Iterator[dict]:
    """
    Yield every collection-item document across all university databases.

    Each yielded item has a synthetic `_university` field (`UBT`, `ULG`, etc.)
    so downstream aggregators can filter or group by origin without another
    lookup.
    """
    for db_name in config.UNIVERSITY_DATABASES:
        code = db_name.split("_")[-1].upper()  # ubt -> UBT, etc.
        db = client[db_name]
        for coll_name in db.list_collection_names():
            for item in db[coll_name].find({}):
                item["_university"] = code
                item["_project_collection"] = coll_name
                yield item


def iter_external_items(client: MongoClient) -> Iterator[dict]:
    """Yield items from external metadata databases, tagged with source db."""
    for db_name in config.EXTERNAL_DATABASES:
        if db_name not in client.list_database_names():
            continue
        db = client[db_name]
        for coll_name in db.list_collection_names():
            for item in db[coll_name].find({}):
                item["_university"] = "EXT"
                item["_project_collection"] = coll_name
                yield item


def load_all_items(client: MongoClient, include_external: bool = True) -> list[dict]:
    """
    Load every research item into memory.

    This is the same shape the frontend's Svelte stores eventually consume,
    so aggregators can closely mirror their TypeScript counterparts.

    Materializing into a list (not a generator) is intentional: aggregators
    make multiple passes over the same dataset.
    """
    items: list[dict] = list(iter_university_items(client))
    if include_external:
        items.extend(iter_external_items(client))
    return items


def load_persons(client: MongoClient) -> list[dict]:
    return list(client["dev"]["persons"].find({}))


def load_projects(client: MongoClient) -> list[dict]:
    return list(client["dev"]["projectsData"].find({}))


def load_research_sections(client: MongoClient) -> list[dict]:
    """Research sections are stored in the `dev` database."""
    if "researchSections" in client["dev"].list_collection_names():
        return list(client["dev"]["researchSections"].find({}))
    return []


def count_by_key(items: Iterable[dict], key: str) -> dict[str, int]:
    """Tiny utility: count occurrences of a top-level string field."""
    counts: dict[str, int] = {}
    for item in items:
        value = item.get(key)
        if isinstance(value, str) and value:
            counts[value] = counts.get(value, 0) + 1
    return counts


# ---------------------------------------------------------------------------
# Offline / VPN-less mode — load items from the static JSON dumps.
# ---------------------------------------------------------------------------


def _university_code_from_dbname(db_name: str) -> str:
    """projects_metadata_ubt -> UBT."""
    return db_name.split("_")[-1].upper()


def load_all_items_from_local(
    data_dir: str = config.DATA_DIR,
    include_external: bool = True,
) -> list[dict]:
    """
    Load items straight from the JSONs emitted by `fetch_from_mongodb.py`.

    Files live under `static/data/projects_metadata_<code>/*.json` (one file
    per project collection). Each item is tagged with `_university` and
    `_project_collection` so downstream aggregators match the MongoDB path.

    Used by the `--from-local` flag on the orchestrator — useful for iterating
    without VPN access, and for CI where we can trust the committed JSONs.
    """
    items: list[dict] = []
    for db_name in config.UNIVERSITY_DATABASES:
        code = _university_code_from_dbname(db_name)
        pattern = os.path.join(data_dir, db_name, f"{db_name}.*.json")
        for path in sorted(glob.glob(pattern)):
            coll_name = Path(path).stem.split(".", 1)[-1]
            for item in _read_json_list(path):
                item["_university"] = code
                item["_project_collection"] = coll_name
                items.append(item)

    if include_external:
        for db_name in config.EXTERNAL_DATABASES:
            pattern = os.path.join(data_dir, db_name, f"{db_name}.*.json")
            for path in sorted(glob.glob(pattern)):
                coll_name = Path(path).stem.split(".", 1)[-1]
                for item in _read_json_list(path):
                    item["_university"] = "EXT"
                    item["_project_collection"] = coll_name
                    items.append(item)
    return items


def load_projects_from_local(data_dir: str = config.DATA_DIR) -> list[dict]:
    """Load the committed projects metadata (`dev.projectsData.json`).

    Used by the research-section generator to map items → section via
    `project.researchSection`. Returns an empty list if the file is missing
    rather than erroring out — callers are expected to check.
    """
    path = os.path.join(data_dir, "dev", "dev.projectsData.json")
    if not os.path.exists(path):
        return []
    return _read_json_list(path)


def _read_json_list(path: str) -> list[dict]:
    """Read a JSON file that may be a plain list or {"items": [...]}."""
    with open(path, encoding="utf-8") as fh:
        raw = json.load(fh)
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        for key in ("items", "data", "results"):
            val = raw.get(key)
            if isinstance(val, list):
                return val
    return []
