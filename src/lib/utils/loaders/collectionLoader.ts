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
import { EXTERNAL_PROJECTS, EXTERNAL_COLLECTION_TO_PROJECT } from '$lib/utils/external';

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
	external?: Record<string, string[]>;
}

/**
 * Non-cluster metadata databases exported from MongoDB. Items carry
 * `university: 'external'` so they can be included in global totals but
 * excluded from partner-university views. Keyed by folder under static/data/.
 */
export const EXTERNAL_SOURCE_ID = 'external';
const EXTERNAL_FOLDERS = ['external_metadata'];

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
	// Empty is a valid state — e.g. Rhodes has no projects_metadata_rhodes
	// folder because its items arrive via the external_metadata/ILAM
	// pipeline and get tagged `university: 'rhodes'` downstream. Silently
	// return [] rather than warning.
	if (!collectionNames.length) return [];

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
 * Load a single external collection (e.g. external_metadata/ILAM.json).
 * Items are tagged with `university: 'external'` so global stats include them
 * while per-university views filter them out.
 */
async function loadExternalCollection(
	folder: string,
	collectionName: string,
	basePath: string = ''
): Promise<CollectionItem[]> {
	const items = await tryLoadJSON<CollectionItem>(
		`${basePath}/data/${folder}/${folder}.${collectionName}.json`
	);
	// Backfill a project reference for collections whose raw items ship with
	// an empty `project: {}` (ILAM does). Without this, these items would be
	// orphaned from the /projects listing and project-level breakdowns.
	const virtualProject = EXTERNAL_COLLECTION_TO_PROJECT[collectionName];
	// Resolve the hosting university from the virtual project's institutions
	// (e.g. ILAM → Rhodes, BayGlo → Bayreuth). Falls back to EXTERNAL_SOURCE_ID
	// when no known university matches so the filter still surfaces the item.
	const institutions = virtualProject?.institutions ?? [];
	const resolvedUniversity =
		universities.find((u) => institutions.includes(u.name))?.id ?? EXTERNAL_SOURCE_ID;
	return items.map((item) => {
		const hasProjectId = !!item.project?.id;
		const project = hasProjectId
			? item.project
			: virtualProject
				? { id: virtualProject.id, name: virtualProject.name }
				: item.project;
		return { ...item, project, university: resolvedUniversity };
	});
}

/**
 * Load every external collection listed under manifest.external. Falls back to
 * an empty list if the manifest is missing or the `external` key is absent.
 */
export async function loadAllExternalCollections(basePath: string = ''): Promise<CollectionItem[]> {
	const manifest = await loadManifest(basePath);
	const external = manifest?.external ?? {};
	const tasks: Promise<CollectionItem[]>[] = [];
	for (const folder of EXTERNAL_FOLDERS) {
		const names = external[folder] ?? [];
		for (const name of names) {
			tasks.push(loadExternalCollection(folder, name, basePath));
		}
	}
	const results = await Promise.all(tasks);
	return results.flat();
}

/**
 * Load all collection items from all sources (universities + dev + external)
 */
export async function loadAllCollections(basePath: string = ''): Promise<CollectionItem[]> {
	const [universityCollections, devCollections, externalCollections] = await Promise.all([
		loadAllUniversityCollections(basePath),
		loadDevCollections(basePath),
		loadAllExternalCollections(basePath)
	]);
	// Filter out empty/untitled items (no title and no meaningful content)
	const all = [...universityCollections, ...devCollections, ...externalCollections].filter(
		(item) => {
			const hasTitle = item.titleInfo?.some((t) => t.title?.trim());
			const hasType = !!item.typeOfResource?.trim();
			return hasTitle || hasType;
		}
	);
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
	// MongoDB stores the PI list as `pi` (same as on projects); the frontend
	// exposes it as `principalInvestigators` for readability.
	pi?: string[];
	members?: string[];
	spokesperson?: string;
	date?: {
		start?: Date;
		end?: Date;
	};
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
			const { _id, name, pi, members, ...rest } = doc;
			result[name] = {
				...rest,
				principalInvestigators: pi ?? [],
				members: members ?? []
			};
		}
		return result;
	} catch {
		console.warn('Could not load research sections data');
		return {};
	}
}

/**
 * Reconcile MongoDB-backed projects with the hand-maintained EXTERNAL_PROJECTS
 * list (BayGlo, ILAM, etc). Entries that already exist in MongoDB keep their
 * authoritative fields but get `researchSection: ['External']` filled in when
 * empty so the External pseudo-section counts them. Entries missing from
 * MongoDB are appended.
 */
function reconcileExternalProjects(projects: Project[]): Project[] {
	const virtualById = new Map(EXTERNAL_PROJECTS.map((p) => [p.id, p]));
	const reconciled: Project[] = projects.map((p) => {
		const virtual = virtualById.get(p.id);
		if (!virtual) return p;
		return {
			...p,
			researchSection: p.researchSection?.length ? p.researchSection : virtual.researchSection,
			institutions: p.institutions?.length ? p.institutions : virtual.institutions,
			description: p.description?.trim() ? p.description : virtual.description,
			// Force the curated lifespan from EXTERNAL_PROJECTS. The upstream
			// MongoDB records for external collections carry historical
			// CONTENT dates (e.g. ILAM holds material going back to 1013),
			// which when used as a project start date blow out the Gantt
			// axis to a millennium and distort every other section's bar.
			date: virtual.date,
			name: virtual.name
		};
	});
	const existingIds = new Set(reconciled.map((p) => p.id));
	const externalToAppend = EXTERNAL_PROJECTS.filter((p) => !existingIds.has(p.id));
	return [...reconciled, ...externalToAppend];
}

/**
 * Load only the lightweight stores (~500 kB combined) needed for the app
 * shell and the routes that don't depend on collection items.
 *
 * Pairs with `loadAllCollectionsTagged()` which is fired in parallel and
 * resolves the heavier `allCollections` store separately.
 */
export async function loadLightData(basePath: string = '') {
	const [projects, persons, institutions, groups] = await Promise.all([
		loadProjects(basePath),
		loadPersons(basePath),
		loadInstitutions(basePath),
		loadGroups(basePath)
	]);
	return {
		projects: reconcileExternalProjects(projects),
		persons,
		institutions,
		groups
	};
}

/**
 * Tier-2 collections fetch. Just an alias of `loadAllCollections` named to
 * pair with `loadLightData` at the call site in `data.ts`.
 */
export async function loadAllCollectionsTagged(basePath: string = ''): Promise<CollectionItem[]> {
	return loadAllCollections(basePath);
}
