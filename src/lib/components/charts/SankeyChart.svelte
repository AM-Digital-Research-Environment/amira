<script lang="ts">
	import EChart from './EChart.svelte';
	import type { EChartsOption } from 'echarts';
	import { cn } from '$lib/utils/cn';
	import { getChartColor, getThemeColors } from '$lib/styles';
	import { buildTitle, hideAxes, linkFormatter } from './utils';
	import { theme } from '$lib/stores/data';

	interface SankeyNode {
		name: string;
	}

	interface SankeyLink {
		source: string;
		target: string;
		value: number;
	}

	interface Props {
		nodes: SankeyNode[];
		links: SankeyLink[];
		title?: string;
		class?: string;
	}

	let { nodes, links, title = '', class: className = '' }: Props = $props();

	let themeColors = $derived(getThemeColors($theme === 'dark'));

	let option: EChartsOption = $derived({
		...buildTitle(title),
		tooltip: {
			confine: true,
			trigger: 'item',
			triggerOn: 'mousemove',
			formatter: linkFormatter
		},
		...hideAxes(),
		series: [
			{
				type: 'sankey',
				layout: 'none',
				emphasis: {
					focus: 'adjacency'
				},
				nodeAlign: 'left',
				data: nodes.map((node, i) => ({
					...node,
					itemStyle: {
						color: getChartColor(i)
					}
				})),
				links: links,
				lineStyle: {
					color: 'gradient',
					curveness: 0.5,
					opacity: 0.6
				},
				label: {
					position: 'right',
					fontSize: 11,
					color: themeColors.chartText
				},
				nodeWidth: 20,
				nodeGap: 12,
				left: '5%',
				right: '15%',
				top: title ? '12%' : '5%',
				bottom: '5%'
			}
		]
	});
</script>

<EChart {option} class={cn(className)} />
