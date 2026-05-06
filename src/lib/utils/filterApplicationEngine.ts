/**
 * Pure filter pipeline for the dashboard's global `FilterState`.
 *
 * `stores/filters.ts` used to inline this 50-line block inside its
 * `filteredCollections` derived store, mixing reactive plumbing with
 * filter logic. This module owns the logic; the store stays a thin
 * `derived(...)` over `applyFilters(items, state)`.
 *
 * No reactivity in here — strictly `(items, state) → items[]` so it's
 * trivial to unit-test and reusable wherever the same shape applies
 * (e.g. exported reports, server-side rendering).
 */

import type { CollectionItem, FilterState } from '$lib/types';
import {
	extractYear,
	filterByDateRange,
	filterByLanguage,
	filterByResourceType
} from './transforms';

/**
 * Apply the global FilterState pipeline to a collection-item list.
 *
 * Filter order (all conjunctive — items must pass every active facet):
 *
 *   universities → dateRange → resourceTypes → languages → subjects → projects
 *
 * Order matters only for performance (cheap discrete filters first so
 * the more expensive subject/project array scans hit a smaller set);
 * the result is identical regardless of order.
 *
 * `locations` lives in `FilterState` but isn't applied here today —
 * it's reserved for a future location facet on the FilterPanel and
 * the store keeps it in state so the panel UI can read/write it.
 */
export function applyFilters(
	items: readonly CollectionItem[],
	state: FilterState
): CollectionItem[] {
	let result: CollectionItem[] = items as CollectionItem[];

	if (state.universities.length > 0) {
		result = result.filter(
			(item) => item.university && state.universities.includes(item.university)
		);
	}

	if (state.dateRange.start || state.dateRange.end) {
		const startYear = state.dateRange.start ? extractYear(state.dateRange.start) : null;
		const endYear = state.dateRange.end ? extractYear(state.dateRange.end) : null;
		result = filterByDateRange(result, startYear, endYear);
	}

	if (state.resourceTypes.length > 0) {
		result = filterByResourceType(result, state.resourceTypes);
	}

	if (state.languages.length > 0) {
		result = filterByLanguage(result, state.languages);
	}

	if (state.subjects.length > 0) {
		result = result.filter((item) =>
			item.subject?.some((s) => {
				const label = s.authLabel || s.origLabel;
				return label && state.subjects.includes(label);
			})
		);
	}

	if (state.projects.length > 0) {
		result = result.filter((item) => item.project && state.projects.includes(item.project.id));
	}

	return result;
}

/** Count the number of distinct active facets in `state`. The
 *  `dateRange` facet counts once if either bound is set. `locations`
 *  is intentionally ignored (see `applyFilters` rationale). */
export function countActiveFilters(state: FilterState): number {
	let count = 0;
	if (state.universities.length > 0) count++;
	if (state.dateRange.start || state.dateRange.end) count++;
	if (state.resourceTypes.length > 0) count++;
	if (state.languages.length > 0) count++;
	if (state.subjects.length > 0) count++;
	if (state.projects.length > 0) count++;
	return count;
}

/** Empty `FilterState` — handy as a `filters.set(emptyFilterState())`
 *  reset target and as a test fixture. Using a function (not a const)
 *  ensures every caller gets a fresh object and can mutate it freely. */
export function emptyFilterState(): FilterState {
	return {
		dateRange: { start: null, end: null },
		universities: [],
		resourceTypes: [],
		locations: [],
		languages: [],
		subjects: [],
		projects: []
	};
}
