import type { CollectionItem, Project } from '$lib/types';

/**
 * Format a date for display, returning 'N/A' for null/invalid dates
 */
export function formatDate(date: Date | null): string {
	if (!date) return 'N/A';
	const d = date instanceof Date ? date : new Date(date);
	if (isNaN(d.getTime())) return 'N/A';
	return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Get the display title for a collection item
 */
export function getItemTitle(item: CollectionItem): string {
	return item.titleInfo?.[0]?.title || 'Untitled';
}

/**
 * Get the display title for a project
 */
export function getProjectTitle(project: Project): string {
	return project.name || project.idShort || 'Untitled';
}
