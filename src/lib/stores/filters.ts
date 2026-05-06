import { writable, derived, type Readable } from 'svelte/store';
import type { CollectionItem, FilterState } from '$lib/types';
import { allCollections } from './data';
import {
	applyFilters,
	countActiveFilters,
	emptyFilterState
} from '$lib/utils/filterApplicationEngine';

// Filter state store — pure state. The pipeline lives in
// `utils/filterApplicationEngine.ts`; this module just wires the
// reactivity.
export const filters = writable<FilterState>(emptyFilterState());

/** Reset the filter store to an empty state. */
export function resetFilters() {
	filters.set(emptyFilterState());
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

/** Filtered collections derived store — runs the pure filter pipeline
 *  whenever the source collections or the filter state change. */
export const filteredCollections: Readable<CollectionItem[]> = derived(
	[allCollections, filters],
	([$collections, $filters]) => applyFilters($collections, $filters)
);

/** Number of distinct active facets (used for the FilterPanel badge). */
export const activeFilterCount: Readable<number> = derived(filters, ($filters) =>
	countActiveFilters($filters)
);
