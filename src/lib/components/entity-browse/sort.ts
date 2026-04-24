import type { EntitySort } from './EntityToolbar.svelte';

interface Sortable {
	name: string;
	count: number;
}

/**
 * Sort entity entries by the toolbar's current sort selector. Returns a new
 * array — does not mutate the input.
 */
export function applyEntitySort<T extends Sortable>(items: T[], sort: EntitySort): T[] {
	const copy = items.slice();
	switch (sort) {
		case 'count-desc':
			return copy.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
		case 'count-asc':
			return copy.sort((a, b) => a.count - b.count || a.name.localeCompare(b.name));
		case 'name-asc':
			return copy.sort((a, b) => a.name.localeCompare(b.name));
		case 'name-desc':
			return copy.sort((a, b) => b.name.localeCompare(a.name));
	}
}
