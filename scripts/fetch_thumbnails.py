"""
Fetch preview images from remote archives, resize, convert to WebP, and commit
to the repository so the masonry/lightbox can serve thumbnails from the same
origin as the dashboard (GitHub Pages) instead of hitting external hosts on
every page load.

Why this exists
---------------
Remote hosts (journal.ru.ac.za, collections.uni-bayreuth.de, etc.) serve the
original JPEGs at full size — often 500 kB+ per image. Fetching them from the
client is slow and sometimes rate-limited. The masonry renders dozens of
images at once, so cold loads can be painful.

Mitigation: fetch each unique preview image once (locally), downsize to a
thumbnail, convert to WebP, save it under `static/thumbnails/<hash>.webp`,
and emit a manifest mapping original URL → local filename. The frontend then
rewrites `previewImage[0]` through that manifest.

What it does
------------
1. Walks `static/data/projects_metadata_*/*.json` and `static/data/external_metadata/*.json`
   and collects every unique `previewImage[0]` URL.
2. For each URL, computes a stable hash (SHA-1 hex, first 16 chars) used as
   the local filename.
3. Skips URLs that already have a local thumbnail (idempotent — safe to re-run).
4. Downloads the image with a concurrency-limited thread pool.
5. Resizes to a max dimension of 800 px preserving aspect ratio, converts to
   WebP at quality 82.
6. Writes `static/thumbnails/<hash>.webp` and `static/thumbnails/manifest.json`
   mapping original URL → `{ file: "<hash>.webp", w: <int>, h: <int> }`.

Requirements (pin in scripts/requirements.txt before first run):
    pillow>=12.2.0
    requests>=2.33.1  (already present)

Usage:
    python scripts/fetch_thumbnails.py
    python scripts/fetch_thumbnails.py --max-dim 800 --quality 82  # higher fidelity
    python scripts/fetch_thumbnails.py --dry-run                   # report only, fetch nothing
    python scripts/fetch_thumbnails.py --force                     # re-fetch everything

Defaults are tuned for masonry thumbnails (cards render at 150–300 px wide,
so 480 px on the long edge already covers a 2× retina display). Bump
`--max-dim` only if these thumbs need to power the lightbox at desktop sizes.

Notes:
    - Output is deterministic per URL: the same URL always maps to the same
      filename. Safe to include in version control; git will only pick up new
      files on subsequent runs.
    - Set REQUESTS_CA_BUNDLE / HTTPS_PROXY environment variables if your
      network requires them — requests picks these up automatically.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import io
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import requests

try:
    from PIL import Image
except ImportError:
    print(
        "ERROR: Pillow is not installed. Add `pillow>=12.2.0` to "
        "scripts/requirements.txt and run `pip install -r scripts/requirements.txt`.",
        file=sys.stderr,
    )
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "static" / "data"
OUT_DIR = REPO_ROOT / "static" / "thumbnails"
MANIFEST_PATH = OUT_DIR / "manifest.json"
USER_AGENT = "WissKI-Dashboard-ThumbnailBot/1.0 (+https://github.com/AM-Digital-Research-Environment)"


@dataclass(frozen=True)
class FetchResult:
    url: str
    file: str | None
    width: int | None
    height: int | None
    error: str | None


def collect_preview_urls() -> list[str]:
    """Walk all collection JSONs and return unique preview image URLs."""
    seen: set[str] = set()
    for path in sorted(DATA_DIR.rglob("*.json")):
        # Only look at per-university collection dumps + external metadata.
        # dev/*.json is the projects/persons/etc. files — no previewImage there.
        parts = path.relative_to(DATA_DIR).parts
        if not (
            parts[0].startswith("projects_metadata_") or parts[0] == "external_metadata"
        ):
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            print(f"  ! skip {path.name}: {exc}", file=sys.stderr)
            continue
        if not isinstance(data, list):
            continue
        for item in data:
            preview = item.get("previewImage")
            if isinstance(preview, list) and preview:
                first = preview[0]
                if isinstance(first, str) and first.startswith("http"):
                    seen.add(first)
    return sorted(seen)


def url_to_filename(url: str) -> str:
    """Stable short hash of the URL, used as the WebP filename stem."""
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:16] + ".webp"


def load_manifest() -> dict[str, dict]:
    if MANIFEST_PATH.exists():
        try:
            return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def fetch_one(url: str, max_dim: int, quality: int, session: requests.Session) -> FetchResult:
    filename = url_to_filename(url)
    out_path = OUT_DIR / filename
    try:
        resp = session.get(url, timeout=30, headers={"User-Agent": USER_AGENT})
        resp.raise_for_status()
        with Image.open(io.BytesIO(resp.content)) as im:
            im.load()
            # Strip EXIF orientation etc — the WebP encoder doesn't carry it
            # and we don't want to double-rotate on the client.
            im = im.convert("RGB") if im.mode not in ("RGB", "RGBA") else im
            w, h = im.size
            # Downscale only — never upscale small originals.
            if max(w, h) > max_dim:
                im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
                w, h = im.size
            buf = io.BytesIO()
            im.save(buf, format="WEBP", quality=quality, method=6)
            out_path.write_bytes(buf.getvalue())
        return FetchResult(url=url, file=filename, width=w, height=h, error=None)
    except Exception as exc:  # noqa: BLE001
        return FetchResult(url=url, file=None, width=None, height=None, error=str(exc))


def run(max_dim: int, quality: int, workers: int, force: bool, dry_run: bool) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    urls = collect_preview_urls()
    manifest = {} if force else load_manifest()
    todo = [u for u in urls if force or u not in manifest or not (OUT_DIR / manifest[u].get("file", "")).exists()]

    print(f"Collected {len(urls):,} unique preview URLs")
    print(f"Already cached: {len(urls) - len(todo):,}")
    print(f"To fetch:       {len(todo):,}")
    if dry_run:
        for u in todo[:20]:
            print(f"  would fetch: {u}")
        if len(todo) > 20:
            print(f"  … and {len(todo) - 20:,} more")
        return

    if not todo:
        print("Nothing to do. Use --force to re-fetch everything.")
        return

    start = time.time()
    ok = 0
    fail = 0
    session = requests.Session()
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fetch_one, u, max_dim, quality, session): u for u in todo}
        for i, fut in enumerate(concurrent.futures.as_completed(futures), 1):
            result = fut.result()
            if result.error:
                fail += 1
                print(f"  [{i}/{len(todo)}] FAIL {result.url} — {result.error}", file=sys.stderr)
                continue
            manifest[result.url] = {
                "file": result.file,
                "w": result.width,
                "h": result.height,
            }
            ok += 1
            if i % 25 == 0 or i == len(todo):
                print(f"  [{i}/{len(todo)}] ok={ok} fail={fail}")

    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    elapsed = time.time() - start
    total_bytes = sum(p.stat().st_size for p in OUT_DIR.glob("*.webp"))
    print()
    print(f"Done in {elapsed:,.1f}s  ok={ok} fail={fail}")
    print(f"Wrote manifest: {MANIFEST_PATH.relative_to(REPO_ROOT)}")
    print(f"Output dir:     {OUT_DIR.relative_to(REPO_ROOT)}  ({total_bytes/1024/1024:.1f} MB across {len(list(OUT_DIR.glob('*.webp'))):,} files)")


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--max-dim",
        type=int,
        default=480,
        help=(
            "Longest edge in px (default 480 — sized for masonry cards, which "
            "render at 150-300 px wide on retina displays)"
        ),
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=78,
        help="WebP quality 0-100 (default 78 — visually indistinguishable from 90 at thumbnail size)",
    )
    parser.add_argument("--workers", type=int, default=8, help="Concurrent fetchers (default 8)")
    parser.add_argument("--force", action="store_true", help="Re-fetch every URL")
    parser.add_argument("--dry-run", action="store_true", help="Only report what would be fetched")
    args = parser.parse_args(argv)
    run(args.max_dim, args.quality, args.workers, args.force, args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
