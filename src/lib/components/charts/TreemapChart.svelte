<script lang="ts">
	/**
	 * Hierarchical treemap. Accepts the same shape as `SunburstChart` so the
	 * precompute pipeline can output a single hierarchy and the layout chooses
	 * the renderer per slot.
	 */
	import EChart from './EChart.svelte';
	import { echarts } from '$lib/utils/echarts';
	import { TreemapChart as ETreemapChart } from 'echarts/charts';
	import { TitleComponent, TooltipComponent } from 'echarts/components';
	import type { EChartsOption } from 'echarts';
	import { cn } from '$lib/utils/cn';
	import { CHART_COLORS, getThemeColors } from '$lib/styles';
	import { theme } from '$lib/stores/data';
	import { buildTitle, hideAxes, pathFormatter } from './utils';

	echarts.use([ETreemapChart, TitleComponent, TooltipComponent]);

	interface TreemapNode {
		name: string;
		value?: number;
		children?: TreemapNode[];
	}

	interface Props {
		data: TreemapNode[];
		title?: string;
		class?: string;
		onclick?: (name: string, path: string[]) => void;
	}

	let { data, title = '', class: className = '', onclick }: Props = $props();

	let themeColors = $derived(getThemeColors($theme === 'dark'));

	let option: EChartsOption = $derived({
		...buildTitle(title),
		tooltip: {
			confine: true,
			trigger: 'item',
			formatter: pathFormatter
		},
		...hideAxes(),
		series: [
			{
				type: 'treemap',
				data,
				roam: false,
				nodeClick: 'zoomToNode',
				breadcrumb: {
					show: true,
					bottom: 4,
					itemStyle: {
						color: 'transparent',
						borderColor: themeColors.chartGrid,
						borderWidth: 0,
						textStyle: {
							color: themeColors.chartTextMuted,
							fontSize: 11
						}
					}
				},
				label: {
					show: true,
					formatter: '{b}',
					color: '#ffffff',
					fontSize: 12,
					fontWeight: 500,
					textBorderColor: 'rgba(0,0,0,0.4)',
					textBorderWidth: 2
				},
				upperLabel: {
					show: true,
					height: 22,
					color: themeColors.chartText,
					fontSize: 11,
					fontWeight: 600
				},
				itemStyle: {
					borderColor: themeColors.chartGrid,
					borderWidth: 1,
					gapWidth: 1
				},
				levels: [
					{
						itemStyle: {
							borderWidth: 0,
							gapWidth: 4
						}
					},
					{
						colorSaturation: [0.35, 0.6],
						itemStyle: {
							borderWidth: 2,
							gapWidth: 2,
							borderColorSaturation: 0.6
						}
					},
					{
						colorSaturation: [0.3, 0.55],
						itemStyle: {
							borderWidth: 1,
							gapWidth: 1
						}
					}
				]
			}
		],
		color: [...CHART_COLORS]
	});

	function handleClick(params: unknown) {
		const p = params as { name: string; treePathInfo?: { name: string }[] };
		if (onclick && p.name) {
			const path = p.treePathInfo?.map((n) => n.name).filter((n) => n) || [p.name];
			onclick(p.name, path);
		}
	}
</script>

<EChart {option} class={cn(className)} onclick={handleClick} />
