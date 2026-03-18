/**
 * WissKI URL lookup from a pre-computed JSON file.
 *
 * The data pipeline (scripts/generate_wisski_urls.py) generates
 * static/data/dev/dev.wisski_urls.json by querying the GraphDB
 * SPARQL endpoint for owl:sameAs navigate URLs.
 *
 * NOTE: An alternative to pre-computing would be querying the SPARQL
 * endpoint at runtime, but this requires CORS to be enabled on GraphDB.
 * To enable CORS: GraphDB Workbench > Setup > Repositories > Settings,
 * or set graphdb.workbench.cors.enable=true in graphdb.properties.
 * Endpoint: https://lod.wisski.uni-bayreuth.de/repositories/wisski_2024-08-13
 *
 * Lookup file structure:
 * {
 *   "projects":      { "UBT_ArtWorld2019": "https://www.wisski.uni-bayreuth.de/wisski/navigate/46237/view", ... },
 *   "persons":       { "Jane Doe": "...", ... },
 *   "institutions":  { ... },
 *   "groups":        { ... },
 *   "countries":     { ... },
 *   "regions":       { "RegionName|CountryName": "...", ... },
 *   "cities":        { "CityName|ParentName": "...", ... },
 *   "languages":     { "English": "...", ... },
 *   "subjects":      { ... },
 *   "tags":          { ... },
 *   "resourceTypes": { ... },
 *   "researchItems": { "dre_id_value": "...", ... }
 * }
 */

import { loadJSON } from './loaders';

export type WisskiUrlMap = Record<string, Record<string, string>>;

let urlMap: WisskiUrlMap | null = null;
let loadPromise: Promise<void> | null = null;

/**
 * Load the WissKI URL map. Safe to call multiple times — only loads once.
 */
export async function loadWisskiUrls(basePath: string = ''): Promise<void> {
	if (urlMap) return;
	if (loadPromise) return loadPromise;

	loadPromise = (async () => {
		try {
			urlMap = await loadJSON<WisskiUrlMap>(`${basePath}/data/dev/dev.wisski_urls.json`);
		} catch {
			urlMap = null;
		}
	})();

	return loadPromise;
}

/**
 * Look up a WissKI navigate URL.
 */
export function getWisskiUrl(category: string, key: string): string | null {
	return urlMap?.[category]?.[key] ?? null;
}
