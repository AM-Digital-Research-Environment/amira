import type {
	EnrichedLocationsData,
	WikidataLocation,
	RawGeolocCountry,
	RawGeolocRegion,
	RawGeolocSubregion
} from '$lib/types';
import { loadJSON } from './mongoJSON';

/**
 * Extract Wikidata ID from a Wikidata URI
 * e.g., "http://www.wikidata.org/entity/Q16" -> "Q16"
 */
function extractWikidataId(uri: string): string | null {
	const match = uri.match(/entity\/(Q\d+)$/);
	return match ? match[1] : null;
}

/**
 * Transform raw geoloc country to WikidataLocation format
 */
function transformCountry(country: RawGeolocCountry): WikidataLocation {
	return {
		original_name: country.name,
		wikidata_id: extractWikidataId(country.uri),
		wikidata_label: country.name,
		latitude: country.coordinates?.lat ?? null,
		longitude: country.coordinates?.long ?? null,
		country_code: null,
		geonames_id: null,
		description: null,
		match_confidence: 'exact'
	};
}

/**
 * Transform raw geoloc region to WikidataLocation format
 */
function transformRegion(region: RawGeolocRegion): WikidataLocation {
	return {
		original_name: region.name,
		wikidata_id: extractWikidataId(region.uri),
		wikidata_label: region.name,
		latitude: region.coordinates?.latitude ?? null,
		longitude: region.coordinates?.longitude ?? null,
		country_code: null,
		geonames_id: null,
		description: null,
		match_confidence: 'exact'
	};
}

/**
 * Transform raw geoloc subregion (city) to WikidataLocation format
 */
function transformSubregion(subregion: RawGeolocSubregion): WikidataLocation {
	return {
		original_name: subregion.name,
		wikidata_id: extractWikidataId(subregion.uri),
		wikidata_label: subregion.name,
		latitude: subregion.coordinates?.latitude ?? null,
		longitude: subregion.coordinates?.longitude ?? null,
		country_code: null,
		geonames_id: null,
		description: null,
		match_confidence: 'exact'
	};
}

/**
 * Build lookup maps from URI to name for countries and regions
 */
function buildUriToNameMaps(
	countries: RawGeolocCountry[],
	regions: RawGeolocRegion[]
): { countryUriToName: Map<string, string>; regionUriToName: Map<string, string> } {
	const countryUriToName = new Map<string, string>();
	const regionUriToName = new Map<string, string>();

	for (const country of countries) {
		countryUriToName.set(country.uri, country.name);
	}
	for (const region of regions) {
		regionUriToName.set(region.uri, region.name);
	}

	return { countryUriToName, regionUriToName };
}

/**
 * Load enriched location data from pre-reconciled geoloc files
 * Uses dev.geoloc_countries.json, dev.geoloc_regions.json, dev.geoloc_subregions.json
 */
export async function loadEnrichedLocations(
	basePath: string = ''
): Promise<EnrichedLocationsData | null> {
	try {
		const [countriesRaw, regionsRaw, subregionsRaw] = await Promise.all([
			loadJSON<RawGeolocCountry[]>(`${basePath}/data/dev/dev.geoloc_countries.json`),
			loadJSON<RawGeolocRegion[]>(`${basePath}/data/dev/dev.geoloc_regions.json`),
			loadJSON<RawGeolocSubregion[]>(`${basePath}/data/dev/dev.geoloc_subregions.json`)
		]);

		// Build URI to name lookup maps
		const { countryUriToName } = buildUriToNameMaps(countriesRaw, regionsRaw);

		// Transform countries: keyed by name
		const countries: Record<string, WikidataLocation> = {};
		for (const country of countriesRaw) {
			countries[country.name] = transformCountry(country);
		}

		// Transform regions: keyed by "name|country"
		const regions: Record<string, WikidataLocation> = {};
		for (const region of regionsRaw) {
			const countryName = countryUriToName.get(region.country_uri) || '';
			const key = countryName ? `${region.name}|${countryName}` : region.name;
			regions[key] = transformRegion(region);
		}

		// Transform subregions (cities): keyed by "name|country"
		const cities: Record<string, WikidataLocation> = {};
		for (const subregion of subregionsRaw) {
			const countryName = countryUriToName.get(subregion.country_uri) || '';
			const key = countryName ? `${subregion.name}|${countryName}` : subregion.name;
			cities[key] = transformSubregion(subregion);
		}

		return {
			countries,
			regions,
			cities,
			other: {},
			metadata: {
				generated_at: new Date().toISOString(),
				source_files: [
					'dev.geoloc_countries.json',
					'dev.geoloc_regions.json',
					'dev.geoloc_subregions.json'
				],
				total_locations: countriesRaw.length + regionsRaw.length + subregionsRaw.length
			}
		};
	} catch (error) {
		console.warn('Failed to load geoloc data:', error);
		return null;
	}
}
