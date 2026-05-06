import type { Publication } from '$lib/types';

/**
 * Filter values that drive the publications page. The string-typed
 * `'all'` sentinels mirror the Combobox `<option value>` shape so the
 * caller can pass `selectedType` / `selectedYear` / etc. straight
 * through without converting.
 */
export interface PublicationFilters {
	/** ``'all'`` or a specific publication type (e.g. ``'article'``). */
	type: string;
	/** ``'all'`` or a year as a string (e.g. ``'2025'``). */
	year: string;
	/** ``'all'`` or an ISO 639-2/B language code. */
	language: string;
	/** Empty string disables; otherwise exact (case-insensitive) match
	 *  against any keyword. */
	keyword: string;
	/** Free-text query — matched (case-insensitive) against title,
	 *  abstract, journal, booktitle, publisher, DOI, author/editor names,
	 *  and keywords. */
	searchQuery: string;
}

/**
 * Apply the publication filter pipeline. Pure: reads everything from
 * `pubs` and `filters`, returns a new array. The order of the discrete
 * filters (type → year → language → keyword) is incidental — they're
 * all conjunctive — but the search query runs last so it never has to
 * scan items that fell out of an earlier facet.
 */
export function applyPublicationFilters(
	pubs: readonly Publication[],
	filters: PublicationFilters
): Publication[] {
	let items: readonly Publication[] = pubs;

	if (filters.type !== 'all') {
		items = items.filter((p) => p.type === filters.type);
	}
	if (filters.year !== 'all') {
		items = items.filter((p) => String(p.year) === filters.year);
	}
	if (filters.language !== 'all') {
		items = items.filter((p) => p.language === filters.language);
	}
	if (filters.keyword) {
		const kwl = filters.keyword.toLowerCase();
		items = items.filter((p) => p.keywords?.some((k) => k.toLowerCase() === kwl));
	}

	const q = filters.searchQuery.trim().toLowerCase();
	if (q) {
		items = items.filter((p) => {
			if (p.title?.toLowerCase().includes(q)) return true;
			if (p.abstract?.toLowerCase().includes(q)) return true;
			if (p.journal?.toLowerCase().includes(q)) return true;
			if (p.booktitle?.toLowerCase().includes(q)) return true;
			if (p.publisher?.toLowerCase().includes(q)) return true;
			if (p.doi?.toLowerCase().includes(q)) return true;
			const contributors = [...(p.authors ?? []), ...(p.editors ?? [])];
			if (contributors.some((c) => c.normalized.toLowerCase().includes(q))) return true;
			if (p.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
			return false;
		});
	}

	return items as Publication[];
}

/** True when at least one filter is active. Mirrors the page's
 *  ``Clear filters`` button visibility logic. */
export function hasActiveFilters(filters: PublicationFilters): boolean {
	return (
		filters.searchQuery.trim() !== '' ||
		filters.type !== 'all' ||
		filters.year !== 'all' ||
		filters.language !== 'all' ||
		filters.keyword !== ''
	);
}
