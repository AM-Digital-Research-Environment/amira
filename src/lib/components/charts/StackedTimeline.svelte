<script lang="ts">
	import EChart from './EChart.svelte';
	import { echarts } from '$lib/utils/echarts';
	import { BarChart as EBarChart } from 'echarts/charts';
	import {
		TitleComponent,
		TooltipComponent,
		GridComponent,
		LegendComponent,
		DataZoomComponent,
		AxisPointerComponent
	} from 'echarts/components';
	import type { EChartsOption } from 'echarts';
	import type { StackedTimelineDataPoint } from '$lib/utils/dataTransform';
	import { getResourceTypesFromStackedData } from '$lib/utils/dataTransform';
	import { cn } from '$lib/utils/cn';
	import { CHART_COLORS, axisLabelStyle, legendTextStyle } from '$lib/styles';
	import { theme } from '$lib/stores/data';
	import { buildTitle, buildGrid, buildDataZoom, stackedFormatter } from './utils';

	echarts.use([
		EBarChart,
		TitleComponent,
		TooltipComponent,
		GridComponent,
		LegendComponent,
		DataZoomComponent,
		AxisPointerComponent
	]);

	interface Props {
		data: StackedTimelineDataPoint[];
		title?: string;
		class?: string;
		onclick?: (year: number, resourceType?: string) => void;
	}

	let { data, title = '', class: className = '', onclick }: Props = $props();

	// Get all resource types present in the data
	let resourceTypes = $derived(getResourceTypesFromStackedData(data));

	let isDark = $derived($theme === 'dark');
	let labelStyle = $derived(axisLabelStyle(isDark));
	let legendStyle = $derived(legendTextStyle(isDark));

	let option: EChartsOption = $derived({
		...buildTitle(title),
		tooltip: {
			confine: true,
			trigger: 'axis',
			axisPointer: {
				type: 'shadow'
			},
			formatter: stackedFormatter
		},
		legend: {
			type: 'scroll',
			bottom: 65,
			data: resourceTypes,
			textStyle: { ...legendStyle }
		},
		grid: buildGrid({
			left: '3%',
			right: '4%',
			bottom: 100,
			top: title ? '15%' : '10%'
		}),
		xAxis: {
			type: 'category',
			data: data.map((d) => d.year.toString()),
			axisLabel: {
				...labelStyle,
				rotate: 45
			}
		},
		yAxis: {
			type: 'value',
			name: 'Count',
			axisLabel: { ...labelStyle },
			nameTextStyle: { ...labelStyle }
		},
		dataZoom: buildDataZoom({
			start: 0,
			end: 100,
			bottom: 10,
			height: 25
		}),
		series: resourceTypes.map((type, index) => ({
			name: type,
			type: 'bar',
			stack: 'total',
			emphasis: {
				focus: 'series'
			},
			data: data.map((d) => d.byType[type] || 0),
			itemStyle: {
				color: CHART_COLORS[index % CHART_COLORS.length]
			}
		}))
	});

	function handleClick(params: unknown) {
		const p = params as { name: string; seriesName?: string };
		if (onclick && p.name) {
			onclick(parseInt(p.name), p.seriesName);
		}
	}
</script>

<EChart {option} class={cn(className)} onclick={handleClick} showZoomControls={false} />
