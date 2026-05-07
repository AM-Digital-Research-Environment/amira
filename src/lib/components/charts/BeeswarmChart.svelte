<script lang="ts">
	import EChart from './EChart.svelte';
	import { echarts } from '$lib/utils/echarts';
	import { ScatterChart } from 'echarts/charts';
	import {
		TitleComponent,
		TooltipComponent,
		GridComponent,
		LegendComponent
	} from 'echarts/components';
	import type { EChartsOption } from 'echarts';
	import { cn } from '$lib/utils/cn';
	import {
		CHART_COLORS,
		getChartEmphasisShadow,
		getMarkerBorderColor,
		axisLabelStyle,
		legendTextStyle
	} from '$lib/styles';
	import { theme } from '$lib/stores/data';
	import { buildTitle, buildGrid } from './utils';
	import { SvelteMap } from 'svelte/reactivity';

	echarts.use([ScatterChart, TitleComponent, TooltipComponent, GridComponent, LegendComponent]);

	export interface BeeswarmDataPoint {
		/** Category label (y-axis) */
		category: string;
		/** Numeric value (x-axis, e.g. year) */
		value: number;
		/** Display label for tooltip */
		label: string;
		/** Optional size dimension */
		size?: number;
	}

	interface Props {
		data: BeeswarmDataPoint[];
		title?: string;
		class?: string;
		/** Jitter amount in pixels (ECharts 6 feature) */
		jitter?: number;
		/** Whether to allow overlap */
		jitterOverlap?: boolean;
		/** Value axis label (e.g. "Year") */
		valueAxisLabel?: string;
		onclick?: (label: string, category: string) => void;
	}

	let {
		data,
		title = '',
		class: className = '',
		jitter = 30,
		jitterOverlap = false,
		valueAxisLabel = '',
		onclick
	}: Props = $props();

	let categories = $derived([...new Set(data.map((d) => d.category))]);

	// Assign color per category
	let categoryColorMap = $derived.by(() => {
		const map = new SvelteMap<string, string>();
		categories.forEach((cat, i) => {
			map.set(cat, CHART_COLORS[i % CHART_COLORS.length]);
		});
		return map;
	});

	let maxSize = $derived(Math.max(...data.map((d) => d.size ?? 1), 1));
	let minValue = $derived(Math.min(...data.map((d) => d.value)));
	let maxValue = $derived(Math.max(...data.map((d) => d.value)));

	let isDark = $derived($theme === 'dark');
	let markerBorder = $derived(getMarkerBorderColor(isDark));
	let emphasisShadow = $derived(getChartEmphasisShadow(isDark));
	let labelStyle = $derived(axisLabelStyle(isDark));

	let option: EChartsOption = $derived({
		...buildTitle(title),
		tooltip: {
			confine: true,
			formatter: (params: unknown) => {
				const p = params as { data: [number, number, string, number] };
				const cat = categories[p.data[1]];
				const val = p.data[0];
				const label = p.data[2];
				const size = p.data[3];
				let html = `<strong>${label}</strong><br/>${cat}`;
				if (valueAxisLabel) html += `<br/>${valueAxisLabel}: ${val}`;
				if (size > 1) html += `<br/>Items: ${size}`;
				return html;
			}
		},
		grid: buildGrid({
			left: '3%',
			right: '6%',
			// Top reserves room for the title (when present) and the legend
			// strip — the legend now sits above the plot to keep the bottom
			// band free for the x-axis name + dataZoom slider.
			top: title ? 64 : 36,
			// Bottom = x-axis ticks + "Start Year" name (~32px) + slider (~24px).
			bottom: 70
		}),
		dataZoom: [
			{
				type: 'slider',
				xAxisIndex: 0,
				// Pin the slider to the very bottom — the axis name lives
				// between the tick labels and the slider, with breathing room
				// above and below.
				bottom: 6,
				height: 18,
				startValue: minValue - 1,
				endValue: maxValue + 1,
				labelFormatter: (val: number) => String(Math.round(val)),
				brushSelect: false
			}
		],
		xAxis: {
			type: 'value',
			name: valueAxisLabel,
			nameLocation: 'middle',
			// Tighter gap so the name stays close to the axis ticks instead of
			// drifting down into the slider area below.
			nameGap: 28,
			nameTextStyle: { ...labelStyle },
			min: minValue - 1,
			max: maxValue + 1,
			axisLabel: {
				...labelStyle,
				formatter: (val: number) => String(Math.round(val))
			},
			// ECharts 6 jitter on the non-data axis
			jitter: 0
		} as EChartsOption['xAxis'],
		yAxis: {
			type: 'category',
			data: categories,
			axisLabel: {
				...labelStyle,
				width: 140,
				overflow: 'truncate',
				fontSize: 11
			},
			// ECharts 6 beeswarm jitter
			jitter,
			jitterOverlap,
			jitterMargin: 3
		} as EChartsOption['yAxis'],
		// One scatter series per category so `legend.data` matches `series.name`
		// — ECharts 6 requires this for legend filtering and warns otherwise.
		// As a bonus the user gets click-to-toggle visibility per category.
		series: categories.map((cat, catIndex) => ({
			type: 'scatter',
			name: cat,
			data: data
				.filter((d) => d.category === cat)
				.map((d) => [d.value, catIndex, d.label, d.size ?? 1]),
			symbolSize: ((val: number[]) => {
				const size = val[3] ?? 1;
				// Scale between 8 and 28 based on size
				return maxSize <= 1 ? 12 : 8 + (size / maxSize) * 20;
			}) as unknown as number,
			itemStyle: {
				color: categoryColorMap.get(cat) ?? CHART_COLORS[catIndex % CHART_COLORS.length],
				opacity: 0.85,
				borderColor: markerBorder,
				borderWidth: 1.25
			},
			emphasis: {
				focus: 'series',
				itemStyle: {
					opacity: 1,
					shadowBlur: 10,
					shadowColor: emphasisShadow
				}
			}
		})),
		// Legend at the top so it never sits on top of the dataZoom slider
		// or the "Start Year" axis name below the plot. `type: 'scroll'`
		// keeps the row compact when there are 8+ categories.
		legend: {
			show: categories.length > 1 && categories.length <= 10,
			type: 'scroll',
			top: title ? 28 : 4,
			left: 'center',
			data: categories.map((cat) => ({
				name: cat,
				icon: 'circle'
			})),
			textStyle: { ...legendTextStyle(isDark) }
		}
	});

	function handleClick(params: unknown) {
		const p = params as { data: [number, number, string, number] };
		if (onclick && p.data) {
			onclick(p.data[2], categories[p.data[1]]);
		}
	}
</script>

<div class={cn('h-full w-full', className)}>
	<EChart {option} class="h-full w-full" onclick={handleClick} showZoomControls={false} />
</div>
