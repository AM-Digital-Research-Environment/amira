import { writable, derived, type Readable } from 'svelte/store';
import type {
	Project,
	Person,
	Institution,
	Group,
	CollectionItem,
	DashboardStats,
	University,
	ResearchSectionInfo,
	EnrichedLocationsData,
	PublicationsPayload
} from '$lib/types';
import { universities } from '$lib/types';
import {
	loadLightData,
	loadAllCollectionsTagged,
	loadResearchSections,
	loadEnrichedLocations,
	loadPublications
} from '$lib/utils/loaders';
import { createOnceLoader } from '$lib/utils/loaders/cacheFactory';
import { calculateStats } from '$lib/utils/transforms';

/**
 * Manifest entry written by `scripts/fetch_thumbnails.py`. Maps every unique
 * remote `previewImage` URL to a locally-served WebP thumbnail.
 */
export interface ThumbnailEntry {
	file: string;
	w: number;
	h: number;
}
export type ThumbnailManifest = Record<string, ThumbnailEntry>;
export const thumbnailManifest = writable<ThumbnailManifest | null>(null);

// Loading state. Two tiers:
//   isLoading           — true while the lightweight stores (projects, persons,
//                         institutions, groups, researchSections) are in flight.
//                         Flips false in well under a second on a typical
//                         connection because the combined payload is < 1 MB.
//                         Every route needs these, so `initializeData()` kicks
//                         them off from the layout.
//   collectionsLoading  — true only while `ensureCollections()` is actually
//                         in flight. Entity detail views that read from the
//                         precomputed per-entity JSON leave this `false` and
//                         never trigger the 13 MB load.
export const isLoading = writable(true);
export const collectionsLoading = writable(false);
export const loadError = writable<string | null>(null);

// Raw data stores
export const projects = writable<Project[]>([]);
export const persons = writable<Person[]>([]);
export const institutions = writable<Institution[]>([]);
export const groups = writable<Group[]>([]);
export const allCollections = writable<CollectionItem[]>([]);
export const researchSections = writable<Record<string, ResearchSectionInfo>>({});
export const enrichedLocations = writable<EnrichedLocationsData | null>(null);

// University data interface
export interface UniversityData {
	university: University;
	collections: CollectionItem[];
	count: number;
}

// University-based derived stores
export const universitiesData: Readable<UniversityData[]> = derived(
	allCollections,
	($allCollections) => {
		return universities.map((university) => {
			const collections = $allCollections.filter((item) => item.university === university.id);
			return {
				university,
				collections,
				count: collections.length
			};
		});
	}
);

// Get collections by university ID
export const collectionsByUniversity: Readable<Record<string, CollectionItem[]>> = derived(
	allCollections,
	($allCollections) => {
		const result: Record<string, CollectionItem[]> = {};
		for (const uni of universities) {
			result[uni.id] = $allCollections.filter((item) => item.university === uni.id);
		}
		return result;
	}
);

// University item counts
export const universityItemCounts: Readable<Record<string, number>> = derived(
	collectionsByUniversity,
	($byUniversity) => {
		const result: Record<string, number> = {};
		for (const uni of universities) {
			result[uni.id] = $byUniversity[uni.id]?.length || 0;
		}
		return result;
	}
);

// Dashboard stats derived store
export const dashboardStats: Readable<DashboardStats> = derived(
	[projects, persons, institutions, allCollections],
	([$projects, $persons, $institutions, $allCollections]) =>
		calculateStats($projects, $persons, $institutions, { all: $allCollections })
);

// Initialize data from JSON files.
//
// Tier 1 (awaited): the lightweight stores (~500 kB combined) — projects,
// persons, institutions, groups, researchSections. Flips `isLoading` false
// as soon as these resolve. The shell + any route that doesn't touch the
// full collection dump becomes interactive within a couple hundred ms.
//
// Tier 2 is lazy now: the per-university collection dumps (~13 MB) only
// arrive when a route asks for them via `ensureCollections()`. Entity
// detail pages with precomputed per-entity JSON (see
// `loadEntityDashboard()`) skip Tier 2 entirely and stay on the light
// payload. Routes that genuinely need the full archive (home overview,
// research-items browse, collections, network, whats-new, etc.) opt in
// from onMount.
//
// Enriched geolocation data and per-category WissKI URL maps remain fully
// lazy — they are only fetched by the routes that actually need them.
export async function initializeData(basePath: string = '') {
	isLoading.set(true);
	loadError.set(null);

	// Tiny side-fetch of the local-thumbnail manifest (~30 kB). Written by
	// scripts/fetch_thumbnails.py — maps remote previewImage URLs to local
	// WebP files under static/thumbnails/. If it isn't present (fresh clone
	// before the script runs) we silently leave the store null and photos
	// continue to load from their original remote URLs.
	fetch(`${basePath}/thumbnails/manifest.json`)
		.then((res) => (res.ok ? res.json() : null))
		.then((data) => thumbnailManifest.set(data))
		.catch(() => thumbnailManifest.set(null));

	try {
		const [light, researchSectionsData] = await Promise.all([
			loadLightData(basePath),
			loadResearchSections(basePath)
		]);

		projects.set(light.projects);
		persons.set(light.persons);
		institutions.set(light.institutions);
		groups.set(light.groups);
		researchSections.set(researchSectionsData);

		isLoading.set(false);
	} catch (error) {
		console.error('Failed to load data:', error);
		loadError.set(error instanceof Error ? error.message : 'Failed to load data');
		isLoading.set(false);
	}
}

// --------------------------------------------------------------------------
// Lazy loaders.
// --------------------------------------------------------------------------
// `ensureCollections` is called by routes that actually need every item in
// memory (home overview, research-items browse, collections detail, etc.).
// Entity *detail* views (languages/subjects/people/…) use the precomputed
// per-entity JSON instead and do NOT call this.
//
// Both loaders capture the basePath from their first call. If a later call
// passes a different basePath it is ignored — in practice every caller
// resolves it from the same `$app/paths` import, so this is safe.
let collectionsBasePath = '';
const collectionsLoader = createOnceLoader<void>(async () => {
	collectionsLoading.set(true);
	try {
		const all = await loadAllCollectionsTagged(collectionsBasePath);
		allCollections.set(all);
	} catch (error) {
		console.error('Failed to load collections:', error);
	} finally {
		collectionsLoading.set(false);
	}
});

export function ensureCollections(basePath: string = ''): Promise<void> {
	if (!collectionsLoader.isLoaded()) collectionsBasePath = basePath;
	return collectionsLoader.fetch();
}

// Lazy-loaded geolocation. Routes that render the map call this from onMount;
// it caches the result so multiple consumers share a single fetch.
let geolocBasePath = '';
const geolocLoader = createOnceLoader<void>(async () => {
	const data = await loadEnrichedLocations(geolocBasePath);
	enrichedLocations.set(data);
});

export function ensureEnrichedLocations(basePath: string = ''): Promise<void> {
	if (!geolocLoader.isLoaded()) geolocBasePath = basePath;
	return geolocLoader.fetch();
}

// Lazy-loaded cluster publications (ERef Bayreuth). Only the /publications
// route consumes this today, so we keep it out of the eager light-data
// bundle. ~200 kB JSON; null when the file is absent on a fresh clone.
export const publications = writable<PublicationsPayload | null>(null);
let publicationsBasePath = '';
const publicationsLoader = createOnceLoader<void>(async () => {
	const data = await loadPublications(publicationsBasePath);
	publications.set(data);
});

export function ensurePublications(basePath: string = ''): Promise<void> {
	if (!publicationsLoader.isLoaded()) publicationsBasePath = basePath;
	return publicationsLoader.fetch();
}

// Theme store
function createThemeStore() {
	const { subscribe, set, update } = writable<'light' | 'dark'>('dark');

	return {
		subscribe,
		set,
		toggle: () => {
			let newTheme: 'light' | 'dark';
			update((current) => {
				newTheme = current === 'light' ? 'dark' : 'light';
				return newTheme;
			});
			if (typeof window !== 'undefined') {
				localStorage.setItem('theme', newTheme!);
				document.documentElement.classList.toggle('dark', newTheme! === 'dark');
			}
		},
		init: () => {
			if (typeof window !== 'undefined') {
				const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
				const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
				const initial = stored || (prefersDark ? 'dark' : 'light');
				set(initial);
				document.documentElement.classList.toggle('dark', initial === 'dark');
			}
		},
		setTheme: (theme: 'light' | 'dark') => {
			set(theme);
			if (typeof window !== 'undefined') {
				localStorage.setItem('theme', theme);
				document.documentElement.classList.toggle('dark', theme === 'dark');
			}
		}
	};
}

export const theme = createThemeStore();
