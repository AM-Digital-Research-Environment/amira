<script lang="ts">
	/**
	 * Stacked area chart of categorical buckets over time.
	 *
	 * Shape:
	 *   data:    [{ year, byCategory: { [name]: count } }]
	 *   series:  ordered list of category names (preserves stacking order)
	 *
	 * Used for `subjectTrends` (top-N subjects over years), `languageTimeline`
	 * (language activity over years), and any "top-N over time" chart where a
	 * stacked bar would be too noisy.
	 */
	import EChart from './EChart.svelte';
	import { echarts } from '$lib/utils/echarts';
	import { LineChart as ELineChart } from 'echarts/charts';
	import {
		TitleComponent,
		TooltipComponent,
		GridComponent,
		LegendComponent,
		DataZoomComponent
	} from 'echarts/components';
	import type { EChartsOption } from 'echarts';
	import { cn } from '$lib/utils/cn';
	import { CHART_COLORS_EXTENDED, axisLabelStyle, legendTextStyle } from '$lib/styles';
	import { theme } from '$lib/stores/data';
	import {
		buildTitle,
		buildGrid,
		buildDataZoom,
		buildTooltip,
		buildLegend,
		buildAxisLabel,
		stackedFormatter
	} from './utils';
	import type { StackedAreaDataPoint } from '$lib/types';

	echarts.use([
		ELineChart,
		TitleComponent,
		TooltipComponent,
		GridComponent,
		LegendComponent,
		DataZoomComponent
	]);

	interface Props {
		data: StackedAreaDataPoint[];
		/** Ordered list of categories. If omitted, derived from the data union. */
		series?: string[];
		title?: string;
		class?: string;
		onclick?: (year: number, category?: string) => void;
	}

	let { data, series, title = '', class: className = '', onclick }: Props = $props();

	let isDark = $derived($theme === 'dark');
	let labelStyle = $derived(axisLabelStyle(isDark));
	let legendStyle = $derived(legendTextStyle(isDark));

	let categories = $derived.by(() => {
		if (series && series.length > 0) return series;
		const seen: Record<string, boolean> = {};
		const out: string[] = [];
		for (const row of data) {
			for (const key of Object.keys(row.byCategory)) {
				if (!seen[key]) {
					seen[key] = true;
					out.push(key);
				}
			}
		}
		return out;
	});

	let years = $derived(data.map((d) => d.year.toString()));

	let option: EChartsOption = $derived({
		...buildTitle(title),
		tooltip: buildTooltip({
			trigger: 'axis',
			axisPointer: 'line',
			formatter: stackedFormatter
		}),
		legend: buildLegend({
			position: 'bottom',
			bottom: 65,
			data: categories,
			textStyle: { ...legendStyle }
		}),
		grid: buildGrid({
			left: '3%',
			right: '4%',
			bottom: 100,
			top: title ? '15%' : '10%'
		}),
		xAxis: {
			type: 'category',
			boundaryGap: false,
			data: years,
			axisLabel: buildAxisLabel({ baseStyle: labelStyle, rotate: 45 })
		},
		yAxis: {
			type: 'value',
			name: 'Count',
			axisLabel: buildAxisLabel({ baseStyle: labelStyle }),
			nameTextStyle: { ...labelStyle }
		},
		dataZoom: buildDataZoom({
			start: 0,
			end: 100,
			bottom: 10,
			height: 25
		}),
		series: categories.map((name, index) => ({
			name,
			type: 'line',
			stack: 'total',
			smooth: true,
			showSymbol: false,
			areaStyle: { opacity: 0.78 },
			lineStyle: { width: 1.5 },
			emphasis: { focus: 'series' },
			data: data.map((d) => d.byCategory[name] ?? 0),
			itemStyle: {
				color: CHART_COLORS_EXTENDED[index % CHART_COLORS_EXTENDED.length]
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
