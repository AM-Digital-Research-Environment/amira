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
	Moralities: 'var(--rs-moralities)',
	External: 'var(--rs-external)'
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
 * Resolve the section's CSS-variable colour to a literal `hsl(...)` string
 * with the variable substituted in. ECharts renders to a canvas and cannot
 * read CSS variables, so we have to hand it computed values when we want a
 * series painted in section-brand colours. SSR returns the variable form
 * unchanged so server-rendered HTML keeps a valid CSS value.
 */
export function getSectionColorResolved(sectionName: string): string {
	const token = SECTION_COLOR_MAP[sectionName];
	if (!token) return 'hsl(var(--muted-foreground))';
	if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') {
		return `hsl(${token})`;
	}
	// Strip the `var(--...)` wrapper so we can read the underlying token.
	const match = token.match(/^var\((--[a-zA-Z0-9-]+)\)$/);
	if (!match) return `hsl(${token})`;
	const root = document.documentElement;
	let value = getComputedStyle(root).getPropertyValue(match[1]).trim();
	// Section tokens are aliases for chart tokens (e.g. `--rs-affiliations:
	// var(--chart-6)`), so we may need to chase one indirection.
	const inner = value.match(/^var\((--[a-zA-Z0-9-]+)\)$/);
	if (inner) {
		value = getComputedStyle(root).getPropertyValue(inner[1]).trim();
	}
	if (!value) return `hsl(${token})`;
	// Tokens are stored as raw HSL components ("174 52% 38%"); wrap them.
	return value.includes('%') && !value.includes('hsl') ? `hsl(${value})` : value;
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
