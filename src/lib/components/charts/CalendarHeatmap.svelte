<script lang="ts">
	/**
	 * Calendar heatmap — one cell per day across one or more years. Uses the
	 * ECharts `calendar` coordinate system + `heatmap` series.
	 *
	 * Shape: `[{ date: 'YYYY-MM-DD', value: number }]`. Years are derived from
	 * the data range; if all activity falls in one year that year is shown,
	 * otherwise we render a vertical stack of years.
	 */
	import EChart from './EChart.svelte';
	import { echarts } from '$lib/utils/echarts';
	import { HeatmapChart as EHeatmapChart } from 'echarts/charts';
	import {
		TitleComponent,
		TooltipComponent,
		VisualMapComponent,
		CalendarComponent
	} from 'echarts/components';
	import type { EChartsOption } from 'echarts';
	import { cn } from '$lib/utils/cn';
	import { theme } from '$lib/stores/data';
	import { getHeatmapRange, getThemeColors, axisLabelStyle } from '$lib/styles';
	import { buildTitle } from './utils';
	import type { CalendarDataPoint } from '$lib/types';

	echarts.use([
		EHeatmapChart,
		TitleComponent,
		TooltipComponent,
		VisualMapComponent,
		CalendarComponent
	]);

	interface Props {
		data: CalendarDataPoint[];
		title?: string;
		class?: string;
		onclick?: (date: string, value: number) => void;
	}

	let { data, title = '', class: className = '', onclick }: Props = $props();

	let isDark = $derived($theme === 'dark');
	let themeColors = $derived(getThemeColors(isDark));
	let labelStyle = $derived(axisLabelStyle(isDark));

	let years = $derived.by(() => {
		const out: number[] = [];
		const seen: Record<number, boolean> = {};
		for (const d of data) {
			const y = parseInt(d.date.slice(0, 4), 10);
			if (!Number.isNaN(y) && !seen[y]) {
				seen[y] = true;
				out.push(y);
			}
		}
		return out.sort();
	});

	let maxValue = $derived(Math.max(...data.map((d) => d.value), 1));

	let calendars = $derived.by(() => {
		// Stack one calendar per year so a multi-year archive doesn't squash
		// into an illegible strip. Heights scale with the count of years.
		if (years.length === 0) return [];
		const topPad = title ? 60 : 30;
		const perYear = 130;
		return years.map((y, i) => ({
			top: topPad + i * perYear,
			left: 60,
			right: 30,
			cellSize: ['auto', 18] as [string, number],
			range: y.toString(),
			yearLabel: {
				show: true,
				color: themeColors.chartText,
				fontSize: 12,
				fontWeight: 600
			},
			dayLabel: {
				color: themeColors.chartTextMuted,
				fontSize: 10
			},
			monthLabel: {
				color: themeColors.chartTextMuted,
				fontSize: 11
			},
			itemStyle: {
				color: 'transparent',
				borderColor: themeColors.chartGrid,
				borderWidth: 0.5
			},
			splitLine: {
				lineStyle: {
					color: themeColors.chartAxis,
					width: 1
				}
			}
		}));
	});

	let option: EChartsOption = $derived({
		...buildTitle(title),
		tooltip: {
			confine: true,
			formatter: (params: unknown) => {
				const p = params as { value: [string, number] };
				const [date, value] = p.value;
				return `<strong>${date}</strong><br/>${value} item${value === 1 ? '' : 's'}`;
			}
		},
		visualMap: {
			min: 0,
			max: maxValue,
			calculable: true,
			orient: 'horizontal',
			left: 'center',
			bottom: 10,
			itemWidth: 12,
			itemHeight: 110,
			inRange: { color: getHeatmapRange(isDark) },
			textStyle: { ...labelStyle, fontSize: 11 }
		},
		// Casting because the public type doesn't include array form for
		// multi-year layouts even though the runtime supports it.
		calendar: calendars as unknown as EChartsOption['calendar'],
		series: years.map((y, i) => ({
			type: 'heatmap',
			coordinateSystem: 'calendar',
			calendarIndex: i,
			data: data.filter((d) => d.date.startsWith(y.toString())).map((d) => [d.date, d.value])
		}))
	});

	function handleClick(params: unknown) {
		const p = params as { value: [string, number] };
		if (onclick && p.value) {
			onclick(p.value[0], p.value[1]);
		}
	}
</script>

<EChart {option} class={cn(className)} onclick={handleClick} showZoomControls={false} />
