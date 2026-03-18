import { writable, derived, type Readable } from 'svelte/store';
import type { FilterState, CollectionItem } from '$lib/types';
import { allCollections } from './data';
import {
	filterByDateRange,
	filterByResourceType,
	filterByLanguage,
	extractYear
} from '$lib/utils/dataTransform';

// Filter state store
export const filters = writable<FilterState>({
	dateRange: {
		start: null,
		end: null
	},
	universities: [],
	resourceTypes: [],
	locations: [],
	languages: [],
	subjects: [],
	projects: []
});

// Reset filters
export function resetFilters() {
	filters.set({
		dateRange: { start: null, end: null },
		universities: [],
		resourceTypes: [],
		locations: [],
		languages: [],
		subjects: [],
		projects: []
	});
}

export function toggleResourceType(type: string) {
	filters.update((f) => {
		const types = f.resourceTypes.includes(type)
			? f.resourceTypes.filter((t) => t !== type)
			: [...f.resourceTypes, type];
		return { ...f, resourceTypes: types };
	});
}

export function toggleLanguage(lang: string) {
	filters.update((f) => {
		const languages = f.languages.includes(lang)
			? f.languages.filter((l) => l !== lang)
			: [...f.languages, lang];
		return { ...f, languages };
	});
}

export function toggleUniversity(uni: string) {
	filters.update((f) => {
		const universities = f.universities.includes(uni)
			? f.universities.filter((u) => u !== uni)
			: [...f.universities, uni];
		return { ...f, universities };
	});
}

// Filtered collections derived store
export const filteredCollections: Readable<CollectionItem[]> = derived(
	[allCollections, filters],
	([$collections, $filters]) => {
		let result = $collections;

		// Apply university filter
		if ($filters.universities.length > 0) {
			result = result.filter(
				(item) => item.university && $filters.universities.includes(item.university)
			);
		}

		// Apply date range filter
		if ($filters.dateRange.start || $filters.dateRange.end) {
			const startYear = $filters.dateRange.start
				? extractYear($filters.dateRange.start)
				: null;
			const endYear = $filters.dateRange.end ? extractYear($filters.dateRange.end) : null;
			result = filterByDateRange(result, startYear, endYear);
		}

		// Apply resource type filter
		if ($filters.resourceTypes.length > 0) {
			result = filterByResourceType(result, $filters.resourceTypes);
		}

		// Apply language filter
		if ($filters.languages.length > 0) {
			result = filterByLanguage(result, $filters.languages);
		}

		// Apply subject filter
		if ($filters.subjects.length > 0) {
			result = result.filter((item) =>
				item.subject?.some((s) => {
					const label = s.authLabel || s.origLabel;
					return label && $filters.subjects.includes(label);
				})
			);
		}

		// Apply project filter
		if ($filters.projects.length > 0) {
			result = result.filter((item) => item.project && $filters.projects.includes(item.project.id));
		}

		return result;
	}
);

// Active filter count
export const activeFilterCount: Readable<number> = derived(filters, ($filters) => {
	let count = 0;
	if ($filters.universities.length > 0) count++;
	if ($filters.dateRange.start || $filters.dateRange.end) count++;
	if ($filters.resourceTypes.length > 0) count++;
	if ($filters.languages.length > 0) count++;
	if ($filters.subjects.length > 0) count++;
	if ($filters.projects.length > 0) count++;
	return count;
});
