/**
 * Create a text search filter function.
 * Returns a function that filters items by checking if any of the specified
 * fields contain the search query (case-insensitive).
 */
export function createSearchFilter<T>(
	fields: ((item: T) => string | undefined | null)[]
): (items: T[], query: string) => T[] {
	return (items: T[], query: string) => {
		const trimmed = query.trim();
		if (!trimmed) return items;
		const q = trimmed.toLowerCase();
		return items.filter((item) =>
			fields.some((field) => field(item)?.toLowerCase().includes(q))
		);
	};
}
