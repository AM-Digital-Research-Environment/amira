/**
 * Get a page slice from an array.
 */
export function paginate<T>(items: T[], page: number, perPage: number): T[] {
	return items.slice(page * perPage, (page + 1) * perPage);
}

/**
 * Calculate total number of pages.
 */
export function totalPages(totalItems: number, perPage: number): number {
	return Math.max(1, Math.ceil(totalItems / perPage));
}
