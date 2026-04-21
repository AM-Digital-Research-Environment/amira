#!/usr/bin/env python3
"""
Generate structural knowledge graphs for the WissKI Dashboard.
=============================================================

Why this script exists
----------------------
The earlier version of this script produced ego-networks from local
co-occurrence only: "these two items share a tag, draw an edge". That is a
**triples-first** view and has three limitations for a digital-humanities
archive:

1.  Triples aren't enough. One-relation-at-a-time graphs miss the bigger
    structure -- recurring neighbourhoods, indirect dependencies, bridging
    paths that only emerge over several hops.
2.  Knowledge graphs are never neutral. What we include, exclude, normalise,
    or connect shapes what the user sees. Making those choices explicit (via
    weighting and facets on the rendering side) is part of the job.
3.  The interesting structures are **latent**. Discursive communities, key
    broker nodes, items that share a neighbourhood without sharing a tag --
    none of these surface from local edges alone.

This script therefore treats the whole archive as a single weighted graph and
runs three global analyses on it before slicing out per-entity ego-networks:

* **IDF weighting** -- edge weight reflects how distinctive the shared entity
  is (rare subject edges are heavier than ubiquitous ones).
* **Louvain community detection** -- every node is assigned a `cluster` that
  represents the discursive mode it belongs to. Communities are the recurring
  ways the field organises meaning.
* **PageRank** -- every node gets an `importance` score, surfacing the key
  discursive nodes in the field. Used to size nodes in the UI.
* **Personalised PageRank + Jaccard similarity** -- for each ego-centre, we
  pull in indirect neighbours that simple 2-hop would miss and/or items with
  strongly overlapping neighbourhoods. These show up as "latent" edges.

Output
------
`static/data/knowledge_graphs/<type>/<slug>.json` -- one JSON per entity, where
`<type>` is one of: items, persons, subjects, tags, locations, projects,
genres, institutions. Plus `static/data/knowledge_graphs/_meta.json` carrying
global community labels and the dashboard-wide top-level network.

File schema (per ego graph)
---------------------------
```
{
  "nodes": [
    {"id", "name", "category", "symbolSize", "cluster", "importance"},
    ...
  ],
  "links": [
    {"source", "target", "label", "value", "relation"},
    ...
  ],
  "categories": [{"name"}, ...],
  "clusters":   [{"id", "label", "count"}, ...],
  "center":     "<node id of the centre>"
}
```

`relation` is one of: "direct" (metadata edge, e.g. contributor/tag/etc.) or
"latent" (derived via Jaccard / personalised PageRank). The UI uses this to
style edges differently.

Run
---
    .venv/Scripts/python.exe scripts/generate_knowledge_graphs.py

Expect ~1-3 minutes on a cold run (Louvain + per-entity PPR are the cost).
"""

from __future__ import annotations

import json
import math
import re
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

import networkx as nx


# =============================================================================
# Configuration
# =============================================================================

STATIC_DATA = Path(__file__).parent.parent / "static" / "data"
OUTPUT_DIR = STATIC_DATA / "knowledge_graphs"

# Category indices used by the frontend. Keep these stable: the colour mapping
# in `src/lib/components/charts/NetworkGraph.svelte` is keyed on them.
CAT_ITEM = 0
CAT_PERSON = 1
CAT_SUBJECT = 2
CAT_TAG = 3
CAT_LOCATION = 4
CAT_PROJECT = 5
CAT_GENRE = 6
CAT_INSTITUTION = 7

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

# Node id prefix per entity type. These are the same prefixes the frontend's
# click handler splits on, so don't rename without updating
# `EntityKnowledgeGraph.svelte`.
PREFIX = {
    "item": "item",
    "person": "person",
    "subject": "subject",
    "tag": "tag",
    "location": "loc",
    "project": "proj",
    "genre": "genre",
    "institution": "inst",
}

# The `type` segment of the output path (`static/data/knowledge_graphs/<type>/`)
OUT_TYPE = {
    "item": "items",
    "person": "persons",
    "subject": "subjects",
    "tag": "tags",
    "location": "locations",
    "project": "projects",
    "genre": "genres",
    "institution": "institutions",
}

CAT_BY_TYPE = {
    "item": CAT_ITEM,
    "person": CAT_PERSON,
    "subject": CAT_SUBJECT,
    "tag": CAT_TAG,
    "location": CAT_LOCATION,
    "project": CAT_PROJECT,
    "genre": CAT_GENRE,
    "institution": CAT_INSTITUTION,
}

# Ego-graph sizing. These are deliberately generous -- a sparse graph is the
# old failure mode, not the new one. Visual crowding is managed client-side
# via facet filters.
TOP_DIRECT = 40           # max direct-neighbour nodes to include
TOP_PPR = 25              # max latent (PPR-based) nodes to include
TOP_SIMILAR_ITEMS = 10    # max Jaccard-similar items per item ego
BRIDGE_PER_COMMUNITY = 2  # extra cross-community bridges to include
MIN_JACCARD = 0.18        # Jaccard cutoff for item-item latent edges
MIN_PPR_SCORE = 1e-4      # personalised PageRank cutoff for inclusion

# Louvain resolution. Higher -> more, smaller communities. We want enough
# granularity to give the UI meaningful colour-coded clusters but not so many
# that every node ends up in its own.
LOUVAIN_RESOLUTION = 1.2

# Truncate very long labels for display.
MAX_LABEL_LEN = 60


# =============================================================================
# Data loading
# =============================================================================

def load_items() -> list[dict]:
    """Load every collection item from `projects_metadata_*` + `external_metadata/`.

    Each directory contains one JSON per item (or a list of items); we flatten
    it all into a single in-memory list.
    """
    items: list[dict] = []
    data_dirs = sorted(STATIC_DATA.glob("projects_metadata_*")) + [
        STATIC_DATA / "external_metadata"
    ]
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


# ---------------------------------------------------------------------------
# Field extractors -- tolerate missing / malformed metadata.
# ---------------------------------------------------------------------------

def _truncate(s: str, limit: int = MAX_LABEL_LEN) -> str:
    if not s:
        return s
    return s if len(s) <= limit else s[: limit - 1] + "\u2026"


def get_dre_id(item: dict) -> str:
    return item.get("dre_id", "")


def get_title(item: dict) -> str:
    ti = item.get("titleInfo", [])
    if ti and isinstance(ti, list) and isinstance(ti[0], dict) and ti[0].get("title"):
        return _truncate(ti[0]["title"])
    return "Untitled"


def get_contributors(item: dict) -> list[tuple[str, str, list[str]]]:
    """Return list of (name, qualifier, affiliations)."""
    result: list[tuple[str, str, list[str]]] = []
    for n in item.get("name", []) or []:
        if isinstance(n, dict) and n.get("name", {}).get("label"):
            name = n["name"]["label"]
            qualifier = n["name"].get("qualifier", "person")
            affiliations = [a for a in (n.get("affl") or []) if a]
            result.append((name, qualifier, affiliations))
    return result


def get_subjects(item: dict) -> list[str]:
    result: list[str] = []
    for s in item.get("subject", []) or []:
        if isinstance(s, dict):
            label = s.get("authLabel") or s.get("origLabel")
            if label and isinstance(label, str):
                result.append(label)
    return result


def get_tags(item: dict) -> list[str]:
    return [t for t in (item.get("tags") or []) if t and isinstance(t, str)]


def get_origins(item: dict) -> list[str]:
    """Most specific available location per origin (city > region > country)."""
    result: list[str] = []
    loc_data = item.get("location")
    if not isinstance(loc_data, dict):
        return result
    for o in loc_data.get("origin", []) or []:
        if isinstance(o, dict):
            for key in ("l3", "l2", "l1"):
                val = o.get(key)
                if val and isinstance(val, str):
                    result.append(val)
                    break
    return result


def get_project(item: dict) -> str | None:
    proj = item.get("project", {})
    if isinstance(proj, dict) and proj.get("name"):
        return proj["name"]
    return None


def get_genres(item: dict) -> list[str]:
    result: list[str] = []
    genre = item.get("genre", {})
    if isinstance(genre, dict):
        for vals in genre.values():
            if isinstance(vals, list):
                result.extend(v for v in vals if v)
    return result


def get_institutions(item: dict) -> list[str]:
    """Institution names from contributor affiliations + institution/group contributors."""
    institutions: set[str] = set()
    for n in item.get("name", []) or []:
        if isinstance(n, dict):
            for a in n.get("affl") or []:
                if a:
                    institutions.add(a)
            if n.get("name", {}).get("qualifier") in ("institution", "group"):
                label = n.get("name", {}).get("label")
                if label:
                    institutions.add(label)
    return list(institutions)


# =============================================================================
# Global graph construction
# =============================================================================

def node_id(entity_type: str, key: str) -> str:
    """Build a stable node identifier: `person:Alice`, `item:abc-01`, etc."""
    return f"{PREFIX[entity_type]}:{key}"


def idf(doc_count: int, total_docs: int) -> float:
    """Inverse document frequency (smoothed).

    A subject that appears on every item scores near 0; a subject that appears
    on one item scores near log(N). We use this to weight edges so that
    distinctive connections look heavy and ubiquitous ones look light.
    """
    return math.log((total_docs + 1) / (doc_count + 1)) + 1.0


def build_global_graph(items: list[dict]) -> tuple[nx.Graph, dict[str, dict]]:
    """Build a single weighted undirected graph over the whole archive.

    Returns
    -------
    G : nx.Graph
        Nodes keyed by `node_id(type, name)`, with `type`, `label`, `category`
        attributes. Edges carry a `weight` (from IDF) and `relation` label
        (contributor / has subject / tagged / ...).
    meta : dict[str, dict]
        Per-entity metadata (type, label, raw key) for the frontend.
    """
    G = nx.Graph()
    meta: dict[str, dict] = {}

    # -- First pass: count document frequency for IDF -------------------------
    df: dict[tuple[str, str], int] = defaultdict(int)
    for item in items:
        if not get_dre_id(item):
            continue
        for kind, values in _iter_entities(item):
            for v in set(values):  # dedupe within item
                df[(kind, v)] += 1
    total = len([i for i in items if get_dre_id(i)])

    # -- Second pass: add nodes + edges ---------------------------------------
    def _add_node(nid: str, *, entity_type: str, label: str, raw_key: str) -> None:
        if nid not in G:
            G.add_node(
                nid,
                type=entity_type,
                label=label,
                category=CAT_BY_TYPE[entity_type],
            )
            meta[nid] = {"type": entity_type, "label": label, "key": raw_key}

    def _add_edge(a: str, b: str, weight: float, relation: str) -> None:
        if G.has_edge(a, b):
            # Take max to preserve the strongest relation between two nodes.
            if weight > G[a][b]["weight"]:
                G[a][b]["weight"] = weight
                G[a][b]["relation"] = relation
        else:
            G.add_edge(a, b, weight=weight, relation=relation)

    for item in items:
        did = get_dre_id(item)
        if not did:
            continue

        item_nid = node_id("item", did)
        _add_node(item_nid, entity_type="item", label=get_title(item), raw_key=did)

        # Contributors + their affiliations
        for name, qualifier, affiliations in get_contributors(item):
            pnid = node_id("person", name)
            _add_node(pnid, entity_type="person", label=name, raw_key=name)
            relation = qualifier if qualifier != "person" else "contributor"
            _add_edge(item_nid, pnid, idf(df[("person", name)], total), relation)
            for aff in affiliations:
                inid = node_id("institution", aff)
                _add_node(inid, entity_type="institution", label=_truncate(aff), raw_key=aff)
                _add_edge(pnid, inid, idf(df[("institution", aff)], total), "affiliated with")

        # Subjects
        for s in get_subjects(item):
            nid = node_id("subject", s)
            _add_node(nid, entity_type="subject", label=_truncate(s), raw_key=s)
            _add_edge(item_nid, nid, idf(df[("subject", s)], total), "has subject")

        # Tags
        for t in get_tags(item):
            nid = node_id("tag", t)
            _add_node(nid, entity_type="tag", label=t, raw_key=t)
            _add_edge(item_nid, nid, idf(df[("tag", t)], total), "tagged")

        # Locations
        for loc in get_origins(item):
            nid = node_id("location", loc)
            _add_node(nid, entity_type="location", label=loc, raw_key=loc)
            _add_edge(item_nid, nid, idf(df[("location", loc)], total), "created at")

        # Project
        proj = get_project(item)
        if proj:
            nid = node_id("project", proj)
            _add_node(nid, entity_type="project", label=_truncate(proj), raw_key=proj)
            _add_edge(item_nid, nid, idf(df[("project", proj)], total), "belongs to")

        # Genres
        for g in get_genres(item):
            nid = node_id("genre", g)
            _add_node(nid, entity_type="genre", label=g, raw_key=g)
            _add_edge(item_nid, nid, idf(df[("genre", g)], total), "genre")

        # Institutions (standalone, e.g. institution-as-contributor)
        for inst in get_institutions(item):
            nid = node_id("institution", inst)
            _add_node(nid, entity_type="institution", label=_truncate(inst), raw_key=inst)
            _add_edge(item_nid, nid, idf(df[("institution", inst)], total), "affiliated with")

    return G, meta


def _iter_entities(item: dict) -> Iterable[tuple[str, list[str]]]:
    """Yield (entity_type, values) for every entity mentioned by the item.

    Used only by the IDF-counting pass -- keeps the counting code symmetric
    with the graph-building code.
    """
    yield "person", [n for n, _, _ in get_contributors(item)]
    yield "subject", list(get_subjects(item))
    yield "tag", list(get_tags(item))
    yield "location", list(get_origins(item))
    proj = get_project(item)
    yield "project", [proj] if proj else []
    yield "genre", list(get_genres(item))
    yield "institution", list(get_institutions(item))


# =============================================================================
# Derived / projection edges
# =============================================================================

def add_projection_edges(G: nx.Graph) -> None:
    """Add weighted edges between same-type nodes that share item neighbours.

    Person-Person co-contributor edges, Subject-Subject co-occurrence edges,
    Institution-Institution collaboration edges. These are bipartite
    projections of the item-centric graph, and they're what actually carry
    the "shared neighbourhood" signal that the problem statement demands.

    We only add an edge when at least two items connect the two non-item
    nodes -- otherwise a single weak link swamps the visible network with
    spurious co-occurrence edges.
    """
    items_by_type: dict[str, set[str]] = {"item": set()}
    for n, data in G.nodes(data=True):
        t = data["type"]
        items_by_type.setdefault(t, set()).add(n)

    # For each item, collect its non-item neighbours grouped by type
    for item_node in list(items_by_type.get("item", set())):
        nbrs_by_type: dict[str, list[str]] = defaultdict(list)
        for nb in G.neighbors(item_node):
            nbrs_by_type[G.nodes[nb]["type"]].append(nb)

        # Pairwise edges within the types we want to project
        for proj_type in ("person", "subject", "institution"):
            nodes = nbrs_by_type.get(proj_type, [])
            for i in range(len(nodes)):
                for j in range(i + 1, len(nodes)):
                    a, b = nodes[i], nodes[j]
                    if G.has_edge(a, b):
                        G[a][b]["weight"] += 0.5  # strengthen with each co-occurrence
                        G[a][b]["count"] = G[a][b].get("count", 1) + 1
                    else:
                        G.add_edge(
                            a,
                            b,
                            weight=1.0,
                            relation={
                                "person": "co-contributor",
                                "subject": "co-occurs with",
                                "institution": "collaborates with",
                            }[proj_type],
                            count=1,
                            projected=True,
                        )

    # Prune projected edges with only a single shared item -- these are noise
    to_drop: list[tuple[str, str]] = []
    for u, v, data in G.edges(data=True):
        if data.get("projected") and data.get("count", 0) < 2:
            to_drop.append((u, v))
    G.remove_edges_from(to_drop)


# =============================================================================
# Global structural analysis
# =============================================================================

def analyse_structure(G: nx.Graph) -> tuple[dict[str, int], dict[str, float]]:
    """Run Louvain community detection and PageRank on the full graph.

    Louvain surfaces the "discursive modes" -- clusters of nodes that are more
    densely connected to each other than to the rest. PageRank surfaces the
    "key discursive nodes" -- who/what everything else routes through.

    We run them once on the global graph so that every ego-network shares the
    same community labels (a subject keeps its cluster colour whether you view
    it from a person ego or an item ego).
    """
    print(f"  Running Louvain (resolution={LOUVAIN_RESOLUTION})...", flush=True)
    communities = nx.community.louvain_communities(
        G, weight="weight", resolution=LOUVAIN_RESOLUTION, seed=42
    )
    cluster_of: dict[str, int] = {}
    for cid, comm in enumerate(communities):
        for n in comm:
            cluster_of[n] = cid
    print(f"    found {len(communities)} communities", flush=True)

    print("  Running PageRank...", flush=True)
    pr = nx.pagerank(G, alpha=0.85, weight="weight")
    # Normalise to [0, 1] for frontend sizing
    pr_max = max(pr.values()) if pr else 1.0
    pr_norm = {n: v / pr_max for n, v in pr.items()}

    return cluster_of, pr_norm


def label_communities(G: nx.Graph, cluster_of: dict[str, int]) -> dict[int, dict]:
    """Give each community a human-readable label.

    The label is the top-weighted subject/tag/project in the community, with a
    size and a representative node for navigation.
    """
    by_cluster: dict[int, list[str]] = defaultdict(list)
    for n, cid in cluster_of.items():
        by_cluster[cid].append(n)

    out: dict[int, dict] = {}
    for cid, members in by_cluster.items():
        # Pick a representative label -- prefer subjects > tags > projects > persons
        best_rep: tuple[int, str] | None = None  # (priority_weight, label)
        priority = {
            "subject": 5,
            "tag": 4,
            "project": 3,
            "person": 2,
            "genre": 1,
            "location": 1,
            "institution": 1,
            "item": 0,
        }
        for n in members:
            t = G.nodes[n]["type"]
            p = priority.get(t, 0)
            # degree as tiebreaker
            deg = G.degree(n, weight="weight")
            score = p * 1000 + deg
            if best_rep is None or score > best_rep[0]:
                best_rep = (score, G.nodes[n]["label"])
        label = best_rep[1] if best_rep else f"Community {cid}"
        out[cid] = {"id": cid, "label": label, "count": len(members)}
    return out


# =============================================================================
# Per-entity ego graph extraction
# =============================================================================

def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def build_ego_graph(
    center: str,
    G: nx.Graph,
    cluster_of: dict[str, int],
    pagerank: dict[str, float],
    *,
    top_direct: int = TOP_DIRECT,
    top_ppr: int = TOP_PPR,
    top_similar_items: int = TOP_SIMILAR_ITEMS,
    min_jaccard: float = MIN_JACCARD,
    min_ppr: float = MIN_PPR_SCORE,
) -> dict:
    """Return a rich ego-graph centred on `center`.

    The graph includes:

    1. Direct neighbours (up to `top_direct`, ranked by IDF-weighted edge weight).
    2. Item-item similarity edges via Jaccard on neighbourhood sets (finds
       items that share a neighbourhood even when they share no direct tag).
    3. Personalised-PageRank latent neighbours (up to `top_ppr`, filtered to
       exclude the trivially-direct ones) -- these are the multi-hop
       relationships that local triples miss.
    4. Cross-community bridges: per other community that shares any edge with
       the centre's community, pull the top PPR node from it. This exposes
       dialectical / contrasting relationships.
    """
    if center not in G:
        return _empty_graph(center)

    # -- Personalised PageRank ------------------------------------------------
    # Seeded at the centre; converges on nodes that are structurally close in
    # the weighted graph sense, not just topologically adjacent.
    personalization = {center: 1.0}
    try:
        ppr = nx.pagerank(
            G,
            alpha=0.8,
            personalization=personalization,
            weight="weight",
            max_iter=100,
        )
    except nx.PowerIterationFailedConvergence:
        ppr = {n: 0.0 for n in G.nodes}

    # -- Direct neighbours ----------------------------------------------------
    direct_neighbors = sorted(
        G[center].items(),
        key=lambda kv: kv[1]["weight"],
        reverse=True,
    )[:top_direct]
    included: set[str] = {center}
    included.update(n for n, _ in direct_neighbors)

    # -- Jaccard-similar items (for item-centred egos) ------------------------
    similar_items: list[tuple[str, float]] = []
    if G.nodes[center]["type"] == "item":
        center_nbrs = set(G.neighbors(center))
        scored: dict[str, float] = {}
        # Only consider items that share at least one neighbour -- O(d^2).
        candidates: set[str] = set()
        for nb in center_nbrs:
            for other in G.neighbors(nb):
                if other == center:
                    continue
                if G.nodes[other]["type"] == "item":
                    candidates.add(other)
        for cand in candidates:
            jacc = jaccard(center_nbrs, set(G.neighbors(cand)))
            if jacc >= min_jaccard:
                scored[cand] = jacc
        similar_items = sorted(scored.items(), key=lambda kv: kv[1], reverse=True)[
            :top_similar_items
        ]
        for sid, _ in similar_items:
            included.add(sid)

    # -- Personalised-PageRank latent neighbours ------------------------------
    # Exclude the centre itself and very low-score nodes; prefer nodes that
    # aren't already pulled in as direct neighbours.
    center_cluster = cluster_of.get(center)
    latent_nodes: list[tuple[str, float]] = []
    direct_set = {n for n, _ in direct_neighbors}
    for n, score in sorted(ppr.items(), key=lambda kv: kv[1], reverse=True):
        if n == center or score < min_ppr:
            continue
        if n in direct_set:
            continue
        latent_nodes.append((n, score))
        if len(latent_nodes) >= top_ppr:
            break
    for n, _ in latent_nodes:
        included.add(n)

    # -- Cross-community bridges: one top-PPR node per adjacent community ----
    # This is what exposes contrasting / dialectical ties.
    other_clusters: dict[int, list[tuple[str, float]]] = defaultdict(list)
    for n, score in ppr.items():
        if n == center or score < min_ppr / 2:
            continue
        cid = cluster_of.get(n, -1)
        if cid != center_cluster:
            other_clusters[cid].append((n, score))
    for cid, candidates in other_clusters.items():
        candidates.sort(key=lambda kv: kv[1], reverse=True)
        for n, _ in candidates[:BRIDGE_PER_COMMUNITY]:
            included.add(n)

    # -- Emit nodes + edges ---------------------------------------------------
    nodes_out: list[dict] = []
    for n in included:
        data = G.nodes[n]
        pr = pagerank.get(n, 0.0)
        size = _symbol_size(data["type"], n == center, pr)
        nodes_out.append(
            {
                "id": n,
                "name": data["label"],
                "category": data["category"],
                "symbolSize": size,
                "cluster": cluster_of.get(n, -1),
                "importance": round(pr, 4),
            }
        )

    edges_out: list[dict] = []
    seen_edges: set[tuple[str, str]] = set()

    def _push_edge(u: str, v: str, *, label: str, value: float, relation: str) -> None:
        key = tuple(sorted((u, v)))
        if key in seen_edges:
            return
        seen_edges.add(key)
        edge: dict[str, Any] = {
            "source": u,
            "target": v,
            "value": round(value, 3),
            "relation": relation,
        }
        if label:
            edge["label"] = label
        edges_out.append(edge)

    # Emit all edges that land between nodes in the ego graph.
    for a in included:
        for b in G[a]:
            if b not in included:
                continue
            if (tuple(sorted((a, b)))) in seen_edges:
                continue
            data = G[a][b]
            relation = data.get("relation", "")
            weight = data.get("weight", 1.0)
            _push_edge(
                a,
                b,
                label=relation,
                value=weight,
                relation="direct",
            )

    # Emit Jaccard latent edges for item centres -- these are "structural
    # equivalence" edges: the two items share a neighbourhood, not a specific
    # label.
    for sid, jacc in similar_items:
        if sid == center:
            continue
        # If the two are already connected by a direct edge, don't overwrite --
        # emit it as a separate "similar to" hint.
        key = tuple(sorted((center, sid)))
        if key in seen_edges:
            # annotate existing edge with similarity context
            continue
        edges_out.append(
            {
                "source": center,
                "target": sid,
                "value": round(1.0 + jacc * 3.0, 3),
                "label": f"shares neighbourhood ({jacc:.0%})",
                "relation": "latent",
            }
        )
        seen_edges.add(key)

    # Emit personalised-PageRank latent edges from centre to top nodes that
    # aren't already directly connected.
    for n, score in latent_nodes:
        key = tuple(sorted((center, n)))
        if key in seen_edges:
            continue
        # Boost width with PPR score; cap for readability
        value = min(2.0, 0.5 + score * 200.0)
        edges_out.append(
            {
                "source": center,
                "target": n,
                "value": round(value, 3),
                "label": "structurally close",
                "relation": "latent",
            }
        )
        seen_edges.add(key)

    # Bring back community labels for only the clusters represented in this
    # ego graph (so the UI legend is short).
    clusters_present = {n["cluster"] for n in nodes_out if n["cluster"] >= 0}

    return {
        "nodes": nodes_out,
        "links": edges_out,
        "categories": CATEGORIES,
        "clusters": clusters_present,  # caller fills in labels
        "center": center,
    }


def _symbol_size(entity_type: str, is_center: bool, importance: float) -> int:
    """Node visual size. Larger for centres, larger for higher-PageRank nodes."""
    base = {
        "item": 14,
        "person": 14,
        "subject": 12,
        "tag": 10,
        "location": 12,
        "project": 16,
        "genre": 12,
        "institution": 12,
    }.get(entity_type, 12)
    if is_center:
        return max(28, int(base * 1.8 + 8))
    # importance is in [0, 1]; scale up by up to ~12 extra px
    return int(base + importance * 12)


def _empty_graph(center: str) -> dict:
    return {
        "nodes": [],
        "links": [],
        "categories": CATEGORIES,
        "clusters": set(),
        "center": center,
    }


# =============================================================================
# Filesystem helpers
# =============================================================================

_slug_re = re.compile(r"[^a-z0-9\-]+")


def slugify(s: str) -> str:
    """Produce a filesystem-safe slug for entity keys (used in output paths).

    Items already use slug-like `dre_id`s; persons/subjects/etc. need
    normalisation so that they survive serialization to `{slug}.json` and
    don't collide.
    """
    s = s.lower().strip()
    s = s.replace("/", "-").replace("\\", "-")
    s = _slug_re.sub("-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s[:120] or "unknown"


def write_graph(graph: dict, cluster_labels: dict[int, dict], out_path: Path) -> int:
    """Serialise a graph with cluster labels resolved. Returns bytes written."""
    clusters_out = sorted(
        (cluster_labels.get(cid, {"id": cid, "label": f"Community {cid}", "count": 0})
         for cid in graph["clusters"]),
        key=lambda c: -c["count"],
    )
    payload = {
        "nodes": graph["nodes"],
        "links": graph["links"],
        "categories": graph["categories"],
        "clusters": clusters_out,
        "center": graph["center"],
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    return out_path.stat().st_size


# =============================================================================
# Main pipeline
# =============================================================================

def main() -> int:
    t0 = time.monotonic()

    print("Loading items...", flush=True)
    items = load_items()
    n_items = len([i for i in items if get_dre_id(i)])
    print(f"  Loaded {n_items} items with dre_id")

    print("Building global graph...", flush=True)
    G, meta = build_global_graph(items)
    print(f"  {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

    print("Adding projection edges (person/subject/institution)...", flush=True)
    add_projection_edges(G)
    print(f"  After projections: {G.number_of_edges()} edges")

    print("Running global structural analysis...", flush=True)
    cluster_of, pagerank = analyse_structure(G)
    cluster_labels = label_communities(G, cluster_of)

    # -- Decide which entities get an ego graph -------------------------------
    # Items always get one. For other entity types we skip very-low-degree
    # nodes to avoid noisy single-item star graphs. The threshold is per-type
    # because, e.g., projects are inherently lower in count than tags.
    min_degree = {
        "item": 0,
        "person": 1,
        "subject": 1,
        "tag": 1,
        "location": 1,
        "project": 0,
        "genre": 1,
        "institution": 1,
    }

    # -- Clear previous output so deletes propagate ---------------------------
    if OUTPUT_DIR.exists():
        for sub in ("items", "persons", "subjects", "tags", "locations",
                    "projects", "genres", "institutions"):
            d = OUTPUT_DIR / sub
            if d.exists():
                for f in d.glob("*.json"):
                    f.unlink()
        # Also remove old flat layout files from the previous script version
        for f in OUTPUT_DIR.glob("*.json"):
            f.unlink()

    print("Generating per-entity ego-graphs...", flush=True)
    counts: dict[str, int] = defaultdict(int)
    total_bytes = 0
    all_nodes = list(G.nodes(data=True))
    all_nodes.sort(key=lambda nd: (nd[1]["type"], nd[0]))

    for i, (n, data) in enumerate(all_nodes):
        t = data["type"]
        if G.degree(n) < min_degree[t]:
            continue
        ego = build_ego_graph(n, G, cluster_of, pagerank)
        if not ego["nodes"]:
            continue
        slug = slugify(meta[n]["key"])
        out_path = OUTPUT_DIR / OUT_TYPE[t] / f"{slug}.json"
        total_bytes += write_graph(ego, cluster_labels, out_path)
        counts[t] += 1
        if (i + 1) % 1000 == 0:
            print(f"  {i + 1}/{len(all_nodes)}...", flush=True)

    # -- Write global meta file (community labels + top-level summary) -------
    # Useful for the /network page and for front-end facets.
    top_pagerank = sorted(pagerank.items(), key=lambda kv: kv[1], reverse=True)[:100]
    meta_payload = {
        "nodes_total": G.number_of_nodes(),
        "edges_total": G.number_of_edges(),
        "communities": [
            {
                "id": c["id"],
                "label": c["label"],
                "count": c["count"],
            }
            for c in sorted(cluster_labels.values(), key=lambda c: -c["count"])
        ],
        "top_nodes": [
            {
                "id": n,
                "label": G.nodes[n]["label"],
                "type": G.nodes[n]["type"],
                "category": G.nodes[n]["category"],
                "importance": round(score, 4),
                "cluster": cluster_of.get(n, -1),
            }
            for n, score in top_pagerank
        ],
    }
    meta_out = OUTPUT_DIR / "_meta.json"
    meta_out.parent.mkdir(parents=True, exist_ok=True)
    with open(meta_out, "w", encoding="utf-8") as f:
        json.dump(meta_payload, f, ensure_ascii=False, separators=(",", ":"))

    # -- Summary --------------------------------------------------------------
    dt = time.monotonic() - t0
    print()
    for t, c in sorted(counts.items()):
        print(f"  {t:13s}: {c} graphs")
    print(f"  total bytes : {total_bytes / (1024 * 1024):.1f} MB")
    print(f"  elapsed     : {dt:.1f}s")
    print(f"  output root : {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
