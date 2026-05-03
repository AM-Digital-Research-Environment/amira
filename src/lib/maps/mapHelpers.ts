/**
 * Map helper utilities — marker sizing, coloring, and constants.
 */

import { LOCATION_COLORS, getLocationColor } from '$lib/styles';

/**
 * Map tile style URLs.
 * CartoDB Positron: clean, muted basemap that doesn't compete with data markers.
 */
export const MAP_STYLE = {
	light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
	dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
} as const;

/**
 * @deprecated Use LOCATION_COLORS from '$lib/styles' directly
 */
export const MARKER_COLORS = LOCATION_COLORS;

/** Number of items shown per page in marker popups */
export const ITEMS_PER_PAGE = 5;

/**
 * Calculate marker radius scaled by count relative to the maximum.
 * Uses square-root scaling so area grows linearly with count.
 */
export function getMarkerRadius(count: number, maxCount: number): number {
	const minRadius = 8;
	const maxRadius = 40;
	const scale = Math.sqrt(count / maxCount);
	return minRadius + scale * (maxRadius - minRadius);
}

/**
 * Get the marker color for a given location type.
 * Delegates to the centralized getLocationColor from design tokens.
 */
export function getMarkerColor(type: string): string {
	return getLocationColor(type);
}
