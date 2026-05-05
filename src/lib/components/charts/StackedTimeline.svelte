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
	import type { StackedTimelineDataPoint } from '$lib/utils/transforms';
	import { getResourceTypesFromStackedData } from '$lib/utils/transforms';
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
		/** Explicit ordering for stacked series (legend order, bottom → top).
		 *  Defaults to keys discovered in the data, sorted alphabetically. */
		typeOrder?: string[];
		/** Map a series key to a display label for the legend / tooltip. */
		typeLabel?: (type: string) => string;
		onclick?: (year: number, resourceType?: string) => void;
	}

	let {
		data,
		title = '',
		class: className = '',
		typeOrder,
		typeLabel = (t) => t,
		onclick
	}: Props = $props();

	// Resolve which stacked series to render — caller-supplied order wins,
	// otherwise we discover them from the data.
	let resourceTypes = $derived(
		typeOrder && typeOrder.length > 0 ? typeOrder : getResourceTypesFromStackedData(data)
	);

	// Year slider is only useful when there are enough bars to crowd the
	// axis. Below the threshold we skip it and reclaim the bottom margin —
	// this is what was leaving a big empty gap on the publications chart.
	let needsZoom = $derived(data.length > 15);

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
			bottom: needsZoom ? 65 : 0,
			data: resourceTypes.map((t) => typeLabel(t)),
			textStyle: { ...legendStyle }
		},
		grid: buildGrid({
			// Reserve room for the legend (~32px) plus the zoom slider
			// (~50px) and rotated year labels when the slider is shown.
			// Without the slider we only need ~40px for the legend.
			left: '3%',
			right: '4%',
			bottom: needsZoom ? 100 : 40,
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
		dataZoom: needsZoom
			? buildDataZoom({
					start: 0,
					end: 100,
					bottom: 10,
					height: 25
				})
			: undefined,
		// For each bar position, find the topmost series (last in `resourceTypes`
		// order) that actually has a value > 0, so only that segment gets the
		// rounded top cap. This matches the standalone Timeline's bar styling.
		series: resourceTypes.map((type, index) => ({
			name: typeLabel(type),
			type: 'bar',
			stack: 'total',
			emphasis: {
				focus: 'series'
			},
			data: data.map((d) => {
				const value = d.byType[type] || 0;
				if (value === 0) return value;
				const topType = [...resourceTypes].reverse().find((t) => (d.byType[t] || 0) > 0);
				if (topType !== type) return value;
				return {
					value,
					itemStyle: {
						color: CHART_COLORS[index % CHART_COLORS.length],
						borderRadius: [6, 6, 0, 0]
					}
				};
			}),
			itemStyle: {
				color: CHART_COLORS[index % CHART_COLORS.length]
			}
		}))
	});

	function handleClick(params: unknown) {
		const p = params as { name: string; seriesName?: string };
		if (onclick && p.name) {
			// Map the displayed legend label back to its raw type key so
			// callers always receive the unmapped value they passed in.
			const rawType = resourceTypes.find((t) => typeLabel(t) === p.seriesName) ?? p.seriesName;
			onclick(parseInt(p.name), rawType);
		}
	}
</script>

<EChart {option} class={cn(className)} onclick={handleClick} showZoomControls={false} />
