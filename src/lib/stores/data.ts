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
import { loadAllData, loadResearchSections, loadEnrichedLocations } from '$lib/utils/dataLoader';
import { calculateStats } from '$lib/utils/dataTransform';

// Loading state
export const isLoading = writable(true);
export const loadError = writable<string | null>(null);

// Raw data stores
export const projects = writable<Project[]>([]);
export const persons = writable<Person[]>([]);
export const institutions = writable<Institution[]>([]);
export const groups = writable<Group[]>([]);
export const allCollections = writable<CollectionItem[]>([]);
export const researchSections = writable<Record<string, ResearchSectionInfo>>({});
export const enrichedLocations = writable<EnrichedLocationsData | null>(null);

// Legacy stores for backward compatibility (derived from allCollections)
export const artWorldCollection: Readable<CollectionItem[]> = derived(
	allCollections,
	($all) => $all.filter((item) => item.project?.name?.includes('ArtWorld'))
);
export const clnckCollection: Readable<CollectionItem[]> = derived(
	allCollections,
	($all) => $all.filter((item) => item.project?.name?.includes('CLnCK'))
);

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

// Initialize data from JSON files
export async function initializeData(basePath: string = '') {
	isLoading.set(true);
	loadError.set(null);

	try {
		const [data, researchSectionsData, locationsData] = await Promise.all([
			loadAllData(basePath),
			loadResearchSections(basePath),
			loadEnrichedLocations(basePath)
		]);

		projects.set(data.projects);
		persons.set(data.persons);
		institutions.set(data.institutions);
		groups.set(data.groups);
		allCollections.set(data.collections.all);
		researchSections.set(researchSectionsData);
		enrichedLocations.set(locationsData);

		isLoading.set(false);
	} catch (error) {
		console.error('Failed to load data:', error);
		loadError.set(error instanceof Error ? error.message : 'Failed to load data');
		isLoading.set(false);
	}
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
