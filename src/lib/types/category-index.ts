import type { CollectionItem } from './collection';

/**
 * Generic type for category-indexed data used by index pages
 * (genres, languages, resource-types, subjects, locations, etc.)
 */
export interface CategoryEntry {
	name: string;
	count: number;
	items: CollectionItem[];
}
