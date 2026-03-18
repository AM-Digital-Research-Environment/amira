/**
 * =============================================================================
 * ECHARTS TOOLTIP FORMATTERS
 * =============================================================================
 *
 * Reusable tooltip formatter functions for common chart patterns.
 * These ensure consistent tooltip presentation across all charts.
 * =============================================================================
 */

/* =============================================================================
   TYPE DEFINITIONS
   ============================================================================= */

interface SimpleParams {
	name: string;
	value: number;
	seriesName?: string;
}

interface StackedParams {
	name: string;
	value: number;
	seriesName: string;
	color: string;
}

interface PathParams {
	name: string;
	value: number;
	treePathInfo?: { name: string }[];
}

interface LinkParams {
	data: {
		source?: string;
		target?: string;
		value?: number;
		name?: string;
	};
}

/* =============================================================================
   FORMATTER FUNCTIONS
   ============================================================================= */

/**
 * Simple formatter with "items" suffix for timeline charts
 */
export function itemCountFormatter(params: unknown): string {
	const p = Array.isArray(params) ? params[0] : params;
	const d = p as SimpleParams;
	return `${d.name}: ${d.value} items`;
}

/**
 * ECharts-native percentage format string for pie charts
 * Use this in option configuration: formatter: '{b}: {c} ({d}%)'
 */
export const PIE_FORMAT_STRING = '{b}: {c} ({d}%)';

/**
 * Stacked series formatter with totals
 * Shows breakdown of all series and total
 */
export function stackedFormatter(params: unknown): string {
	const pArray = params as StackedParams[];
	if (!Array.isArray(pArray) || pArray.length === 0) return '';

	const year = pArray[0].name;
	let total = 0;
	let content = `<strong>${year}</strong><br/>`;

	pArray.forEach((p) => {
		if (p.value > 0) {
			content += `<span style="display:inline-block;margin-right:5px;border-radius:50%;width:10px;height:10px;background-color:${p.color};"></span>${p.seriesName}: ${p.value}<br/>`;
			total += p.value;
		}
	});

	content += `<br/><strong>Total: ${total}</strong>`;
	return content;
}

/**
 * Path formatter for hierarchical data (sunburst, tree)
 * Shows the full path from root to selected node
 */
export function pathFormatter(params: unknown): string {
	const p = params as PathParams;
	const path = p.treePathInfo?.map((n) => n.name).filter((n) => n).join(' → ') || p.name;
	return `${path}<br/>Count: ${p.value}`;
}

/**
 * Link formatter for sankey/network charts
 * Shows source → target: value for links, or node name for nodes
 */
export function linkFormatter(params: unknown): string {
	const p = params as LinkParams;
	if (p.data.source && p.data.target) {
		return `${p.data.source} → ${p.data.target}: ${p.data.value}`;
	}
	return p.data.name || '';
}

/**
 * Network node formatter - just shows node name
 */
export function nodeFormatter(params: unknown): string {
	const p = params as { data: { name: string } };
	return p.data?.name || '';
}
