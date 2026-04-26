<script lang="ts">
	/**
	 * Box-and-whisker chart for distribution comparisons (e.g. items-per-project
	 * across research sections, members-per-group, contributors-per-institution).
	 *
	 * Data shape:
	 *   [{ name: 'Section A', values: [3, 5, 7, 12, 18] }, …]
	 *
	 * The component computes the five-number summary itself so callers can pass
	 * raw observation arrays (ECharts boxplot accepts pre-computed `[min, q1,
	 * median, q3, max]` rows but that's harder to read at the call site).
	 */
	import EChart from './EChart.svelte';
	import { echarts } from '$lib/utils/echarts';
	import { BoxplotChart as EBoxplotChart, ScatterChart as EScatterChart } from 'echarts/charts';
	import {
		TitleComponent,
		TooltipComponent,
		GridComponent,
		LegendComponent
	} from 'echarts/components';
	import type { EChartsOption } from 'echarts';
	import { cn } from '$lib/utils/cn';
	import { CHART_COLORS, axisLabelStyle } from '$lib/styles';
	import { theme } from '$lib/stores/data';
	import { buildTitle, buildGrid } from './utils';
	import type { BoxPlotGroup } from '$lib/types';

	echarts.use([
		EBoxplotChart,
		EScatterChart,
		TitleComponent,
		TooltipComponent,
		GridComponent,
		LegendComponent
	]);

	interface Props {
		data: BoxPlotGroup[];
		title?: string;
		valueAxisLabel?: string;
		showOutliers?: boolean;
		class?: string;
		onclick?: (group: string) => void;
	}

	let {
		data,
		title = '',
		valueAxisLabel = 'Value',
		showOutliers = true,
		class: className = '',
		onclick
	}: Props = $props();

	let isDark = $derived($theme === 'dark');
	let labelStyle = $derived(axisLabelStyle(isDark));

	function quantile(sorted: number[], q: number): number {
		if (sorted.length === 0) return 0;
		const pos = (sorted.length - 1) * q;
		const base = Math.floor(pos);
		const rest = pos - base;
		return (
			sorted[base] + (sorted[base + 1] !== undefined ? rest * (sorted[base + 1] - sorted[base]) : 0)
		);
	}

	let summaries = $derived(
		data.map((g) => {
			const sorted = [...g.values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
			if (sorted.length === 0) {
				return { name: g.name, box: [0, 0, 0, 0, 0], outliers: [] as number[] };
			}
			const q1 = quantile(sorted, 0.25);
			const median = quantile(sorted, 0.5);
			const q3 = quantile(sorted, 0.75);
			const iqr = q3 - q1;
			const lowFence = q1 - 1.5 * iqr;
			const highFence = q3 + 1.5 * iqr;
			const inFence = sorted.filter((v) => v >= lowFence && v <= highFence);
			const outliers = sorted.filter((v) => v < lowFence || v > highFence);
			const min = inFence.length > 0 ? inFence[0] : sorted[0];
			const max = inFence.length > 0 ? inFence[inFence.length - 1] : sorted[sorted.length - 1];
			return {
				name: g.name,
				box: [min, q1, median, q3, max] as [number, number, number, number, number],
				outliers
			};
		})
	);

	let categories = $derived(summaries.map((s) => s.name));
	let boxData = $derived(summaries.map((s) => s.box));
	let outlierPoints = $derived.by(() => {
		const points: [number, number][] = [];
		summaries.forEach((s, i) => {
			for (const v of s.outliers) points.push([i, v]);
		});
		return points;
	});

	let option: EChartsOption = $derived({
		...buildTitle(title),
		tooltip: {
			confine: true,
			trigger: 'item'
		},
		grid: buildGrid({
			left: '3%',
			right: '4%',
			top: title ? '15%' : '6%',
			bottom: '10%'
		}),
		xAxis: {
			type: 'category',
			data: categories,
			boundaryGap: true,
			axisLabel: {
				...labelStyle,
				rotate: categories.length > 6 ? 30 : 0,
				interval: 0,
				width: 110,
				overflow: 'truncate'
			}
		},
		yAxis: {
			type: 'value',
			name: valueAxisLabel,
			axisLabel: { ...labelStyle },
			nameTextStyle: { ...labelStyle },
			splitLine: { show: true }
		},
		series: [
			{
				name: 'distribution',
				type: 'boxplot',
				data: boxData,
				itemStyle: {
					color: CHART_COLORS[0] + '33',
					borderColor: CHART_COLORS[0],
					borderWidth: 1.5
				},
				emphasis: {
					itemStyle: {
						borderColor: CHART_COLORS[1],
						borderWidth: 2
					}
				}
			},
			...(showOutliers && outlierPoints.length > 0
				? [
						{
							name: 'outliers',
							type: 'scatter' as const,
							data: outlierPoints,
							symbolSize: 5,
							itemStyle: { color: CHART_COLORS[1] }
						}
					]
				: [])
		]
	});

	function handleClick(params: unknown) {
		const p = params as { name: string };
		if (onclick && p.name) onclick(p.name);
	}
</script>

<EChart {option} class={cn(className)} onclick={handleClick} showZoomControls={false} />
