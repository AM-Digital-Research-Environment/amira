/**
 * Marker aggregation logic — builds map markers from raw location data
 * and enriched Wikidata coordinates.
 */

import type { EnrichedLocationsData, CollectionItem } from '$lib/types';

/** Shape of the location data rows fed into the map */
export interface LocationData {
	country: string;
	region: string;
	city: string;
	count: number;
}

/** A fully-resolved marker ready for rendering on the map */
export interface MarkerData {
	id: string;
	name: string;
	latitude: number;
	longitude: number;
	count: number;
	type: 'country' | 'region' | 'city' | 'other';
	wikidataId?: string;
	items: { id: string; title: string; type: string }[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Extract a display title from a collection item */
function getItemTitle(item: CollectionItem): string {
	return item.titleInfo?.[0]?.title || 'Untitled';
}

/** Check whether a collection item is associated with a given location */
function itemMatchesLocation(
	item: CollectionItem,
	locationType: string,
	locationName: string,
	country?: string
): boolean {
	const origins = item.location?.origin || [];
	const current = item.location?.current || [];

	for (const origin of origins) {
		if (locationType === 'country' && origin.l1 === locationName) return true;
		if (locationType === 'city' && origin.l3 === locationName && (!country || origin.l1 === country)) return true;
		if (locationType === 'region' && origin.l2 === locationName && (!country || origin.l1 === country)) return true;
	}

	if (locationType === 'other') {
		return current.includes(locationName);
	}

	return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Aggregate location data rows into map markers by combining them with
 * enriched Wikidata coordinate data and matching collection items.
 */
export function buildAggregatedMarkers(
	data: LocationData[],
	items: CollectionItem[],
	enrichedLocations: EnrichedLocationsData | null
): MarkerData[] {
	if (!enrichedLocations) {
		return [];
	}

	const markerMap = new Map<string, MarkerData>();

	// Aggregate counts by location
	const countryCounts = new Map<string, number>();
	const cityCounts = new Map<string, number>();

	data.forEach((d) => {
		if (d.country) {
			countryCounts.set(d.country, (countryCounts.get(d.country) || 0) + d.count);
		}
		if (d.city && d.country) {
			const key = `${d.city}|${d.country}`;
			cityCounts.set(key, (cityCounts.get(key) || 0) + d.count);
		}
	});

	// Add city markers (more specific)
	cityCounts.forEach((count, key) => {
		const cityData = enrichedLocations.cities[key];
		if (cityData?.latitude && cityData?.longitude) {
			const [cityName, countryName] = key.split('|');
			const matchingItems = items
				.filter(item => itemMatchesLocation(item, 'city', cityName, countryName))
				.map(item => ({ id: item._id || item.dre_id, title: getItemTitle(item), type: item.typeOfResource || 'Unknown' }));

			const markerId = `city-${key}`;
			markerMap.set(markerId, {
				id: markerId,
				name: cityData.wikidata_label || cityName,
				latitude: cityData.latitude,
				longitude: cityData.longitude,
				count,
				type: 'city',
				wikidataId: cityData.wikidata_id || undefined,
				items: matchingItems
			});
		}
	});

	// Add country markers
	countryCounts.forEach((count, country) => {
		const hasCities = Array.from(cityCounts.keys()).some((key) => key.endsWith(`|${country}`));
		const countryData = enrichedLocations.countries[country];

		if (countryData?.latitude && countryData?.longitude) {
			const adjustedCount = hasCities ? Math.ceil(count * 0.3) : count;
			const matchingItems = items
				.filter(item => itemMatchesLocation(item, 'country', country))
				.map(item => ({ id: item._id || item.dre_id, title: getItemTitle(item), type: item.typeOfResource || 'Unknown' }));

			const markerId = `country-${country}`;
			markerMap.set(markerId, {
				id: markerId,
				name: countryData.wikidata_label || country,
				latitude: countryData.latitude,
				longitude: countryData.longitude,
				count: adjustedCount,
				type: 'country',
				wikidataId: countryData.wikidata_id || undefined,
				items: matchingItems
			});
		}
	});

	// Also check "other" locations (current locations)
	data.forEach((d) => {
		const currentLoc = enrichedLocations.other[d.city] || enrichedLocations.other[d.country];
		if (currentLoc?.latitude && currentLoc?.longitude) {
			const markerId = `other-${currentLoc.original_name}`;
			if (!markerMap.has(markerId)) {
				const matchingItems = items
					.filter(item => itemMatchesLocation(item, 'other', currentLoc.original_name))
					.map(item => ({ id: item._id || item.dre_id, title: getItemTitle(item), type: item.typeOfResource || 'Unknown' }));

				markerMap.set(markerId, {
					id: markerId,
					name: currentLoc.wikidata_label || currentLoc.original_name,
					latitude: currentLoc.latitude,
					longitude: currentLoc.longitude,
					count: d.count,
					type: 'other',
					wikidataId: currentLoc.wikidata_id || undefined,
					items: matchingItems
				});
			}
		}
	});

	return Array.from(markerMap.values());
}
