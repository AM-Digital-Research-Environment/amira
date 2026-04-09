<script lang="ts">
	import EChart from './EChart.svelte';
	import { echarts } from '$lib/utils/echarts';
	import { SunburstChart as ESunburstChart } from 'echarts/charts';
	import { TitleComponent, TooltipComponent } from 'echarts/components';
	import type { EChartsOption } from 'echarts';
	import { cn } from '$lib/utils/cn';
	import { CHART_COLORS, getThemeColors } from '$lib/styles';
	import { buildTitle, hideAxes, pathFormatter } from './utils';
	import { theme } from '$lib/stores/data';

	echarts.use([ESunburstChart, TitleComponent, TooltipComponent]);

	interface SunburstNode {
		name: string;
		value?: number;
		children?: SunburstNode[];
	}

	interface Props {
		data: SunburstNode[];
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
				type: 'sunburst',
				data: data,
				radius: ['15%', '90%'],
				center: ['50%', title ? '55%' : '50%'],
				sort: 'desc',
				emphasis: {
					focus: 'ancestor'
				},
				levels: [
					{},
					{
						r0: '15%',
						r: '40%',
						itemStyle: {
							borderWidth: 2
						},
						label: {
							rotate: 'tangential',
							fontSize: 11,
							color: themeColors.chartText
						}
					},
					{
						r0: '40%',
						r: '65%',
						label: {
							rotate: 'tangential',
							fontSize: 10,
							color: themeColors.chartText
						}
					},
					{
						r0: '65%',
						r: '90%',
						label: {
							position: 'outside',
							padding: 3,
							silent: false,
							fontSize: 9,
							color: themeColors.chartText
						},
						itemStyle: {
							borderWidth: 1
						}
					}
				],
				itemStyle: {
					borderRadius: 4,
					borderColor: 'transparent',
					borderWidth: 2
				},
				label: {
					show: true,
					formatter: '{b}',
					color: themeColors.chartText
				}
			}
		],
		color: [...CHART_COLORS]
	});

	function handleClick(params: unknown) {
		const p = params as { name: string; treePathInfo: { name: string }[] };
		if (onclick && p.name) {
			const path = p.treePathInfo?.map((n) => n.name).filter((n) => n) || [p.name];
			onclick(p.name, path);
		}
	}
</script>

<EChart {option} class={cn(className)} onclick={handleClick} />
