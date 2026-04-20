#!/usr/bin/env python3
"""
Generate ego-network knowledge graphs for each research item.

For each item, builds a local graph showing:
- The item itself (center node)
- Its direct metadata entities (contributors, subjects, tags, locations, project, genres)
- Other items sharing those entities (2nd hop, limited)

Output: static/data/dev/dev.knowledge_graphs.json
Format: { "dre_id": { "nodes": [...], "links": [...], "categories": [...] }, ... }

Usage:
    python scripts/generate_knowledge_graphs.py
"""

import json
import glob
from pathlib import Path
from collections import defaultdict

STATIC_DATA = Path(__file__).parent.parent / "static" / "data"
OUTPUT_DIR = STATIC_DATA / "knowledge_graphs"

# Limits — more generous to show strong connections
MAX_RELATED_ITEMS_PER_ENTITY = 6
MAX_TOTAL_RELATED_ITEMS = 30

# Category indices — keep stable for color mapping
CAT_ITEM = 0        # Research items (center + related)
CAT_PERSON = 1      # Contributors
CAT_SUBJECT = 2     # Subjects (LCSH)
CAT_TAG = 3         # Tags / Keywords
CAT_LOCATION = 4    # Locations (countries, regions, cities)
CAT_PROJECT = 5     # Projects
CAT_GENRE = 6       # Genres
CAT_INSTITUTION = 7 # Institutions

CATEGORIES = [
    {"name": "Research Item"},
    {"name": "Person"},
    {"name": "Subject"},
    {"name": "Tag"},
    {"name": "Location"},
    {"name": "Project"},
    {"name": "Genre"},
    {"name": "Institution"},
]


def load_items():
    """Load all collection items from projects_metadata_* and external_metadata/."""
    items = []
    data_dirs = sorted(STATIC_DATA.glob("projects_metadata_*")) + [STATIC_DATA / "external_metadata"]
    for data_dir in data_dirs:
        if not data_dir.is_dir():
            continue
        for f in sorted(data_dir.glob("*.json")):
            with open(f, "r", encoding="utf-8") as fh:
                data = json.load(fh)
                if isinstance(data, list):
                    items.extend(data)
                else:
                    items.append(data)
    return items


def get_dre_id(item):
    return item.get("dre_id", "")


def get_title(item):
    ti = item.get("titleInfo", [])
    if ti and isinstance(ti, list) and ti[0].get("title"):
        title = ti[0]["title"]
        return title[:60] + "..." if len(title) > 60 else title
    return "Untitled"


def get_contributors(item):
    """Return list of (name, qualifier, affiliations)."""
    result = []
    for n in item.get("name", []) or []:
        if isinstance(n, dict) and n.get("name", {}).get("label"):
            name = n["name"]["label"]
            qualifier = n["name"].get("qualifier", "person")
            affiliations = [a for a in (n.get("affl") or []) if a]
            result.append((name, qualifier, affiliations))
    return result


def get_subjects(item):
    result = []
    for s in item.get("subject", []) or []:
        if isinstance(s, dict):
            label = s.get("authLabel") or s.get("origLabel")
            if label and isinstance(label, str):
                result.append(label)
    return result


def get_tags(item):
    return [t for t in (item.get("tags") or []) if t and isinstance(t, str)]


def get_origins(item):
    """Return list of location strings (most specific available)."""
    result = []
    loc_data = item.get("location")
    if not isinstance(loc_data, dict):
        return result
    for o in loc_data.get("origin", []) or []:
        if isinstance(o, dict):
            # Use most specific: city > region > country
            for key in ("l3", "l2", "l1"):
                val = o.get(key)
                if val and isinstance(val, str):
                    result.append(val)
                    break
    return result


def get_project(item):
    proj = item.get("project", {})
    if isinstance(proj, dict) and proj.get("name"):
        return proj["name"]
    return None


def get_genres(item):
    result = []
    genre = item.get("genre", {})
    if isinstance(genre, dict):
        for vals in genre.values():
            if isinstance(vals, list):
                result.extend(v for v in vals if v)
    return result


def get_institutions(item):
    """Get institution names from contributor affiliations."""
    institutions = set()
    for n in item.get("name", []) or []:
        if isinstance(n, dict):
            for a in (n.get("affl") or []):
                if a:
                    institutions.add(a)
            # Also include institution/group contributors
            if n.get("name", {}).get("qualifier") in ("institution", "group"):
                label = n.get("name", {}).get("label")
                if label:
                    institutions.add(label)
    return list(institutions)


def build_indexes(items):
    """Build reverse indexes: entity -> set of dre_ids."""
    idx = {
        "person": defaultdict(set),
        "subject": defaultdict(set),
        "tag": defaultdict(set),
        "location": defaultdict(set),
        "project": defaultdict(set),
        "genre": defaultdict(set),
        "institution": defaultdict(set),
    }

    for item in items:
        dre_id = get_dre_id(item)
        if not dre_id:
            continue

        for name, _, _ in get_contributors(item):
            idx["person"][name].add(dre_id)
        for s in get_subjects(item):
            idx["subject"][s].add(dre_id)
        for t in get_tags(item):
            idx["tag"][t].add(dre_id)
        for loc in get_origins(item):
            idx["location"][loc].add(dre_id)
        proj = get_project(item)
        if proj:
            idx["project"][proj].add(dre_id)
        for g in get_genres(item):
            idx["genre"][g].add(dre_id)
        for inst in get_institutions(item):
            idx["institution"][inst].add(dre_id)

    return idx


def build_ego_graph(item, indexes, item_lookup):
    """Build an ego-network graph for a single research item."""
    dre_id = get_dre_id(item)
    title = get_title(item)

    nodes = {}
    links = []

    def add_node(nid, name, category, size):
        if nid not in nodes:
            nodes[nid] = {"id": nid, "name": name, "category": category, "symbolSize": size}

    def add_link(source, target, label=""):
        link = {"source": source, "target": target}
        if label:
            link["label"] = label
        links.append(link)

    # Center node
    center_id = f"item:{dre_id}"
    add_node(center_id, title, CAT_ITEM, 35)

    # Track entity IDs for 2nd hop
    entity_ids = []  # (entity_node_id, entity_key, index_type)

    # Contributors
    for name, qualifier, affiliations in get_contributors(item):
        nid = f"person:{name}"
        add_node(nid, name, CAT_PERSON, 18)
        role_label = qualifier if qualifier != "person" else "contributor"
        add_link(center_id, nid, role_label)
        entity_ids.append((nid, name, "person"))
        # Add institution affiliations
        for aff in affiliations:
            aid = f"inst:{aff}"
            aff_short = aff[:40] + "..." if len(aff) > 40 else aff
            add_node(aid, aff_short, CAT_INSTITUTION, 14)
            add_link(nid, aid, "affiliated with")

    # Subjects
    for s in get_subjects(item):
        nid = f"subject:{s}"
        s_short = s[:40] + "..." if len(s) > 40 else s
        add_node(nid, s_short, CAT_SUBJECT, 14)
        add_link(center_id, nid, "has subject")
        entity_ids.append((nid, s, "subject"))

    # Tags
    for t in get_tags(item):
        nid = f"tag:{t}"
        add_node(nid, t, CAT_TAG, 12)
        add_link(center_id, nid, "tagged")
        entity_ids.append((nid, t, "tag"))

    # Locations
    for loc in get_origins(item):
        nid = f"loc:{loc}"
        add_node(nid, loc, CAT_LOCATION, 16)
        add_link(center_id, nid, "created at")
        entity_ids.append((nid, loc, "location"))

    # Project
    proj = get_project(item)
    if proj:
        nid = f"proj:{proj}"
        proj_short = proj[:40] + "..." if len(proj) > 40 else proj
        add_node(nid, proj_short, CAT_PROJECT, 20)
        add_link(center_id, nid, "belongs to")
        entity_ids.append((nid, proj, "project"))

    # Genres
    for g in get_genres(item):
        nid = f"genre:{g}"
        add_node(nid, g, CAT_GENRE, 14)
        add_link(center_id, nid, "genre")
        entity_ids.append((nid, g, "genre"))

    # 2nd hop: other items sharing entities with center item
    # Score each related item by how many entities they share
    related_scores = defaultdict(lambda: {"score": 0, "via": []})
    for entity_nid, entity_key, idx_type in entity_ids:
        connected_ids = indexes[idx_type].get(entity_key, set())
        for rid in connected_ids:
            if rid == dre_id:
                continue
            related_scores[rid]["score"] += 1
            related_scores[rid]["via"].append((entity_nid, idx_type))

    # Take top related items by score
    top_related = sorted(related_scores.items(), key=lambda x: -x[1]["score"])
    top_related = top_related[:MAX_TOTAL_RELATED_ITEMS]

    # Also limit per entity to avoid star graphs
    entity_counts = defaultdict(int)
    for rid, info in top_related:
        if rid not in item_lookup:
            continue
        # Check if any via-entity still has budget
        has_budget = False
        for entity_nid, idx_type in info["via"]:
            if entity_counts[entity_nid] < MAX_RELATED_ITEMS_PER_ENTITY:
                has_budget = True
                break
        if not has_budget:
            continue

        related_item = item_lookup[rid]
        r_title = get_title(related_item)
        r_nid = f"item:{rid}"
        add_node(r_nid, r_title, CAT_ITEM, 12)

        # Build a summary of what's shared for the item-to-item link
        ENTITY_TYPE_LABELS = {
            "person": "contributor",
            "subject": "subject",
            "tag": "tag",
            "location": "location",
            "project": "project",
            "genre": "genre",
            "institution": "institution",
        }
        shared_summaries = []
        used_entities = []
        for entity_nid, idx_type in info["via"]:
            if entity_counts[entity_nid] < MAX_RELATED_ITEMS_PER_ENTITY:
                # Extract entity name from node id (after the prefix:)
                entity_name = nodes[entity_nid]["name"] if entity_nid in nodes else ""
                shared_summaries.append(f"{ENTITY_TYPE_LABELS.get(idx_type, idx_type)}: {entity_name}")
                used_entities.append(entity_nid)
                entity_counts[entity_nid] += 1

        if used_entities:
            # Direct link between center item and related item
            share_label = "shares " + ", ".join(shared_summaries)
            add_link(center_id, r_nid, share_label)
            # Also link related item to the shared entities (no label, visual only)
            for entity_nid in used_entities:
                add_link(r_nid, entity_nid)

    return {
        "nodes": list(nodes.values()),
        "links": links,
        "categories": CATEGORIES,
    }


def main():
    print("Loading items...", flush=True)
    items = load_items()
    print(f"  Loaded {len(items)} items")

    # Build lookup and indexes
    item_lookup = {}
    for item in items:
        did = get_dre_id(item)
        if did:
            item_lookup[did] = item

    print("Building indexes...", flush=True)
    indexes = build_indexes(items)
    for key, idx in indexes.items():
        print(f"  {key}: {len(idx)} unique entities")

    print("Generating ego-networks...", flush=True)
    result = {}
    for i, item in enumerate(items):
        dre_id = get_dre_id(item)
        if not dre_id:
            continue
        graph = build_ego_graph(item, indexes, item_lookup)
        result[dre_id] = graph
        if (i + 1) % 500 == 0:
            print(f"  {i + 1}/{len(items)}...", flush=True)

    print(f"  Generated {len(result)} graphs")

    # Stats
    total_nodes = sum(len(g["nodes"]) for g in result.values())
    total_links = sum(len(g["links"]) for g in result.values())
    avg_nodes = total_nodes / len(result) if result else 0
    avg_links = total_links / len(result) if result else 0
    print(f"  Avg nodes/graph: {avg_nodes:.1f}, avg links/graph: {avg_links:.1f}")

    # Write one JSON file per item
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    total_bytes = 0
    for dre_id, graph in result.items():
        out_path = OUTPUT_DIR / f"{dre_id}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(graph, f, ensure_ascii=False, separators=(",", ":"))
        total_bytes += out_path.stat().st_size

    avg_kb = (total_bytes / len(result)) / 1024 if result else 0
    total_mb = total_bytes / (1024 * 1024)
    print(f"\nWrote {len(result)} files to {OUTPUT_DIR}")
    print(f"  Total: {total_mb:.1f} MB, avg: {avg_kb:.1f} KB/file")


if __name__ == "__main__":
    main()
