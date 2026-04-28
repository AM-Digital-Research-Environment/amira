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
import { fetchJSON } from './loaders/fetchHelpers';
import { createLazyLoader } from './loaders/cacheFactory';

export type WisskiCategoryMap = Record<string, string>;

// `reactive: true` so $derived consumers reading the cache below
// (via `getWisskiUrl`) re-run automatically when a new category lands.
let wisskiBasePath: string = base;
const wisskiLoader = createLazyLoader<string, WisskiCategoryMap>(
	async (category) => {
		const data = await fetchJSON<WisskiCategoryMap>(
			`${wisskiBasePath}/data/dev/dev.wisski_urls.${category}.json`
		);
		return data ?? {};
	},
	{ reactive: true }
);

/**
 * Force-load a category file (idempotent). Safe to call from `onMount`.
 */
export function loadWisskiUrls(
	category: string,
	basePath: string = base
): Promise<WisskiCategoryMap | null> {
	wisskiBasePath = basePath;
	return wisskiLoader.fetch(category);
}

/**
 * Reactive lookup: reads from a SvelteMap-backed cache, so callers using
 * this inside a Svelte 5 `$derived` automatically re-run after the
 * category file lands.
 *
 * Returns null if the category file is missing or has not been loaded yet.
 * Callers are expected to kick off `loadWisskiUrls(category)` from onMount.
 */
export function getWisskiUrl(category: string, key: string): string | null {
	return wisskiLoader.get(category)?.[key] ?? null;
}
