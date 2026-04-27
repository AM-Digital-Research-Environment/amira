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
		/** Where to place the legend. `bottom` is recommended for slices
		 *  with long labels — it gives the donut the full width and lets
		 *  the legend wrap horizontally instead of clipping the chart. */
		legendPosition?: 'left' | 'bottom';
	}

	let {
		data,
		title = '',
		class: className = '',
		onclick,
		legendPosition = 'bottom'
	}: Props = $props();

	let legendStyle = $derived(legendTextStyle($theme === 'dark'));

	let legendOption = $derived(
		legendPosition === 'bottom'
			? {
					orient: 'horizontal' as const,
					left: 'center' as const,
					bottom: 0,
					type: 'scroll' as const,
					textStyle: { ...legendStyle }
				}
			: {
					orient: 'vertical' as const,
					left: 'left' as const,
					top: 'middle' as const,
					type: 'scroll' as const,
					textStyle: { ...legendStyle }
				}
	);

	// When the legend sits at the bottom, the donut should be centred and
	// shifted up a touch so it doesn't run into the legend strip. With a
	// left-side legend the donut shifts right to leave room for labels.
	let seriesCenter = $derived<[string, string]>(
		legendPosition === 'bottom' ? ['50%', '45%'] : ['60%', '50%']
	);

	let option: EChartsOption = $derived({
		...buildTitle(title),
		tooltip: {
			confine: true,
			trigger: 'item',
			formatter: PIE_FORMAT_STRING
		},
		...hideAxes(),
		legend: legendOption,
		series: [
			{
				name: 'Distribution',
				type: 'pie',
				radius: ['42%', '68%'],
				center: seriesCenter,
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
