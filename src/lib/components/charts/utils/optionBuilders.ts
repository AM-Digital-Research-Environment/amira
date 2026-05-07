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
	/**
	 * @deprecated ECharts 6 deprecated `containLabel`; pass through is
	 * preserved for the rare caller that still has reason to override
	 * via the legacy `LegacyGridContainLabel` extra. Most callers should
	 * leave this unset and rely on the default `outerBoundsMode: 'auto'`.
	 */
	containLabel?: boolean;
	/**
	 * ECharts 6 replacement for `containLabel`. `'auto'` reserves space
	 * for axis labels just like `containLabel: true` did but without
	 * the legacy import. Defaults to `'auto'` in `buildGrid`.
	 *
	 * Note: ECharts 6 also accepts an `outerBounds` *object* with
	 * `{left, top, right, bottom, width, height}` for fine-grained
	 * control. Passing `outerBounds: 'auto'` instead of `outerBoundsMode`
	 * crashes ECharts (it tries to merge layout fields onto the string).
	 */
	outerBoundsMode?: 'auto' | 'none' | 'same';
}

export interface DataZoomOptions {
	start?: number;
	end?: number;
	bottom?: number;
	height?: number;
	showSlider?: boolean;
	showInside?: boolean;
}

export interface TooltipOptions {
	trigger?: 'axis' | 'item' | 'none';
	axisPointer?: 'shadow' | 'line' | 'cross';
	/** Tooltip content formatter — string template or callback. The callback
	 *  signature is intentionally widened to `(params: unknown) => string` so
	 *  callers can do their own narrowing without fighting ECharts' deeply
	 *  generic `TooltipFormatterCallback<...>` types. */
	formatter?: string | ((params: unknown) => string);
	/** Keep tooltip inside the chart container. Default `true`. */
	confine?: boolean;
	position?: 'top' | 'left' | 'right' | 'bottom';
	triggerOn?: 'mousemove' | 'click' | 'mousemove|click' | 'none';
}

export interface LegendOptions {
	/** Convenience preset for placement. Maps to orient + left/top/bottom. */
	position?: 'top' | 'bottom' | 'left' | 'right';
	data?: string[];
	textStyle?: Record<string, unknown>;
	/** Use a scroll-paginated legend. Default `true`. */
	scroll?: boolean;
	/** Override the position default vertical offset. */
	bottom?: number | string;
	top?: number | string;
}

export interface VisualMapOptions {
	min: number;
	max: number;
	orient?: 'horizontal' | 'vertical';
	/** Where to anchor the legend bar. */
	position?: 'top' | 'bottom' | 'left' | 'right' | 'center-bottom';
	/** Color stops the values map across. */
	colors: string[];
	itemWidth?: number;
	itemHeight?: number;
	textStyle?: Record<string, unknown>;
	calculable?: boolean;
	/** Pixel offset away from the anchor edge. Default `0` for left/right,
	 *  `10` for top/bottom. */
	offset?: number;
}

export interface AxisLabelOptions {
	rotate?: number;
	fontSize?: number;
	width?: number;
	overflow?: 'truncate' | 'breakAll' | 'break' | 'none';
	interval?: number;
	/** Skip labels that would overlap their neighbours. Defaults to ECharts'
	 *  built-in behaviour (off). Setting `true` rescues long timelines where
	 *  rotated labels otherwise smash into each other. */
	hideOverlap?: boolean;
	/** Pixel gap between the axis line and the label baseline. */
	margin?: number;
	/** Base style to spread onto the result (typically a theme `labelStyle`). */
	baseStyle?: Record<string, unknown>;
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
 * Build standardized grid configuration for cartesian charts.
 *
 * `outerBoundsMode: 'auto'` is the ECharts 6 replacement for the
 * deprecated `containLabel: true` — both reserve space for axis
 * labels, but `outerBoundsMode` is the supported path forward and
 * doesn't require the `LegacyGridContainLabel` extra. Callers that
 * still need the legacy behaviour can pass `containLabel: true`
 * explicitly and import `LegacyGridContainLabel` themselves.
 */
export function buildGrid(options: GridOptions = {}): EChartsOption['grid'] {
	const grid: Record<string, unknown> = {
		left: options.left ?? '3%',
		right: options.right ?? '4%',
		top: options.top ?? '10%',
		bottom: options.bottom ?? '15%'
	};
	// Prefer `outerBoundsMode`; fall back to the explicit `containLabel`
	// only when the caller asked for it (older charts don't pass either,
	// so they get the default `outerBoundsMode: 'auto'`).
	if (options.containLabel !== undefined) {
		grid.containLabel = options.containLabel;
	} else {
		grid.outerBoundsMode = options.outerBoundsMode ?? 'auto';
	}
	return grid as EChartsOption['grid'];
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
 * No-op for non-cartesian charts (pie, sunburst, sankey, network,
 * radar, treemap, chord). Returns `{}`.
 *
 * **Why a no-op?** ECharts 6 doesn't render axes for non-cartesian
 * series, so explicitly setting `xAxis: { show: false }` /
 * `yAxis: { show: false }` is redundant — and harmful, because the
 * presence of `xAxis` in the option triggers a "Component xAxis is
 * used but not imported" warning unless the chart also registers
 * `GridComponent`. Non-cartesian charts shouldn't pull in the grid
 * module for a config they don't need.
 *
 * Kept exported (rather than deleted) so the `...hideAxes()` calls
 * across 7 chart components keep working without churn. Future
 * callers can simply omit it.
 */
export function hideAxes(): Record<string, never> {
	return {};
}

/**
 * Build a tooltip with sensible defaults shared across the chart family.
 *
 * Defaults: `confine: true` (keeps the popup inside the container so it
 * doesn't clip the page on small viewports). Pass any other ECharts
 * tooltip option through; this builder is meant to absorb the boilerplate,
 * not to replace the whole config.
 */
export function buildTooltip(options: TooltipOptions = {}): EChartsOption['tooltip'] {
	// Build into a plain Record so we can freely assign optional fields. The
	// final cast back to `EChartsOption['tooltip']` is safe — ECharts treats
	// the tooltip option as a structural shape.
	const tooltip: Record<string, unknown> = {
		confine: options.confine ?? true
	};
	if (options.trigger !== undefined) tooltip.trigger = options.trigger;
	if (options.axisPointer !== undefined) tooltip.axisPointer = { type: options.axisPointer };
	if (options.formatter !== undefined) tooltip.formatter = options.formatter;
	if (options.position !== undefined) tooltip.position = options.position;
	if (options.triggerOn !== undefined) tooltip.triggerOn = options.triggerOn;
	return tooltip as EChartsOption['tooltip'];
}

/**
 * Build a legend with a `position` preset that maps to ECharts `orient` /
 * `left` / `top` / `bottom`. `scroll` is on by default; pass categorical
 * `data` to filter which series the legend covers.
 */
export function buildLegend(options: LegendOptions = {}): EChartsOption['legend'] {
	const { position = 'bottom', scroll = true, data, textStyle, top, bottom } = options;

	const legend: Record<string, unknown> = {};
	if (scroll) legend.type = 'scroll';
	if (data) legend.data = data;
	if (textStyle) legend.textStyle = textStyle;

	switch (position) {
		case 'top':
			legend.orient = 'horizontal';
			legend.left = 'center';
			legend.top = top ?? 0;
			break;
		case 'bottom':
			legend.orient = 'horizontal';
			legend.left = 'center';
			legend.bottom = bottom ?? 0;
			break;
		case 'left':
			legend.orient = 'vertical';
			legend.left = 'left';
			legend.top = top ?? 'middle';
			break;
		case 'right':
			legend.orient = 'vertical';
			legend.right = 0;
			legend.top = top ?? 'middle';
			break;
	}

	return legend as EChartsOption['legend'];
}

/**
 * Build a visualMap (continuous gradient legend) for heatmaps and choropleths.
 *
 * `position` is a convenience preset. For finer control the caller can layer
 * additional ECharts properties via the spread pattern:
 *   `visualMap: { ...buildVisualMap({...}), pieces: [...] }`.
 */
export function buildVisualMap(options: VisualMapOptions): EChartsOption['visualMap'] {
	const {
		min,
		max,
		colors,
		orient = 'horizontal',
		position = orient === 'horizontal' ? 'center-bottom' : 'right',
		itemWidth,
		itemHeight,
		textStyle,
		calculable = true,
		offset
	} = options;

	const visualMap: Record<string, unknown> = {
		min,
		max,
		calculable,
		orient,
		inRange: { color: colors }
	};
	if (itemWidth !== undefined) visualMap.itemWidth = itemWidth;
	if (itemHeight !== undefined) visualMap.itemHeight = itemHeight;
	if (textStyle) visualMap.textStyle = textStyle;

	switch (position) {
		case 'top':
			visualMap.left = 'center';
			visualMap.top = offset ?? 10;
			break;
		case 'bottom':
		case 'center-bottom':
			visualMap.left = 'center';
			visualMap.bottom = offset ?? 10;
			break;
		case 'left':
			visualMap.left = offset ?? 0;
			visualMap.top = 'center';
			break;
		case 'right':
			visualMap.right = offset ?? 0;
			visualMap.top = 'center';
			break;
	}

	return visualMap as EChartsOption['visualMap'];
}

/**
 * Build a cartesian-axis label config that spreads a theme `baseStyle`
 * (typically the `labelStyle` derived from the current theme) and adds the
 * common formatting overrides (`rotate`, `fontSize`, `width`, `overflow`,
 * `interval`).
 */
export function buildAxisLabel(options: AxisLabelOptions = {}): Record<string, unknown> {
	const { baseStyle, rotate, fontSize, width, overflow, interval, hideOverlap, margin } = options;
	const label: Record<string, unknown> = { ...(baseStyle ?? {}) };
	if (rotate !== undefined) label.rotate = rotate;
	if (fontSize !== undefined) label.fontSize = fontSize;
	if (width !== undefined) label.width = width;
	if (overflow !== undefined) label.overflow = overflow;
	if (interval !== undefined) label.interval = interval;
	if (hideOverlap !== undefined) label.hideOverlap = hideOverlap;
	if (margin !== undefined) label.margin = margin;
	return label;
}
