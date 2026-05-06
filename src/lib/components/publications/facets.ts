/** Helpers for the publications page's filter combo-boxes.
 *
 * The page used to inline a near-identical `$derived.by` block per facet
 * (type, year, language) — each tallying counts in a Map, sorting, and
 * mapping to `{ value, label }`. This module collapses that to a single
 * call per facet plus a typed sort mode.
 *
 * The shape mirrors the `Combobox` / `Select` `{ value, label }` contract
 * so the page can spread the result directly into the options prop.
 */

export interface FacetOption {
	value: string;
	label: string;
}

export interface FacetConfig<T, K extends number | string> {
	/** Reader for the facet key on each item. Null / undefined / empty
	 *  string returns are skipped (no facet bucket created). */
	getKey: (item: T) => K | null | undefined;
	/** Format the option label, e.g. ``Article (42)``. */
	formatLabel: (key: K, count: number) => string;
	/** Format the underlying value (used as `<option value>`). Defaults to
	 *  `String(key)` — override for e.g. namespacing. */
	formatValue?: (key: K) => string;
	/** Sort order. Default ``frequency`` (most common first); ``key-desc``
	 *  (e.g. years 2025 → 2020); ``key-asc`` for ascending key order. */
	sort?: 'frequency' | 'key-desc' | 'key-asc';
}

/** Tally `items` by `getKey` and emit `{ value, label }` options for a
 *  combo-box or `<select>`. Pass the "All" sentinel separately at the
 *  call site — its label often depends on the unfiltered total
 *  (``All types (${allPubs.length})``) so it doesn't fit the facet
 *  contract cleanly. */
export function buildFacetOptions<T, K extends number | string>(
	items: readonly T[],
	config: FacetConfig<T, K>
): FacetOption[] {
	const counts = new Map<K, number>();
	for (const item of items) {
		const key = config.getKey(item);
		if (key === null || key === undefined || key === '') continue;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	const formatValue = config.formatValue ?? ((k: K) => String(k));
	const sort = config.sort ?? 'frequency';

	type Entry = [K, number];
	const sortFn: (a: Entry, b: Entry) => number =
		sort === 'frequency'
			? (a, b) => b[1] - a[1]
			: sort === 'key-desc'
				? (a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0)
				: (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

	return Array.from(counts.entries())
		.sort(sortFn)
		.map(([key, count]) => ({ value: formatValue(key), label: config.formatLabel(key, count) }));
}
