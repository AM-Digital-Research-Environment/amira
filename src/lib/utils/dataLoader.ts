import type {
	Project,
	Person,
	Institution,
	Group,
	CollectionItem,
	MongoOid,
	MongoDate,
	MongoNaN,
	EnrichedLocationsData,
	University,
	WikidataLocation,
	RawGeolocCountry,
	RawGeolocRegion,
	RawGeolocSubregion,
	ResearchSectionInfo
} from '$lib/types';
import { universities } from '$lib/types';

/**
 * Check if a value is a MongoDB NaN representation
 */
function isMongoNaN(value: unknown): value is MongoNaN {
	return (
		typeof value === 'object' &&
		value !== null &&
		'$numberDouble' in value &&
		(value as MongoNaN).$numberDouble === 'NaN'
	);
}

/**
 * Check if a value is a MongoDB ObjectId
 */
function isMongoOid(value: unknown): value is MongoOid {
	return typeof value === 'object' && value !== null && '$oid' in value;
}

/**
 * Check if a value is a MongoDB Date
 */
function isMongoDate(value: unknown): value is MongoDate {
	return typeof value === 'object' && value !== null && '$date' in value;
}

/**
 * Recursively transform MongoDB extended JSON to native JS types
 */
export function transformMongoJSON<T>(data: unknown): T {
	if (data === null || data === undefined) {
		return null as T;
	}

	if (isMongoNaN(data)) {
		return null as T;
	}

	if (isMongoOid(data)) {
		return data.$oid as T;
	}

	if (isMongoDate(data)) {
		return new Date(data.$date) as T;
	}

	if (Array.isArray(data)) {
		return data.map((item) => transformMongoJSON(item)) as T;
	}

	if (typeof data === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(data)) {
			result[key] = transformMongoJSON(value);
		}
		return result as T;
	}

	return data as T;
}

/**
 * Load and parse a JSON file from the static data directory
 */
export async function loadJSON<T>(path: string): Promise<T> {
	const response = await fetch(path);
	if (!response.ok) {
		throw new Error(`Failed to load ${path}: ${response.statusText}`);
	}
	const rawData = await response.json();
	return transformMongoJSON<T>(rawData);
}

/**
 * Try to load a JSON file, return empty array if not found
 */
async function tryLoadJSON<T>(path: string): Promise<T[]> {
	try {
		return await loadJSON<T[]>(path);
	} catch {
		console.warn(`Could not load ${path}`);
		return [];
	}
}

/**
 * Load projects data
 */
export async function loadProjects(basePath: string = ''): Promise<Project[]> {
	return loadJSON<Project[]>(`${basePath}/data/dev/dev.projectsData.json`);
}

/**
 * Load persons data
 */
export async function loadPersons(basePath: string = ''): Promise<Person[]> {
	return loadJSON<Person[]>(`${basePath}/data/dev/dev.persons.json`);
}

/**
 * Load institutions data
 */
export async function loadInstitutions(basePath: string = ''): Promise<Institution[]> {
	return loadJSON<Institution[]>(`${basePath}/data/dev/dev.institutions.json`);
}

/**
 * Load groups data
 */
export async function loadGroups(basePath: string = ''): Promise<Group[]> {
	return loadJSON<Group[]>(`${basePath}/data/dev/dev.groups.json`);
}

/**
 * Load dev collections data
 */
export async function loadDevCollections(basePath: string = ''): Promise<CollectionItem[]> {
	return tryLoadJSON<CollectionItem>(`${basePath}/data/dev/dev.collections.json`);
}

/**
 * University collections configuration
 * Maps university ID to their project file names
 */
export const UNIVERSITY_COLLECTIONS: Record<string, string[]> = {
	ubt: [
		'UBT_ArtWorld2019',
		'UBT_CLnCK2019',
		'UBT_Covid192021',
		'UBT_DigiRet2021',
		'UBT_HDMC2019',
		'UBT_Humanitar2019',
		'UBT_Karakul2019',
		'UBT_LearnClass2019',
		'UBT_MaL2019',
		'UBT_MiConIturi2019',
		'UBT_MoCapIE2021',
		'UBT_MuDAIMa-PRJ2019',
		'UBT_MuDAIMa2019',
		'UBT_MultiALS2021',
		'UBT_OilMov2019',
		'UBT_PEMESWA2021',
		'UBT_Plura2021',
		'UBT_TaiSha2021',
		'UBT_TravKnowl2019',
		'UBT_preDeath2021'
	],
	unilag: [
		'ULG_AfEnt2020',
		'ULG_EthDump2021',
		'ULG_IWCVD2021',
		'ULG_LOI2021',
		'ULG_MFWA2021',
		'ULG_MRC2021',
		'ULG_WOPP2021',
		'ULG_YoruFolk2020'
	],
	ujkz: [
		'UJKZ_FluOnt2023',
		'UJKZ_GLOBHEALTH2020',
		'UJKZ_KnowFranco2021',
		'UJKZ_SEDPaix2022'
	],
	ufba: ['UFB_AfroDigital']
};

/**
 * All UBT collection file names (for backward compatibility)
 */
const UBT_COLLECTIONS = UNIVERSITY_COLLECTIONS.ubt;

/**
 * Load a specific UBT collection by name
 */
export async function loadUBTCollection(
	collectionName: string,
	basePath: string = ''
): Promise<CollectionItem[]> {
	return tryLoadJSON<CollectionItem>(
		`${basePath}/data/projects_metadata_ubt/projects_metadata_ubt.${collectionName}.json`
	);
}

/**
 * Load UBT ArtWorld collection (legacy)
 */
export async function loadArtWorldCollection(basePath: string = ''): Promise<CollectionItem[]> {
	return loadUBTCollection('UBT_ArtWorld2019', basePath);
}

/**
 * Load UBT CLnCK collection (legacy)
 */
export async function loadCLnCKCollection(basePath: string = ''): Promise<CollectionItem[]> {
	return loadUBTCollection('UBT_CLnCK2019', basePath);
}

/**
 * Load all UBT collections
 */
export async function loadAllUBTCollections(basePath: string = ''): Promise<CollectionItem[]> {
	const results = await Promise.all(
		UBT_COLLECTIONS.map((name) => loadUBTCollection(name, basePath))
	);
	return results.flat();
}

/**
 * Load all collection items from all sources (all universities + dev)
 */
export async function loadAllCollections(basePath: string = ''): Promise<CollectionItem[]> {
	const [universityCollections, devCollections] = await Promise.all([
		loadAllUniversityCollections(basePath),
		loadDevCollections(basePath)
	]);
	return [...universityCollections, ...devCollections];
}

/**
 * Get list of available UBT collection names
 */
export function getUBTCollectionNames(): string[] {
	return [...UBT_COLLECTIONS];
}

/**
 * Get all collection names from all universities
 */
export function getAllCollectionNames(): string[] {
	return Object.values(UNIVERSITY_COLLECTIONS).flat();
}

/**
 * Get university by ID
 */
export function getUniversity(universityId: string): University | undefined {
	return universities.find((u) => u.id === universityId);
}

/**
 * Get all universities
 */
export function getUniversities(): University[] {
	return [...universities];
}

/**
 * Get collection names for a university
 */
export function getUniversityCollectionNames(universityId: string): string[] {
	return [...(UNIVERSITY_COLLECTIONS[universityId] || [])];
}

/**
 * Load a specific collection from a university
 */
export async function loadUniversityCollection(
	universityId: string,
	collectionName: string,
	basePath: string = ''
): Promise<CollectionItem[]> {
	const university = getUniversity(universityId);
	if (!university) {
		console.warn(`Unknown university: ${universityId}`);
		return [];
	}

	const items = await tryLoadJSON<CollectionItem>(
		`${basePath}/data/${university.folder}/${university.folder}.${collectionName}.json`
	);

	// Add university field to each item
	return items.map((item) => ({ ...item, university: universityId }));
}

/**
 * Load all collections for a specific university
 */
export async function loadUniversityCollections(
	universityId: string,
	basePath: string = ''
): Promise<CollectionItem[]> {
	const collectionNames = UNIVERSITY_COLLECTIONS[universityId];
	if (!collectionNames) {
		console.warn(`Unknown university: ${universityId}`);
		return [];
	}

	const results = await Promise.all(
		collectionNames.map((name) => loadUniversityCollection(universityId, name, basePath))
	);
	return results.flat();
}

/**
 * Load all collections from all universities
 */
export async function loadAllUniversityCollections(
	basePath: string = ''
): Promise<CollectionItem[]> {
	const results = await Promise.all(
		universities.map((uni) => loadUniversityCollections(uni.id, basePath))
	);
	return results.flat();
}

/**
 * Load manually curated research sections data
 */
export async function loadResearchSections(basePath: string = ''): Promise<Record<string, ResearchSectionInfo>> {
	try {
		const response = await fetch(`${basePath}/data/manual/researchSections.json`);
		if (!response.ok) return {};
		return response.json();
	} catch {
		console.warn('Could not load research sections data');
		return {};
	}
}

/**
 * Load all data for the dashboard
 */
export async function loadAllData(basePath: string = '') {
	const [projects, persons, institutions, groups, allCollections] = await Promise.all([
		loadProjects(basePath),
		loadPersons(basePath),
		loadInstitutions(basePath),
		loadGroups(basePath),
		loadAllCollections(basePath)
	]);

	return {
		projects,
		persons,
		institutions,
		groups,
		collections: {
			all: allCollections
		}
	};
}

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
		const { countryUriToName, regionUriToName } = buildUriToNameMaps(countriesRaw, regionsRaw);

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
