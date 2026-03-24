import type { CollectionItem, CategoryEntry } from '$lib/types';

/**
 * Build a Map<string, CategoryEntry> from collection items using an extractor function.
 * The extractor returns an array of category labels for each item.
 */
export function buildCategoryIndex(
	items: CollectionItem[],
	extractor: (item: CollectionItem) => string[]
): Map<string, CategoryEntry> {
	const map = new Map<string, CategoryEntry>();
	for (const item of items) {
		for (const label of extractor(item)) {
			if (!label) continue;
			let entry = map.get(label);
			if (!entry) {
				entry = { name: label, count: 0, items: [] };
				map.set(label, entry);
			}
			entry.count++;
			entry.items.push(item);
		}
	}
	return map;
}

/**
 * Convert a category map to a sorted array (descending by count).
 */
export function sortedCategoryList(map: Map<string, CategoryEntry>): CategoryEntry[] {
	return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/**
 * Convert category entries to chart-ready data.
 */
export function categoryToChartData(
	entries: CategoryEntry[],
	limit?: number
): { name: string; value: number }[] {
	const slice = limit ? entries.slice(0, limit) : entries;
	return slice.map((e) => ({ name: e.name, value: e.count }));
}
