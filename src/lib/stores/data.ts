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
	EnrichedLocationsData
} from '$lib/types';
import { universities } from '$lib/types';
import {
	loadLightData,
	loadAllCollectionsTagged,
	loadResearchSections,
	loadEnrichedLocations
} from '$lib/utils/dataLoader';
import { calculateStats } from '$lib/utils/dataTransform';

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
//                         Routes that don't need collections (people,
//                         institutions, groups, project-explorer) become
//                         interactive at this point.
//   collectionsLoading  — true while the per-university collection JSON files
//                         (~13 MB total) are still arriving. Pages that render
//                         collection data show a quieter inline indicator.
export const isLoading = writable(true);
export const collectionsLoading = writable(true);
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

// Initialize data from JSON files in two tiers:
//
//   Tier 1 (awaited): the lightweight stores (~500 kB combined) — projects,
//   persons, institutions, groups, researchSections. Flips `isLoading` false
//   as soon as these resolve. The shell + any route that doesn't depend on
//   collections becomes interactive within a couple hundred ms.
//
//   Tier 2 (background, not awaited): the per-university collection dumps
//   (~13 MB) drive `allCollections`. Until they arrive `collectionsLoading`
//   stays true; collection-heavy pages show their empty state but the rest
//   of the dashboard is already responsive.
//
// Enriched geolocation data and per-category WissKI URL maps remain fully
// lazy — they are only fetched by the routes that actually need them.
export async function initializeData(basePath: string = '') {
	isLoading.set(true);
	collectionsLoading.set(true);
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

	// Tier 2 in parallel — kick it off but don't await. Collection-heavy
	// pages subscribe to `collectionsLoading` to render their own indicator
	// while it's in flight.
	const collectionsPromise = loadAllCollectionsTagged(basePath)
		.then((all) => {
			allCollections.set(all);
		})
		.catch((error) => {
			console.error('Failed to load collections:', error);
			// Don't surface as a fatal error — the shell stays usable on lighter
			// routes even if collections fail.
		})
		.finally(() => {
			collectionsLoading.set(false);
		});

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

	// Returning the in-flight collections promise lets callers (e.g. tests
	// or scripts) await full readiness. The layout deliberately doesn't.
	return collectionsPromise;
}

// Lazy-loaded geolocation. Routes that render the map call this from onMount;
// it caches the result so multiple consumers share a single fetch.
let geolocPromise: Promise<void> | null = null;
export function ensureEnrichedLocations(basePath: string = '') {
	if (geolocPromise) return geolocPromise;
	geolocPromise = (async () => {
		const data = await loadEnrichedLocations(basePath);
		enrichedLocations.set(data);
	})();
	return geolocPromise;
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
