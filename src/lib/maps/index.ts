/**
 * Shared MapLibre infrastructure for the dashboard's map components.
 *
 * - `BaseMapController` — common init / theme-switch / destroy lifecycle.
 * - `MapProjectionToggle.svelte` — Mercator ⇄ globe toggle button.
 * - `mapHelpers.ts` — basemap tile URLs, marker colour / radius helpers.
 * - `markerBuilder.ts` — aggregator that turns `LocationData` rows into
 *   country / region / city pins with per-pin item lists.
 * - `popupBuilder.ts` — HTML popup builder for marker click-throughs.
 */

export { BaseMapController } from './BaseMapController';
export type { BaseMapControllerOptions, MapTheme } from './BaseMapController';
export { default as MapProjectionToggle } from './MapProjectionToggle.svelte';
export {
	MAP_STYLE,
	MARKER_COLORS,
	ITEMS_PER_PAGE,
	getMarkerRadius,
	getMarkerColor
} from './mapHelpers';
export { buildAggregatedMarkers } from './markerBuilder';
export type { LocationData, MarkerData } from './markerBuilder';
export { buildPopupHtml } from './popupBuilder';
