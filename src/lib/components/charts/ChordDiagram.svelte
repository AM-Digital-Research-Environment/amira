<script lang="ts">
	import EChart from './EChart.svelte';
	import type { EChartsOption } from 'echarts';
	import { cn } from '$lib/utils/cn';
	import { CHART_COLORS_EXTENDED, getThemeColors } from '$lib/styles';
	import { buildTitle, hideAxes } from './utils';
	import type { ChordData } from '$lib/types';
	import { theme } from '$lib/stores/data';

	interface Props {
		data: ChordData;
		title?: string;
		class?: string;
	}

	let { data, title = '', class: className = '' }: Props = $props();

	let themeColors = $derived(getThemeColors($theme === 'dark'));

	let option: EChartsOption = $derived({
		...buildTitle(title),
		tooltip: {
			confine: true,
			trigger: 'item',
			formatter: (params: unknown) => {
				const p = params as { data?: { source?: string; target?: string; value?: number }; name?: string; value?: number };
				if (p.data?.source && p.data?.target) {
					return `<strong>${p.data.source}</strong> ↔ <strong>${p.data.target}</strong><br/>Co-occurrences: <strong>${p.data.value}</strong>`;
				}
				if (p.name && p.value !== undefined) {
					return `<strong>${p.name}</strong><br/>Total connections: <strong>${p.value}</strong>`;
				}
				return '';
			}
		},
		...hideAxes(),
		series: [
			{
				type: 'graph',
				layout: 'circular',
				circular: {
					rotateLabel: true
				},
				roam: true,
				label: {
					show: true,
					position: 'right',
					fontSize: 10,
					color: themeColors.chartText,
					formatter: '{b}'
				},
				lineStyle: {
					color: 'source',
					curveness: 0.3,
					opacity: 0.6
				},
				emphasis: {
					focus: 'adjacency',
					lineStyle: {
						opacity: 1,
						width: 3
					}
				},
				categories: data.names.map((name, i) => ({
					name,
					itemStyle: {
						color: CHART_COLORS_EXTENDED[i % CHART_COLORS_EXTENDED.length]
					}
				})),
				data: data.names.map((name, i) => {
					// Calculate total connections for node size
					const totalConnections = data.matrix[i].reduce((sum, val) => sum + val, 0);
					return {
						name,
						symbolSize: Math.max(15, Math.min(50, 10 + Math.sqrt(totalConnections) * 3)),
						value: totalConnections,
						category: i,
						itemStyle: {
							color: CHART_COLORS_EXTENDED[i % CHART_COLORS_EXTENDED.length]
						}
					};
				}),
				links: buildLinks(data.names, data.matrix)
			}
		]
	});

	function buildLinks(names: string[], matrix: number[][]) {
		const links: { source: string; target: string; value: number; lineStyle: { width: number } }[] = [];

		for (let i = 0; i < names.length; i++) {
			for (let j = i + 1; j < names.length; j++) {
				const value = matrix[i][j];
				if (value > 0) {
					links.push({
						source: names[i],
						target: names[j],
						value,
						lineStyle: {
							width: Math.max(1, Math.min(8, Math.sqrt(value)))
						}
					});
				}
			}
		}

		// Sort by value and take top connections for readability
		return links.sort((a, b) => b.value - a.value).slice(0, 150);
	}
</script>

<EChart {option} class={cn(className)} />
