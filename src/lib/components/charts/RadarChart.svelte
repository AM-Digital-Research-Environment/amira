<script lang="ts">
	/**
	 * 5–7 axis radar profile. Used for entity comparison views (Compare UI) and
	 * per-entity profiles where a one-dimensional metric isn't enough.
	 *
	 * Data shape:
	 *   indicator: [{ name: 'Items', max: 100 }, { name: 'Languages', max: 12 }, …]
	 *   series:    [{ name: 'Project A', values: [78, 5, ...] }, …]
	 */
	import EChart from './EChart.svelte';
	import { echarts } from '$lib/utils/echarts';
	import { RadarChart as ERadarChart } from 'echarts/charts';
	import {
		TitleComponent,
		TooltipComponent,
		LegendComponent,
		RadarComponent
	} from 'echarts/components';
	import type { EChartsOption } from 'echarts';
	import { cn } from '$lib/utils/cn';
	import { CHART_COLORS, getThemeColors, legendTextStyle } from '$lib/styles';
	import { theme } from '$lib/stores/data';
	import { buildTitle, hideAxes } from './utils';
	import type { RadarIndicator, RadarSeriesItem } from '$lib/types';

	echarts.use([ERadarChart, TitleComponent, TooltipComponent, LegendComponent, RadarComponent]);

	interface Props {
		indicator: RadarIndicator[];
		series: RadarSeriesItem[];
		title?: string;
		class?: string;
		onclick?: (seriesName: string) => void;
	}

	let { indicator, series, title = '', class: className = '', onclick }: Props = $props();

	let isDark = $derived($theme === 'dark');
	let themeColors = $derived(getThemeColors(isDark));
	let legendStyle = $derived(legendTextStyle(isDark));

	let option: EChartsOption = $derived({
		...buildTitle(title),
		tooltip: {
			confine: true,
			trigger: 'item'
		},
		...hideAxes(),
		legend: {
			data: series.map((s) => s.name),
			bottom: 4,
			textStyle: { ...legendStyle }
		},
		radar: {
			indicator: indicator.map((i) => ({ name: i.name, max: Math.max(i.max, 1) })),
			shape: 'polygon',
			center: ['50%', title ? '52%' : '48%'],
			radius: '62%',
			splitNumber: 4,
			axisName: {
				color: themeColors.chartText,
				fontSize: 11
			},
			splitLine: {
				lineStyle: { color: themeColors.chartGrid }
			},
			splitArea: {
				show: true,
				areaStyle: {
					color: [themeColors.background + '00', themeColors.chartGrid + '20']
				}
			},
			axisLine: {
				lineStyle: { color: themeColors.chartAxis }
			}
		},
		series: [
			{
				type: 'radar',
				data: series.map((s, i) => ({
					name: s.name,
					value: s.values,
					itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
					areaStyle: { opacity: 0.18 },
					lineStyle: { width: 2 }
				}))
			}
		]
	});

	function handleClick(params: unknown) {
		const p = params as { name: string };
		if (onclick && p.name) onclick(p.name);
	}
</script>

<EChart {option} class={cn(className)} onclick={handleClick} showZoomControls={false} />
