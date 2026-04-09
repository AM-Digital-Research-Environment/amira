import type { CollectionItem, Project } from '$lib/types';

/**
 * Map research section names to their CSS variable colors
 */
const SECTION_COLOR_MAP: Record<string, string> = {
	Affiliations: 'var(--rs-affiliations)',
	'Arts & Aesthetics': 'var(--rs-arts-aesthetics)',
	Knowledges: 'var(--rs-knowledges)',
	Learning: 'var(--rs-learning)',
	Mobilities: 'var(--rs-mobilities)',
	Moralities: 'var(--rs-moralities)'
};

export function getSectionColor(sectionName: string): string {
	return SECTION_COLOR_MAP[sectionName]
		? `hsl(${SECTION_COLOR_MAP[sectionName]})`
		: 'hsl(var(--muted-foreground))';
}

export function getSectionColorHsl(sectionName: string): string {
	return SECTION_COLOR_MAP[sectionName] ?? 'var(--muted-foreground)';
}

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
