<script lang="ts">
	import EChart from './EChart.svelte';
	import type { EChartsOption } from 'echarts';
	import type { NetworkData } from '$lib/types';
	import { cn } from '$lib/utils/cn';
	import { CHART_COLORS, THEME_COLORS } from '$lib/styles';
	import { theme } from '$lib/stores/data';
	import { buildTitle, hideAxes, nodeFormatter } from './utils';

	interface Props {
		data: NetworkData;
		title?: string;
		class?: string;
		onclick?: (id: string, category: number) => void;
		forceConfig?: {
			repulsion?: number;
			gravity?: number;
			edgeLength?: [number, number];
			friction?: number;
			layoutAnimation?: boolean;
		};
	}

	let { data, title = '', class: className = '', onclick, forceConfig }: Props = $props();

	function graphTooltipFormatter(params: Record<string, unknown>): string {
		if (params.dataType === 'edge') {
			const d = params.data as { source: string; target: string; label?: string };
			if (d?.label) return `<span style="font-style:italic">${d.label}</span>`;
			return '';
		}
		// Node tooltip: show category + name
		const d = params.data as { name?: string; category?: number };
		const name = d?.name || (params.name as string) || '';
		const catIdx = d?.category ?? -1;
		const catName =
			catIdx >= 0 && catIdx < data.categories.length ? data.categories[catIdx].name : '';
		if (catName) return `<b>${catName}</b><br/>${name}`;
		return name;
	}

	let isDark = $derived($theme === 'dark');
	let labelColor = $derived(isDark ? THEME_COLORS.dark.chartText : THEME_COLORS.light.chartText);
	let legendColor = $derived(
		isDark ? THEME_COLORS.dark.chartTextMuted : THEME_COLORS.light.chartTextMuted
	);

	let option: EChartsOption = $derived({
		...buildTitle(title),
		tooltip: {
			confine: true,
			trigger: 'item',
			formatter: graphTooltipFormatter as unknown as string
		},
		...hideAxes(),
		legend: {
			data: data.categories.map((c) => c.name),
			orient: 'vertical',
			left: 'left',
			top: 'middle',
			textStyle: { color: legendColor }
		},
		animationDuration: 1500,
		animationEasingUpdate: 'quinticInOut',
		series: [
			{
				name: 'Network',
				type: 'graph',
				layout: 'force',
				data: data.nodes.map((node) => ({
					...node,
					itemStyle: {
						color: CHART_COLORS[node.category % CHART_COLORS.length]
					}
				})),
				links: data.links,
				categories: data.categories.map((c, i) => ({
					name: c.name,
					itemStyle: {
						color: CHART_COLORS[i % CHART_COLORS.length]
					}
				})),
				roam: true,
				label: {
					show: true,
					position: 'right',
					formatter: '{b}',
					fontSize: 10,
					color: labelColor
				},
				labelLayout: {
					hideOverlap: true
				},
				force: {
					repulsion: forceConfig?.repulsion ?? 100,
					gravity: forceConfig?.gravity ?? 0.1,
					edgeLength: forceConfig?.edgeLength ?? [50, 150],
					friction: forceConfig?.friction ?? 0.6,
					layoutAnimation: forceConfig?.layoutAnimation ?? true
				},
				lineStyle: {
					color: 'source',
					curveness: 0.3,
					opacity: 0.5
				},
				emphasis: {
					focus: 'adjacency',
					lineStyle: {
						width: 3
					}
				}
			}
		]
	});

	function handleClick(params: unknown) {
		const p = params as { data: { id: string; category: number } };
		if (onclick && p.data) {
			onclick(p.data.id, p.data.category);
		}
	}
</script>

<EChart {option} class={cn(className)} onclick={handleClick} />
