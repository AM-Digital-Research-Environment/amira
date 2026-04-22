import { getContext, setContext } from 'svelte';
import type { EChartsType } from 'echarts/core';

/**
 * Lets a ChartCard (parent) discover the ECharts instance rendered by a
 * descendant wrapper (EChart.svelte / WordCloud.svelte) so it can offer a
 * download button in its header without every page having to thread the
 * chart instance through by hand.
 *
 * The registry is a plain object held in `$state` — setters and readers
 * share the same reference, so mutating `registry.instance` in the child
 * flows back to the parent's template.
 */
export interface ChartRegistry {
	instance: EChartsType | null;
}

const CHART_REGISTRY_KEY = Symbol('chart-registry');

export function setChartRegistry(registry: ChartRegistry): ChartRegistry {
	setContext(CHART_REGISTRY_KEY, registry);
	return registry;
}

export function getChartRegistry(): ChartRegistry | undefined {
	return getContext<ChartRegistry | undefined>(CHART_REGISTRY_KEY);
}
