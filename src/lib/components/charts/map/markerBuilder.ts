/**
 * Marker aggregation logic — builds map markers from raw location data
 * and enriched Wikidata coordinates.
 *
 * Each location row is placed at the most precise level that has coordinates:
 * city → region → country. Items are never double-counted across levels.
 */

import type { EnrichedLocationsData, CollectionItem } from '$lib/types';
import { getItemTitle } from '$lib/utils/formatters';

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
	items: { id: string; title: string; type: string }[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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
		if (
			locationType === 'city' &&
			origin.l3 === locationName &&
			(!country || origin.l1 === country)
		)
			return true;
		if (
			locationType === 'region' &&
			origin.l2 === locationName &&
			(!country || origin.l1 === country)
		)
			return true;
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
 *
 * Each row is placed at the most precise geographic level that has
 * coordinates available: city → region → country.
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

	// For each location row, resolve to the most precise level with coordinates
	for (const d of data) {
		let placed = false;

		// 1. Try city level (most precise)
		if (d.city && d.country) {
			const cityKey = `${d.city}|${d.country}`;
			const cityData = enrichedLocations.cities[cityKey];

			if (cityData?.latitude && cityData?.longitude) {
				const markerId = `city-${cityKey}`;
				const existing = markerMap.get(markerId);

				if (existing) {
					existing.count += d.count;
				} else {
					const matchingItems = items
						.filter((item) => itemMatchesLocation(item, 'city', d.city, d.country))
						.map((item) => ({
							id: item._id || item.dre_id,
							title: getItemTitle(item),
							type: item.typeOfResource || 'Unknown'
						}));

					markerMap.set(markerId, {
						id: markerId,
						name: d.city,
						latitude: cityData.latitude,
						longitude: cityData.longitude,
						count: d.count,
						type: 'city',
						items: matchingItems
					});
				}
				placed = true;
			}
		}

		// 2. Try region level
		if (!placed && d.region && d.country) {
			const regionKey = `${d.region}|${d.country}`;
			const regionData = enrichedLocations.regions[regionKey];

			if (regionData?.latitude && regionData?.longitude) {
				const markerId = `region-${regionKey}`;
				const existing = markerMap.get(markerId);

				if (existing) {
					existing.count += d.count;
				} else {
					const matchingItems = items
						.filter((item) => itemMatchesLocation(item, 'region', d.region, d.country))
						.map((item) => ({
							id: item._id || item.dre_id,
							title: getItemTitle(item),
							type: item.typeOfResource || 'Unknown'
						}));

					markerMap.set(markerId, {
						id: markerId,
						name: d.region,
						latitude: regionData.latitude,
						longitude: regionData.longitude,
						count: d.count,
						type: 'region',
						items: matchingItems
					});
				}
				placed = true;
			}
		}

		// 3. Fall back to country level (least precise)
		if (!placed && d.country) {
			const countryData = enrichedLocations.countries[d.country];

			if (countryData?.latitude && countryData?.longitude) {
				const markerId = `country-${d.country}`;
				const existing = markerMap.get(markerId);

				if (existing) {
					existing.count += d.count;
				} else {
					const matchingItems = items
						.filter((item) => itemMatchesLocation(item, 'country', d.country))
						.map((item) => ({
							id: item._id || item.dre_id,
							title: getItemTitle(item),
							type: item.typeOfResource || 'Unknown'
						}));

					markerMap.set(markerId, {
						id: markerId,
						name: d.country,
						latitude: countryData.latitude,
						longitude: countryData.longitude,
						count: d.count,
						type: 'country',
						items: matchingItems
					});
				}
			}
		}
	}

	return Array.from(markerMap.values());
}
