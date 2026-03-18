/**
 * =============================================================================
 * ECHARTS SHARED OPTION BUILDERS
 * =============================================================================
 *
 * Reusable builder functions for common ECharts option configurations.
 * These help reduce code duplication and ensure consistent styling.
 * =============================================================================
 */

import type { EChartsOption } from 'echarts';

/* =============================================================================
   TYPE DEFINITIONS
   ============================================================================= */

export interface TitleOptions {
	left?: 'left' | 'center' | 'right' | number | string;
	top?: number | string;
	textStyle?: {
		fontSize?: number;
		fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number;
	};
}

export interface GridOptions {
	left?: number | string;
	right?: number | string;
	top?: number | string;
	bottom?: number | string;
	containLabel?: boolean;
}

export interface DataZoomOptions {
	start?: number;
	end?: number;
	bottom?: number;
	height?: number;
	showSlider?: boolean;
	showInside?: boolean;
}

/* =============================================================================
   BUILDER FUNCTIONS
   ============================================================================= */

/**
 * Build standardized title configuration
 */
export function buildTitle(
	title?: string,
	options: TitleOptions = {}
): EChartsOption['title'] | undefined {
	if (!title) return undefined;

	return {
		text: title,
		left: options.left ?? 'center',
		top: options.top ?? 0,
		textStyle: options.textStyle
	};
}

/**
 * Build standardized grid configuration for cartesian charts
 */
export function buildGrid(options: GridOptions = {}): EChartsOption['grid'] {
	return {
		left: options.left ?? '3%',
		right: options.right ?? '4%',
		top: options.top ?? '10%',
		bottom: options.bottom ?? '15%',
		containLabel: options.containLabel ?? true
	};
}

/**
 * Build dataZoom configuration for zoom controls
 */
export function buildDataZoom(options: DataZoomOptions = {}): EChartsOption['dataZoom'] {
	const result: EChartsOption['dataZoom'] = [];

	if (options.showSlider !== false) {
		result.push({
			type: 'slider',
			start: options.start ?? 0,
			end: options.end ?? 100,
			bottom: options.bottom ?? 10,
			height: options.height ?? 25
		});
	}

	if (options.showInside) {
		result.push({
			type: 'inside',
			start: options.start ?? 0,
			end: options.end ?? 100
		});
	}

	return result.length > 0 ? result : undefined;
}

/**
 * Hide axes configuration for non-cartesian charts (pie, sunburst, sankey, network)
 */
export function hideAxes(): { xAxis: { show: false }; yAxis: { show: false } } {
	return {
		xAxis: { show: false },
		yAxis: { show: false }
	};
}

