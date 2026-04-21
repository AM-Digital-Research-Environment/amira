"""
Generate semantic embeddings for research items using Gemini Embedding.

READS from the per-project / external metadata JSONs under `static/data/`,
computes a Gemini embedding for each item's metadata blob, projects the
vectors to 2D with UMAP, and pre-computes a top-K cosine-similarity table
for the "similar items" UI. All three outputs are written to
`static/data/embeddings/`.

Usage:
    .venv/Scripts/python scripts/generate_embeddings.py
    .venv/Scripts/python scripts/generate_embeddings.py --scope all
    .venv/Scripts/python scripts/generate_embeddings.py --dry-run

Requires a `GEMINI_API_KEY` in `.env` (or the environment).

Outputs
-------
- `static/data/embeddings/cache.json` (NOT shipped -- .gitignored)
    Source of truth. Full float vectors keyed by `dre_id`, plus content
    hashes so subsequent runs only re-embed items whose metadata changed.
- `static/data/embeddings/map.json`   (shipped)
    Lightweight payload the frontend loads: per-item `{id, x, y, ...}`
    with UMAP 2D coordinates and a `lowSignal` flag for items whose
    concatenated metadata is shorter than `LOW_SIGNAL_THRESHOLD` chars.
- `static/data/embeddings/similar.json` (shipped)
    Pre-computed top-K cosine neighbours per item.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from glob import glob
from pathlib import Path
from typing import Any

# Third-party imports are deferred so `--help` works without the venv.

# gemini-embedding-001 is the GA text-embedding model. We tried
# gemini-embedding-2-preview first (it's the one the Jan 2026 "Gemini
# Embedding 2" blog post advertises) but the preview endpoint only returns
# ONE embedding per `contents=[list]` call, so 4k items at batch=100 was
# silently producing 40 vectors instead of 4000. The GA v1 model does proper
# list batching, has a vastly higher quota (~1500 rpm), and supports the same
# 768/3072-dim Matryoshka output.
MODEL = os.environ.get("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
OUTPUT_DIMS = int(os.environ.get("GEMINI_EMBEDDING_DIMS", "768"))
# v1 uses the task_type enum (unlike v2's text prefix). "CLUSTERING" fits
# because we use the same vectors for the 2D scatter AND for near-neighbour
# lookup on the detail panel.
TASK_TYPE = os.environ.get("GEMINI_EMBEDDING_TASK", "CLUSTERING")
BATCH_SIZE = int(os.environ.get("GEMINI_EMBEDDING_BATCH", "100"))
# Small throttle between batches. v1's quota is generous (~1500 rpm) but we
# keep a 0.5s floor to smooth bursts and stay friendly. Override via env.
INTER_BATCH_DELAY_S = float(os.environ.get("GEMINI_EMBEDDING_DELAY_S", "0.5"))
# Flush the cache to disk every N successful batches so a mid-run quota /
# network failure doesn't throw away the work done so far.
FLUSH_EVERY_N_BATCHES = int(os.environ.get("GEMINI_EMBEDDING_FLUSH_EVERY", "5"))
LOW_SIGNAL_THRESHOLD = 100  # chars of concatenated metadata
SIMILAR_TOP_K = 12
UMAP_NEIGHBORS = 15
UMAP_MIN_DIST = 0.1
UMAP_METRIC = "cosine"
UMAP_SEED = 42

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / "static" / "data"
OUT_DIR = DATA_DIR / "embeddings"
CACHE_PATH = OUT_DIR / "cache.json"
MAP_PATH = OUT_DIR / "map.json"
SIMILAR_PATH = OUT_DIR / "similar.json"


# ---------------------------------------------------------------------------
# Metadata ingestion
# ---------------------------------------------------------------------------


def normalise_mongo(value: Any) -> Any:
    """Unwrap MongoDB Extended JSON artifacts ($numberDouble:NaN, $oid, $date)."""
    if isinstance(value, dict):
        if value.get("$numberDouble") == "NaN":
            return None
        if "$oid" in value and len(value) == 1:
            return value["$oid"]
        if "$date" in value and len(value) == 1:
            return value["$date"]
        return {k: normalise_mongo(v) for k, v in value.items()}
    if isinstance(value, list):
        return [normalise_mongo(v) for v in value]
    return value


def _s(v: Any) -> str:
    return v if isinstance(v, str) else ""


def item_id(item: dict) -> str | None:
    dre = item.get("dre_id")
    if isinstance(dre, str) and dre.strip():
        return dre.strip()
    oid = item.get("_id")
    if isinstance(oid, str) and oid.strip():
        return oid.strip()
    return None


def item_title(item: dict) -> str:
    titles = item.get("titleInfo") or []
    if titles and isinstance(titles[0], dict):
        return _s(titles[0].get("title"))
    return ""


def build_embedding_text(item: dict) -> str:
    """Flatten the metadata blob into a single labelled string for embedding.

    Labelled `Field: value` lines help the model distinguish the role of each
    fragment (title vs. subject vs. contributor), which yields better
    clustering than raw concatenation.
    """
    parts: list[str] = []

    title = item_title(item)
    if title:
        parts.append(f"Title: {title}")
    for t in (item.get("titleInfo") or [])[1:]:
        if isinstance(t, dict):
            tt = _s(t.get("title"))
            if tt and tt != title:
                parts.append(f"Alt title: {tt}")

    abs_val = item.get("abstract")
    abs_str = _s(abs_val) if not isinstance(abs_val, dict) else ""
    if abs_str:
        parts.append(f"Abstract: {abs_str}")

    note_val = item.get("note")
    note_str = _s(note_val) if not isinstance(note_val, dict) else ""
    if note_str:
        parts.append(f"Note: {note_str}")

    subjects: list[str] = []
    for s in item.get("subject") or []:
        if isinstance(s, dict):
            lab = _s(s.get("authLabel")) or _s(s.get("origLabel"))
            if lab:
                subjects.append(lab)
    if subjects:
        parts.append(f"Subjects: {', '.join(subjects)}")

    contribs: list[str] = []
    for n in item.get("name") or []:
        if isinstance(n, dict):
            nm = _s((n.get("name") or {}).get("label"))
            role = _s(n.get("role"))
            if nm:
                contribs.append(f"{nm} ({role})" if role else nm)
    if contribs:
        parts.append(f"Contributors: {'; '.join(contribs)}")

    tags = [_s(t) for t in (item.get("tags") or []) if _s(t)]
    if tags:
        parts.append(f"Tags: {', '.join(tags)}")

    tor = _s(item.get("typeOfResource"))
    if tor:
        parts.append(f"Type of resource: {tor}")

    genres = (item.get("genre") or {}).get("marc") or []
    genre_strs = [_s(g) for g in genres if _s(g)]
    if genre_strs:
        parts.append(f"Genre: {', '.join(genre_strs)}")

    origins = (item.get("location") or {}).get("origin") or []
    origin_strs: list[str] = []
    for o in origins:
        if isinstance(o, dict):
            bits = [_s(o.get("l3")), _s(o.get("l2")), _s(o.get("l1"))]
            bits = [b for b in bits if b]
            if bits:
                origin_strs.append(", ".join(bits))
    if origin_strs:
        parts.append(f"Location: {'; '.join(origin_strs)}")

    langs = [_s(x) for x in (item.get("language") or []) if _s(x)]
    if langs:
        parts.append(f"Language: {', '.join(langs)}")

    audiences = [_s(a) for a in (item.get("targetAudience") or []) if _s(a)]
    if audiences:
        parts.append(f"Audience: {', '.join(audiences)}")

    proj = item.get("project")
    if isinstance(proj, dict):
        pn = _s(proj.get("name"))
        if pn:
            parts.append(f"Project: {pn}")

    phys = item.get("physicalDescription") or {}
    if isinstance(phys, dict):
        for field in ("desc", "note"):
            vals = [_s(v) for v in (phys.get(field) or []) if _s(v)]
            if vals:
                parts.append(f"Physical {field}: {'; '.join(vals)}")

    return "\n".join(parts).strip()


def hash_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def infer_university(path: str) -> str | None:
    # projects_metadata_ubt/... -> "ubt". External collections have no uni.
    parts = Path(path).parts
    for part in parts:
        if part.startswith("projects_metadata_"):
            return part.split("projects_metadata_", 1)[1] or None
    return None


def load_items() -> list[dict]:
    patterns = [
        str(DATA_DIR / "projects_metadata_*" / "*.json"),
        str(DATA_DIR / "external_metadata" / "*.json"),
    ]
    items: list[dict] = []
    file_count = 0
    for pat in patterns:
        for path in sorted(glob(pat)):
            file_count += 1
            with open(path, encoding="utf-8") as h:
                data = json.load(h)
            if not isinstance(data, list):
                continue
            uni = infer_university(path)
            for raw in data:
                normalised = normalise_mongo(raw)
                if isinstance(normalised, dict):
                    if uni and not normalised.get("university"):
                        normalised["university"] = uni
                    items.append(normalised)
    print(f"  loaded {len(items)} items from {file_count} metadata file(s)")
    return items


# ---------------------------------------------------------------------------
# Cache I/O
# ---------------------------------------------------------------------------


def load_cache() -> dict:
    if not CACHE_PATH.exists():
        return {
            "model": MODEL,
            "dims": OUTPUT_DIMS,
            "task": TASK_TYPE,
            "items": {},
        }
    try:
        with open(CACHE_PATH, encoding="utf-8") as h:
            c = json.load(h)
        c.setdefault("items", {})
        return c
    except (OSError, json.JSONDecodeError) as exc:
        print(f"  warning: could not read cache ({exc}); starting fresh")
        return {
            "model": MODEL,
            "dims": OUTPUT_DIMS,
            "task": TASK_TYPE,
            "items": {},
        }


def save_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as h:
        json.dump(obj, h, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Interactive prompt
# ---------------------------------------------------------------------------


def prompt_scope(default: str = "m") -> str:
    prompt = (
        "\nEmbedding scope:\n"
        "  [m] only missing / changed items (default)\n"
        "  [a] ALL items (re-embed everything)\n"
        "Choice [m/a]: "
    )
    if not sys.stdin.isatty():
        print(prompt + default + "  (stdin is not a TTY; using default)")
        return default
    try:
        sys.stdout.write(prompt)
        sys.stdout.flush()
        raw = sys.stdin.readline().strip().lower()
    except EOFError:
        return default
    if raw.startswith("a"):
        return "a"
    return "m"


# ---------------------------------------------------------------------------
# Gemini call with retries
# ---------------------------------------------------------------------------


def embed_batch(client, types, texts: list[str], retries: int = 5) -> list[list[float]]:
    """Call embed_content with exponential-backoff retries on 429/5xx.

    Gemini can transiently 429 when a burst of batches arrives within the same
    minute; a handful of retries with jittered backoff lets the run finish
    without aborting mid-way through a large corpus.
    """
    from google.genai.errors import APIError  # noqa: PLC0415

    delay = 2.0
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            resp = client.models.embed_content(
                model=MODEL,
                contents=texts,
                config=types.EmbedContentConfig(
                    output_dimensionality=OUTPUT_DIMS,
                    task_type=TASK_TYPE,
                ),
            )
            return [list(e.values) for e in resp.embeddings]
        except APIError as exc:
            last_err = exc
            status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
            transient = status in (429, 500, 502, 503, 504)
            if not transient or attempt == retries - 1:
                raise
            print(f"  transient API error ({status}); retrying in {delay:.0f}s")
            time.sleep(delay)
            delay = min(delay * 2, 60)
    assert last_err is not None
    raise last_err


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--scope",
        choices=("missing", "all"),
        default=None,
        help="Skip the interactive prompt. 'missing' embeds only new/changed items.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would happen and exit without calling the API.",
    )
    args = parser.parse_args()

    # Deferred imports so --help works without the venv's heavy deps.
    try:
        import numpy as np
        import umap
        from dotenv import load_dotenv
        from google import genai
        from google.genai import types
    except ImportError as exc:
        print(
            f"Missing dependency: {exc.name}. Install with:\n"
            "    .venv/Scripts/pip install -r scripts/requirements.txt",
            file=sys.stderr,
        )
        return 1

    load_dotenv(PROJECT_ROOT / ".env")
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key and not args.dry_run:
        print(
            "ERROR: GEMINI_API_KEY not set. Add it to .env or the environment.",
            file=sys.stderr,
        )
        return 1

    print(f"Loading research items from {DATA_DIR.relative_to(PROJECT_ROOT)}...")
    items = load_items()
    if not items:
        print("No research items found; aborting.", file=sys.stderr)
        return 1

    # Build the embedding payload per item
    per_item: dict[str, dict] = {}
    for raw in items:
        iid = item_id(raw)
        if not iid:
            continue
        text = build_embedding_text(raw)
        per_item[iid] = {
            "text": text,
            "hash": hash_text(text),
            "input_chars": len(text),
            "title": item_title(raw),
            "project": (raw.get("project") or {}).get("id") or None,
            "project_name": (raw.get("project") or {}).get("name") or None,
            "university": _s(raw.get("university")) or None,
            "typeOfResource": _s(raw.get("typeOfResource")) or None,
        }

    skipped = len(items) - len(per_item)
    if skipped:
        print(f"  warning: {skipped} items had no usable id and were skipped")

    cache = load_cache()
    cache_items: dict = cache.get("items", {})

    same_config = (
        cache.get("model") == MODEL
        and cache.get("dims") == OUTPUT_DIMS
        and cache.get("task") == TASK_TYPE
    )
    if not same_config and cache_items:
        print(
            f"  cache was built with a different model/dims/task "
            f"(cache={cache.get('model')}/{cache.get('dims')}/{cache.get('task')}, "
            f"now={MODEL}/{OUTPUT_DIMS}/{TASK_TYPE}); invalidating cache"
        )
        cache_items = {}
        cache = {
            "model": MODEL,
            "dims": OUTPUT_DIMS,
            "task": TASK_TYPE,
            "items": {},
        }

    scope = args.scope or prompt_scope()
    scope_label = "ALL items (full re-embed)" if scope == "a" or scope == "all" else "missing / changed only"
    print(f"Scope: {scope_label}")

    to_embed: list[str] = []
    if scope in ("a", "all"):
        to_embed = list(per_item.keys())
    else:
        for iid, meta in per_item.items():
            cached = cache_items.get(iid)
            if not cached or cached.get("hash") != meta["hash"]:
                to_embed.append(iid)

    cached_hits = len(per_item) - len(to_embed)
    print(f"  {len(to_embed)} item(s) to embed, {cached_hits} already in cache")

    low_signal_count = sum(1 for m in per_item.values() if m["input_chars"] < LOW_SIGNAL_THRESHOLD)
    print(f"  {low_signal_count} item(s) below {LOW_SIGNAL_THRESHOLD}-char low-signal threshold")

    if args.dry_run:
        print("--dry-run: exiting before any API call.")
        return 0

    if to_embed:
        print(
            f"Calling Gemini (model={MODEL}, dims={OUTPUT_DIMS}, task={TASK_TYPE}, "
            f"batch={BATCH_SIZE}, delay={INTER_BATCH_DELAY_S:.1f}s)..."
        )
        client = genai.Client(api_key=api_key)
        embedded = 0
        batches_since_flush = 0
        run_t0 = time.time()
        try:
            for i in range(0, len(to_embed), BATCH_SIZE):
                chunk_ids = to_embed[i : i + BATCH_SIZE]
                # Prepend the Gemini 2 task prefix to every input. The API also
                # rejects empty strings, so the prefix doubles as a guard against
                # truly-empty metadata blobs.
                chunk_texts = [per_item[iid]["text"] or " " for iid in chunk_ids]
                t0 = time.time()
                vectors = embed_batch(client, types, chunk_texts)
                t1 = time.time()
                for iid, vec in zip(chunk_ids, vectors):
                    meta = per_item[iid]
                    cache_items[iid] = {
                        "hash": meta["hash"],
                        "vec": vec,
                        "input_chars": meta["input_chars"],
                        "low_signal": meta["input_chars"] < LOW_SIGNAL_THRESHOLD,
                        "title": meta["title"],
                        "project": meta["project"],
                        "project_name": meta["project_name"],
                        "university": meta["university"],
                        "typeOfResource": meta["typeOfResource"],
                    }
                embedded += len(chunk_ids)
                batches_since_flush += 1

                # Rolling ETA from average throughput so far
                elapsed = time.time() - run_t0
                rate = embedded / elapsed if elapsed > 0 else 0
                remaining = len(to_embed) - embedded
                eta_s = remaining / rate if rate > 0 else 0
                print(
                    f"  [{embedded}/{len(to_embed)}] batch of {len(chunk_ids)} "
                    f"in {t1 - t0:.1f}s | {rate:.0f} items/s | ETA {eta_s / 60:.1f} min"
                )

                # Persist partial progress so a later 429 / Ctrl-C doesn't
                # throw away the vectors we've already paid for.
                if batches_since_flush >= FLUSH_EVERY_N_BATCHES:
                    cache["model"] = MODEL
                    cache["dims"] = OUTPUT_DIMS
                    cache["task"] = TASK_TYPE
                    cache["items"] = cache_items
                    save_json(CACHE_PATH, cache)
                    batches_since_flush = 0
                    print(f"    (cache flushed, {len(cache_items)} item(s) persisted)")

                # Throttle: sleep the balance of the inter-batch window so
                # we don't steamroll the quota ceiling on preview models.
                batch_elapsed = time.time() - t0
                remaining_delay = INTER_BATCH_DELAY_S - batch_elapsed
                if remaining_delay > 0 and i + BATCH_SIZE < len(to_embed):
                    time.sleep(remaining_delay)
        except KeyboardInterrupt:
            print("\n  interrupted by user; flushing partial cache...")
            cache["items"] = cache_items
            save_json(CACHE_PATH, cache)
            print(f"  partial cache saved ({len(cache_items)} item(s))")
            raise
        except Exception as exc:
            print(f"\n  embedding aborted: {type(exc).__name__}: {exc}")
            print("  flushing partial cache so a rerun can resume...")
            cache["items"] = cache_items
            save_json(CACHE_PATH, cache)
            print(f"  partial cache saved ({len(cache_items)} item(s))")
            raise
    else:
        print("Nothing to embed.")

    # Refresh lightweight metadata fields on cache hits so a metadata-only edit
    # (e.g. a renamed project) propagates without re-embedding the vector.
    for iid, meta in per_item.items():
        entry = cache_items.get(iid)
        if not entry:
            continue
        entry["title"] = meta["title"]
        entry["project"] = meta["project"]
        entry["project_name"] = meta["project_name"]
        entry["university"] = meta["university"]
        entry["typeOfResource"] = meta["typeOfResource"]
        entry["input_chars"] = meta["input_chars"]
        entry["low_signal"] = meta["input_chars"] < LOW_SIGNAL_THRESHOLD

    # Drop cache entries that no longer match any live item
    stale = [iid for iid in list(cache_items) if iid not in per_item]
    for iid in stale:
        del cache_items[iid]
    if stale:
        print(f"  dropped {len(stale)} stale cache entries")

    cache["model"] = MODEL
    cache["dims"] = OUTPUT_DIMS
    cache["task"] = TASK_TYPE
    cache["items"] = cache_items
    save_json(CACHE_PATH, cache)
    size_mb = CACHE_PATH.stat().st_size / 1_048_576
    print(f"Wrote cache -> {CACHE_PATH.relative_to(PROJECT_ROOT)} ({size_mb:.1f} MB)")

    ordered_ids = [iid for iid in per_item if iid in cache_items]
    if not ordered_ids:
        print("No embedded items; cannot build map/similarity outputs.", file=sys.stderr)
        return 1

    X = np.asarray([cache_items[iid]["vec"] for iid in ordered_ids], dtype=np.float32)
    if X.ndim != 2 or X.shape[0] != len(ordered_ids):
        print(f"Embedding matrix shape unexpected: {X.shape}", file=sys.stderr)
        return 1

    print(f"Running UMAP 2D reduction on {X.shape[0]} × {X.shape[1]} matrix...")
    t0 = time.time()
    reducer = umap.UMAP(
        n_neighbors=min(UMAP_NEIGHBORS, max(2, X.shape[0] - 1)),
        min_dist=UMAP_MIN_DIST,
        metric=UMAP_METRIC,
        random_state=UMAP_SEED,
    )
    coords = reducer.fit_transform(X)
    print(f"  UMAP finished in {time.time() - t0:.1f}s")

    map_items = []
    for iid, (x, y) in zip(ordered_ids, coords):
        entry = cache_items[iid]
        map_items.append(
            {
                "id": iid,
                "x": float(x),
                "y": float(y),
                "lowSignal": bool(entry["low_signal"]),
                "inputChars": int(entry["input_chars"]),
                "title": entry["title"],
                "project": entry["project"],
                "projectName": entry["project_name"],
                "university": entry["university"],
                "typeOfResource": entry["typeOfResource"],
            }
        )
    save_json(
        MAP_PATH,
        {
            "model": MODEL,
            "dims": OUTPUT_DIMS,
            "taskType": TASK_TYPE,
            "umap": {
                "nNeighbors": UMAP_NEIGHBORS,
                "minDist": UMAP_MIN_DIST,
                "metric": UMAP_METRIC,
                "seed": UMAP_SEED,
            },
            "lowSignalThreshold": LOW_SIGNAL_THRESHOLD,
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "items": map_items,
        },
    )
    print(f"Wrote map -> {MAP_PATH.relative_to(PROJECT_ROOT)}")

    print(f"Computing top-{SIMILAR_TOP_K} cosine neighbours per item...")
    # Normalise for cosine similarity via a single matmul.
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    Xn = X / norms
    sim = Xn @ Xn.T
    np.fill_diagonal(sim, -1.0)

    k = min(SIMILAR_TOP_K, sim.shape[1] - 1)
    similar: dict[str, list[dict]] = {}
    for i, iid in enumerate(ordered_ids):
        row = sim[i]
        # argpartition then sort the top-k slice only (O(n + k log k)).
        top_idx = np.argpartition(row, -k)[-k:]
        top_idx = top_idx[np.argsort(-row[top_idx])]
        similar[iid] = [
            {"id": ordered_ids[j], "score": float(row[j])} for j in top_idx if row[j] > 0
        ]

    save_json(
        SIMILAR_PATH,
        {
            "model": MODEL,
            "dims": OUTPUT_DIMS,
            "topK": SIMILAR_TOP_K,
            "items": similar,
        },
    )
    print(f"Wrote similar -> {SIMILAR_PATH.relative_to(PROJECT_ROOT)}")
    print("Done.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        sys.exit(130)
