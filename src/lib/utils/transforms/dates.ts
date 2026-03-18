import type { CollectionItem } from '$lib/types';

/**
 * Extract year from various date formats
 */
export function extractYear(date: Date | string | null | undefined): number | null {
	if (!date) return null;
	const d = date instanceof Date ? date : new Date(date);
	if (isNaN(d.getTime())) return null;
	return d.getFullYear();
}

/**
 * Extract year from a collection item's dateInfo, checking all possible date fields
 * Priority: issue.start > issue.end > creation.start > creation.end > created.start > created.end
 */
export function extractItemYear(item: CollectionItem): number | null {
	const dateInfo = item.dateInfo as Record<string, { start?: unknown; end?: unknown }> | undefined;
	if (!dateInfo) return null;

	// Try each date category in order of preference
	const categories = ['issue', 'creation', 'created'];

	for (const category of categories) {
		const dateCategory = dateInfo[category];
		if (dateCategory) {
			// Try start date first, then end date
			let year = extractYear(dateCategory.start as Date | string | null);
			if (year) return year;

			year = extractYear(dateCategory.end as Date | string | null);
			if (year) return year;
		}
	}

	return null;
}
