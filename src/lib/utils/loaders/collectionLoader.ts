import type {
	Project,
	Person,
	Institution,
	Group,
	CollectionItem,
	University,
	ResearchSectionInfo
} from '$lib/types';
import { universities } from '$lib/types';
import { loadJSON, tryLoadJSON } from './mongoJSON';

/**
 * Load projects data
 */
async function loadProjects(basePath: string = ''): Promise<Project[]> {
	return loadJSON<Project[]>(`${basePath}/data/dev/dev.projectsData.json`);
}

/**
 * Load persons data
 */
async function loadPersons(basePath: string = ''): Promise<Person[]> {
	return loadJSON<Person[]>(`${basePath}/data/dev/dev.persons.json`);
}

/**
 * Load institutions data
 */
async function loadInstitutions(basePath: string = ''): Promise<Institution[]> {
	return loadJSON<Institution[]>(`${basePath}/data/dev/dev.institutions.json`);
}

/**
 * Load groups data
 */
async function loadGroups(basePath: string = ''): Promise<Group[]> {
	return loadJSON<Group[]>(`${basePath}/data/dev/dev.groups.json`);
}

/**
 * Load dev collections data
 */
async function loadDevCollections(basePath: string = ''): Promise<CollectionItem[]> {
	return tryLoadJSON<CollectionItem>(`${basePath}/data/dev/dev.collections.json`);
}

/**
 * University collections configuration (fallback)
 * Maps university ID to their project file names
 */
export const UNIVERSITY_COLLECTIONS: Record<string, string[]> = {
	ubt: [
		'UBT_ArtWorld2019',
		'UBT_CLnCK2019',
		'UBT_Covid192021',
		'UBT_DigiRet2021',
		'UBT_ELTVTapes2021',
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
		'UJKZ_MiCoViCvd2021',
		'UJKZ_SEDPaix2022',
		'UJKZ_filmBF2022'
	],
	ufba: ['UFB_AfroDigital']
};

/**
 * Manifest structure from manifest.json
 */
interface Manifest {
	generatedAt: string;
	universities: Record<string, string[]>;
}

let manifestCache: Manifest | null = null;

/**
 * Load the auto-generated manifest of collection names
 */
export async function loadManifest(basePath: string = ''): Promise<Manifest | null> {
	if (manifestCache) return manifestCache;
	try {
		const response = await fetch(`${basePath}/data/manifest.json`);
		if (!response.ok) return null;
		manifestCache = await response.json();
		return manifestCache;
	} catch {
		return null;
	}
}

/**
 * Get collection names for a university, trying manifest first then falling back to hardcoded list
 */
async function getCollectionNames(universityId: string, basePath: string = ''): Promise<string[]> {
	const manifest = await loadManifest(basePath);
	if (manifest?.universities[universityId]) {
		return manifest.universities[universityId];
	}
	return UNIVERSITY_COLLECTIONS[universityId] || [];
}

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
 * Get university by ID
 */
function getUniversity(universityId: string): University | undefined {
	return universities.find((u) => u.id === universityId);
}

/**
 * Get all universities
 */
export function getUniversities(): University[] {
	return [...universities];
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
	const collectionNames = await getCollectionNames(universityId, basePath);
	if (!collectionNames.length) {
		console.warn(`No collections found for university: ${universityId}`);
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
 * Load all collection items from all sources (all universities + dev)
 */
export async function loadAllCollections(basePath: string = ''): Promise<CollectionItem[]> {
	const [universityCollections, devCollections] = await Promise.all([
		loadAllUniversityCollections(basePath),
		loadDevCollections(basePath)
	]);
	// Filter out empty/untitled items (no title and no meaningful content)
	const all = [...universityCollections, ...devCollections].filter((item) => {
		const hasTitle = item.titleInfo?.some((t) => t.title?.trim());
		const hasType = !!item.typeOfResource?.trim();
		return hasTitle || hasType;
	});
	// Normalize location origin fields: arrays → first string value
	for (const item of all) {
		item.location?.origin?.forEach((o) => {
			if (Array.isArray(o.l1)) o.l1 = o.l1[0] ?? '';
			if (Array.isArray(o.l2)) o.l2 = o.l2[0] ?? '';
			if (Array.isArray(o.l3)) o.l3 = o.l3[0] ?? '';
		});
	}
	return all;
}

/**
 * Raw research section document from MongoDB
 */
interface RawResearchSection {
	_id: string;
	name: string;
	url: string;
	description: string;
	objectives: string;
	workProgramme: string;
	principalInvestigators: string[];
	members: string[];
}

/**
 * Load research sections data from MongoDB export
 */
export async function loadResearchSections(
	basePath: string = ''
): Promise<Record<string, ResearchSectionInfo>> {
	try {
		const docs = await loadJSON<RawResearchSection[]>(
			`${basePath}/data/dev/dev.researchSections.json`
		);
		const result: Record<string, ResearchSectionInfo> = {};
		for (const doc of docs) {
			const { _id, name, ...info } = doc;
			result[name] = info;
		}
		return result;
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
