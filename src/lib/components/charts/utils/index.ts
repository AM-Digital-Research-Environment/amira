/**
 * =============================================================================
 * ECHARTS UTILITIES — BARREL EXPORT
 * =============================================================================
 *
 * Central export for all shared chart utilities.
 * Import from this file for convenient access to all utilities.
 *
 * Usage:
 * import { buildTitle, hideAxes, itemCountFormatter } from './utils';
 * =============================================================================
 */

// Option builders
export {
	buildTitle,
	buildGrid,
	buildDataZoom,
	hideAxes,
	type TitleOptions,
	type GridOptions,
	type DataZoomOptions
} from './optionBuilders';

// Tooltip formatters
export {
	itemCountFormatter,
	stackedFormatter,
	pathFormatter,
	linkFormatter,
	nodeFormatter,
	PIE_FORMAT_STRING
} from './formatters';
