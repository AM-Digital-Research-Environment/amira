import type { EnrichedLocationsData, WikidataLocation } from '$lib/types';
import { DATA_PATHS } from './collectionLoader';
import { fetchJSON } from './fetchHelpers';

/**
 * Slim format produced by scripts/slim_data.py: each location is stored as a
 * compact [lat, lon] tuple keyed by name (or "name|country" for regions and
 * cities). Only locations actually referenced by collection items are kept.
 */
interface SlimGeoFile {
	countries: Record<string, [number, number]>;
	regions: Record<string, [number, number]>;
	cities: Record<string, [number, number]>;
}

function expand(map: Record<string, [number, number]>): Record<string, WikidataLocation> {
	const out: Record<string, WikidataLocation> = {};
	for (const key in map) {
		const tuple = map[key];
		if (Array.isArray(tuple) && tuple.length >= 2) {
			out[key] = { latitude: tuple[0], longitude: tuple[1] };
		}
	}
	return out;
}

/**
 * Load enriched location data from the slim dev.geo.json file.
 *
 * Returns null if the file is missing or unreadable; map components handle
 * that case by hiding markers.
 */
export async function loadEnrichedLocations(
	basePath: string = ''
): Promise<EnrichedLocationsData | null> {
	return fetchJSON<EnrichedLocationsData, SlimGeoFile>(DATA_PATHS.enrichedLocations(basePath), {
		warnLevel: 'always',
		contextLabel: 'dev.geo.json',
		transform: (raw) => ({
			countries: expand(raw.countries || {}),
			regions: expand(raw.regions || {}),
			cities: expand(raw.cities || {})
		})
	});
}
