<script lang="ts">
	import EChart from './EChart.svelte';
	import { echarts } from '$lib/utils/echarts';
	import { PieChart as EPieChart } from 'echarts/charts';
	import { TitleComponent, TooltipComponent, LegendComponent } from 'echarts/components';
	import type { EChartsOption } from 'echarts';
	import type { PieChartDataPoint } from '$lib/types';
	import { cn } from '$lib/utils/cn';
	import { getChartColor, legendTextStyle } from '$lib/styles';
	import { theme } from '$lib/stores/data';
	import { buildTitle, hideAxes, PIE_FORMAT_STRING } from './utils';

	echarts.use([EPieChart, TitleComponent, TooltipComponent, LegendComponent]);

	interface Props {
		data: PieChartDataPoint[];
		title?: string;
		class?: string;
		onclick?: (name: string) => void;
	}

	let { data, title = '', class: className = '', onclick }: Props = $props();

	let legendStyle = $derived(legendTextStyle($theme === 'dark'));

	let option: EChartsOption = $derived({
		...buildTitle(title),
		tooltip: {
			confine: true,
			trigger: 'item',
			formatter: PIE_FORMAT_STRING
		},
		...hideAxes(),
		legend: {
			orient: 'vertical',
			left: 'left',
			top: 'middle',
			type: 'scroll',
			textStyle: { ...legendStyle }
		},
		series: [
			{
				name: 'Distribution',
				type: 'pie',
				radius: ['48%', '72%'],
				center: ['60%', '50%'],
				avoidLabelOverlap: true,
				itemStyle: {
					borderRadius: 6,
					borderColor: 'transparent',
					borderWidth: 3
				},
				label: {
					show: false
				},
				emphasis: {
					scale: true,
					scaleSize: 6,
					label: {
						show: false
					}
				},
				labelLine: {
					show: false
				},
				data: data.map((d, i) => ({
					name: d.name,
					value: d.value,
					itemStyle: {
						color: getChartColor(i)
					}
				}))
			}
		]
	});

	function handleClick(params: unknown) {
		const p = params as { name: string };
		if (onclick && p.name) {
			onclick(p.name);
		}
	}
</script>

<EChart {option} class={cn(className)} onclick={handleClick} showZoomControls={false} />
