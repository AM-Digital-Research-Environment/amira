<script lang="ts">
	import EChart from './EChart.svelte';
	import { echarts } from '$lib/utils/echarts';
	import { HeatmapChart as EHeatmapChart } from 'echarts/charts';
	import {
		TitleComponent,
		TooltipComponent,
		GridComponent,
		VisualMapComponent
	} from 'echarts/components';
	import type { EChartsOption } from 'echarts';
	import { cn } from '$lib/utils/cn';
	import { getChartEmphasisShadow, getHeatmapRange } from '$lib/styles';
	import { theme } from '$lib/stores/data';
	import { buildTitle, buildGrid } from './utils';

	echarts.use([EHeatmapChart, TitleComponent, TooltipComponent, GridComponent, VisualMapComponent]);

	export interface HeatmapDataPoint {
		x: string;
		y: string;
		value: number;
	}

	interface Props {
		data: HeatmapDataPoint[];
		title?: string;
		xLabels?: string[];
		yLabels?: string[];
		class?: string;
		/** Color range: [min, max] */
		colorRange?: [string, string];
		onclick?: (x: string, y: string, value: number) => void;
	}

	let {
		data,
		title = '',
		xLabels,
		yLabels,
		class: className = '',
		colorRange,
		onclick
	}: Props = $props();

	let isDark = $derived($theme === 'dark');
	let effectiveColorRange = $derived<[string, string]>(colorRange ?? getHeatmapRange(isDark));
	let emphasisShadow = $derived(getChartEmphasisShadow(isDark));

	// Derive labels from data if not provided
	let xAxisLabels = $derived(xLabels ?? [...new Set(data.map((d) => d.x))]);
	let yAxisLabels = $derived(yLabels ?? [...new Set(data.map((d) => d.y))]);

	let maxValue = $derived(Math.max(...data.map((d) => d.value), 1));

	let option: EChartsOption = $derived({
		...buildTitle(title),
		tooltip: {
			confine: true,
			position: 'top',
			formatter: (params: unknown) => {
				const p = params as { data: [number, number, number]; name: string };
				const xLabel = xAxisLabels[p.data[0]];
				const yLabel = yAxisLabels[p.data[1]];
				const val = p.data[2];
				return `<strong>${yLabel}</strong> × <strong>${xLabel}</strong><br/>Count: ${val}`;
			}
		},
		grid: buildGrid({
			left: '3%',
			right: '8%',
			top: title ? '12%' : '5%',
			bottom: '18%'
		}),
		xAxis: {
			type: 'category',
			data: xAxisLabels,
			splitArea: { show: true },
			axisLabel: {
				rotate: 35,
				interval: 0,
				fontSize: 11
			}
		},
		yAxis: {
			type: 'category',
			data: yAxisLabels,
			splitArea: { show: true },
			axisLabel: {
				width: 140,
				overflow: 'truncate',
				fontSize: 11
			}
		},
		visualMap: {
			min: 0,
			max: maxValue,
			calculable: true,
			orient: 'vertical',
			right: 0,
			top: 'center',
			itemHeight: 120,
			inRange: {
				color: effectiveColorRange
			},
			textStyle: {
				fontSize: 11
			}
		},
		series: [
			{
				name: 'Count',
				type: 'heatmap',
				data: data.map((d) => {
					const xi = xAxisLabels.indexOf(d.x);
					const yi = yAxisLabels.indexOf(d.y);
					return [xi, yi, d.value];
				}),
				label: {
					show: data.length <= 100,
					fontSize: 10
				},
				emphasis: {
					itemStyle: {
						shadowBlur: 10,
						shadowColor: emphasisShadow
					}
				}
			}
		]
	});

	function handleClick(params: unknown) {
		const p = params as { data: [number, number, number] };
		if (onclick && p.data) {
			onclick(xAxisLabels[p.data[0]], yAxisLabels[p.data[1]], p.data[2]);
		}
	}
</script>

<div class={cn('h-full w-full', className)}>
	<EChart {option} class="h-full w-full" onclick={handleClick} showZoomControls={false} />
</div>
