/**
 * WissKI URL lookup with per-category lazy loading.
 *
 * The data pipeline (scripts/generate_wisski_urls.py + scripts/slim_data.py)
 * splits dev.wisski_urls.json into one file per category, e.g.
 *
 *   static/data/dev/dev.wisski_urls.persons.json
 *   static/data/dev/dev.wisski_urls.projects.json
 *   ...
 *
 * Each file is a flat `{ key: navigateUrl }` map. Pages only need to download
 * the categories they actually render, which avoids the multi-megabyte global
 * blob the dashboard used to fetch on every navigation.
 */

import { base } from '$app/paths';
import { SvelteMap } from 'svelte/reactivity';

export type WisskiCategoryMap = Record<string, string>;

// SvelteMap so $derived consumers in components automatically re-run when a
// new category lands. inflight is a plain Map — its mutations are not what
// drives reactivity.
const cache: SvelteMap<string, WisskiCategoryMap> = new SvelteMap();
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const inflight: Map<string, Promise<WisskiCategoryMap | null>> = new Map();

/**
 * Force-load a category file (idempotent). Safe to call from `onMount`.
 */
export async function loadWisskiUrls(
	category: string,
	basePath: string = base
): Promise<WisskiCategoryMap | null> {
	const cached = cache.get(category);
	if (cached) return cached;
	const pending = inflight.get(category);
	if (pending) return pending;

	const promise = (async () => {
		try {
			const response = await fetch(`${basePath}/data/dev/dev.wisski_urls.${category}.json`);
			if (!response.ok) {
				cache.set(category, {});
				return cache.get(category)!;
			}
			const data = (await response.json()) as WisskiCategoryMap;
			cache.set(category, data || {});
			return cache.get(category)!;
		} catch {
			cache.set(category, {});
			return cache.get(category)!;
		} finally {
			inflight.delete(category);
		}
	})();

	inflight.set(category, promise);
	return promise;
}

/**
 * Reactive lookup: reads `cache` (a SvelteMap), so callers using this inside
 * a Svelte 5 `$derived` automatically re-run after the category file lands.
 *
 * Returns null if the category file is missing or has not been loaded yet.
 * Callers are expected to kick off `loadWisskiUrls(category)` from onMount.
 */
export function getWisskiUrl(category: string, key: string): string | null {
	return cache.get(category)?.[key] ?? null;
}
