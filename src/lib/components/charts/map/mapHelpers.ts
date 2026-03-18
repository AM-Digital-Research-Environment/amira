/**
 * Map helper utilities — marker sizing, coloring, and constants.
 */

import { CHART_COLORS } from '$lib/styles';

/** Color mapping for marker types */
export const MARKER_COLORS = {
	city: CHART_COLORS[0],    // Blue
	country: CHART_COLORS[1], // Emerald
	other: CHART_COLORS[4]    // Purple
} as const;

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
 */
export function getMarkerColor(type: string): string {
	switch (type) {
		case 'city':
			return MARKER_COLORS.city;
		case 'country':
			return MARKER_COLORS.country;
		default:
			return MARKER_COLORS.other;
	}
}
