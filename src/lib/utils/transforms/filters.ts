import type { CollectionItem, Person, Project, DashboardStats } from '$lib/types';
import { extractItemYear } from './dates';
import { normalizeLanguageCode } from '$lib/utils/languages';

/**
 * Calculate dashboard statistics
 */
export function calculateStats(
	projects: Project[],
	persons: Person[],
	institutions: { _id: string; name: string }[],
	collections: { all: CollectionItem[] }
): DashboardStats {
	// Count collections by project for breakdown
	const projectCounts = new Map<string, number>();
	collections.all.forEach((item) => {
		const projectName = item.project?.name || 'Unknown';
		projectCounts.set(projectName, (projectCounts.get(projectName) || 0) + 1);
	});

	return {
		totalProjects: projects.length,
		totalPersons: persons.length,
		totalDocuments: collections.all.length,
		totalInstitutions: institutions.length,
		collectionCounts: Object.fromEntries(projectCounts)
	};
}

/**
 * Filter collection items by date range
 */
export function filterByDateRange(
	items: CollectionItem[],
	startYear: number | null,
	endYear: number | null
): CollectionItem[] {
	if (!startYear && !endYear) return items;

	return items.filter((item) => {
		const year = extractItemYear(item);
		if (!year) return true; // Include items without dates

		if (startYear && year < startYear) return false;
		if (endYear && year > endYear) return false;
		return true;
	});
}

/**
 * Filter collection items by resource type
 */
export function filterByResourceType(items: CollectionItem[], types: string[]): CollectionItem[] {
	if (!types.length) return items;
	return items.filter((item) => types.includes(item.typeOfResource));
}

/**
 * Filter collection items by language
 */
export function filterByLanguage(items: CollectionItem[], languages: string[]): CollectionItem[] {
	if (!languages.length) return items;
	return items.filter((item) =>
		item.language?.some((lang) => languages.includes(normalizeLanguageCode(lang)))
	);
}

/**
 * Get unique values from collection items
 */
export function getUniqueResourceTypes(items: CollectionItem[]): string[] {
	const types = new Set<string>();
	items.forEach((item) => {
		if (item.typeOfResource) types.add(item.typeOfResource);
	});
	return Array.from(types).sort();
}

export function getUniqueLanguages(items: CollectionItem[]): string[] {
	const languages = new Set<string>();
	items.forEach((item) => {
		item.language?.forEach((lang) => languages.add(normalizeLanguageCode(lang)));
	});
	return Array.from(languages).sort();
}

export function getUniqueSubjects(items: CollectionItem[]): string[] {
	const subjects = new Set<string>();
	items.forEach((item) => {
		item.subject?.forEach((s) => {
			const label = s.authLabel || s.origLabel;
			if (label) subjects.add(label);
		});
	});
	return Array.from(subjects).sort();
}
