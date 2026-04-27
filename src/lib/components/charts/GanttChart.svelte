<script lang="ts">
	import EChart from './EChart.svelte';
	import { echarts } from '$lib/utils/echarts';
	import { CustomChart } from 'echarts/charts';
	import {
		TitleComponent,
		TooltipComponent,
		GridComponent,
		LegendComponent,
		DataZoomComponent
	} from 'echarts/components';
	import type { EChartsOption, CustomSeriesOption } from 'echarts';
	import { cn } from '$lib/utils/cn';
	import { CHART_COLORS, getChartEmphasisShadow, axisLabelStyle } from '$lib/styles';
	import { theme } from '$lib/stores/data';
	import { buildTitle, buildGrid } from './utils';
	import { SvelteMap } from 'svelte/reactivity';

	echarts.use([
		CustomChart,
		TitleComponent,
		TooltipComponent,
		GridComponent,
		LegendComponent,
		DataZoomComponent
	]);

	export interface GanttDataPoint {
		/** Display name (y-axis label) */
		name: string;
		/** Start value (e.g. timestamp or year) */
		start: number;
		/** End value */
		end: number;
		/** Category for color grouping */
		category?: string;
		/** Extra tooltip info */
		tooltip?: string;
	}

	interface Props {
		data: GanttDataPoint[];
		title?: string;
		class?: string;
		/** Format x-axis values as years */
		formatAsYear?: boolean;
		/** Categories for the legend */
		categories?: string[];
		/** Optional category → CSS colour map. Lets the caller paint bars
		 *  with brand-specific tokens (e.g. research-section colours) so the
		 *  chart stays consistent with badges and facet pills. Categories not
		 *  present in the map fall back to the chart palette. */
		categoryColors?: Record<string, string>;
		/** Show the built-in ECharts legend strip below the chart. Set to
		 *  false when the host page renders its own facet pills as a legend
		 *  — this also avoids the "series not exists" console warning that
		 *  appears because the gantt uses a single custom series rather than
		 *  one series per category. */
		showLegend?: boolean;
		onclick?: (name: string) => void;
	}

	let {
		data,
		title = '',
		class: className = '',
		formatAsYear = true,
		categories,
		categoryColors,
		showLegend = true,
		onclick
	}: Props = $props();

	// Derive categories from data if not provided
	let allCategories = $derived(
		categories ?? [...new Set(data.map((d) => d.category ?? 'Default'))]
	);

	let categoryColorMap = $derived.by(() => {
		const map = new SvelteMap<string, string>();
		allCategories.forEach((cat, i) => {
			map.set(cat, categoryColors?.[cat] ?? CHART_COLORS[i % CHART_COLORS.length]);
		});
		return map;
	});

	// Sort data by start time, then by category
	let sortedData = $derived(
		[...data].sort((a, b) => {
			const catCmp = (a.category ?? '').localeCompare(b.category ?? '');
			return catCmp !== 0 ? catCmp : a.start - b.start;
		})
	);

	let emphasisShadow = $derived(getChartEmphasisShadow($theme === 'dark'));
	let labelStyle = $derived(axisLabelStyle($theme === 'dark'));

	let option: EChartsOption = $derived({
		...buildTitle(title),
		tooltip: {
			confine: true,
			formatter: (params: unknown) => {
				const p = params as { data: [number, number, number, string, string, string] };
				const d = p.data;
				const name = d[3];
				const startVal = formatAsYear ? String(Math.round(d[1])) : String(d[1]);
				const endVal = formatAsYear ? String(Math.round(d[2])) : String(d[2]);
				const category = d[4];
				const tooltip = d[5];
				let html = `<strong>${name}</strong>`;
				if (category) html += `<br/>${category}`;
				html += `<br/>${startVal} – ${endVal}`;
				if (formatAsYear) {
					const duration = Math.round(d[2]) - Math.round(d[1]);
					html += ` (${duration} year${duration !== 1 ? 's' : ''})`;
				}
				if (tooltip) html += `<br/>${tooltip}`;
				return html;
			}
		},
		grid: buildGrid({
			left: '3%',
			right: '4%',
			top: title ? '12%' : '5%',
			bottom: showLegend && allCategories.length > 1 ? '15%' : '10%'
		}),
		xAxis: {
			type: 'value',
			min: 'dataMin',
			max: 'dataMax',
			minInterval: formatAsYear ? 1 : undefined,
			axisLabel: {
				...labelStyle,
				hideOverlap: true,
				formatter: formatAsYear ? (val: number) => String(Math.round(val)) : undefined
			}
		},
		yAxis: {
			type: 'category',
			data: sortedData.map((d) => d.name),
			axisLabel: {
				...labelStyle,
				width: 180,
				overflow: 'truncate',
				fontSize: 11
			},
			inverse: true
		},
		dataZoom:
			data.length > 15
				? [
						{
							type: 'slider',
							yAxisIndex: 0,
							right: 0,
							width: 20,
							start: 0,
							end: Math.min(100, (15 / data.length) * 100)
						},
						{
							type: 'inside',
							yAxisIndex: 0
						}
					]
				: undefined,
		series: [
			{
				type: 'custom',
				renderItem: ((params: Record<string, unknown>, api: Record<string, unknown>) => {
					const apiFn = api as {
						value: (dim: number) => number;
						coord: (val: [number, number]) => [number, number];
						size: (val: [number, number]) => [number, number];
						style: () => Record<string, unknown>;
					};
					const coordSys = (
						params as { coordSys: { x: number; y: number; width: number; height: number } }
					).coordSys;

					const categoryIndex = apiFn.value(0);
					const start = apiFn.coord([apiFn.value(1), categoryIndex]);
					const end = apiFn.coord([apiFn.value(2), categoryIndex]);
					const height = apiFn.size([0, 1])[1] * 0.6;

					const rectShape = echarts.graphic.clipRectByRect(
						{
							x: start[0],
							y: start[1] - height / 2,
							width: Math.max(end[0] - start[0], 4),
							height: height
						},
						{
							x: coordSys.x,
							y: coordSys.y,
							width: coordSys.width,
							height: coordSys.height
						}
					);

					const fill =
						categoryColorMap.get(sortedData[Math.round(categoryIndex)]?.category ?? 'Default') ??
						CHART_COLORS[0];

					return (
						rectShape && {
							type: 'rect' as const,
							shape: rectShape,
							style: {
								...apiFn.style(),
								fill,
								opacity: 0.85
							},
							// Explicitly repeat the fill in the emphasis style.
							// Without it, ECharts' default emphasis on `custom`
							// series resets the brush colour to its own
							// "highlighted" tint, which combined with our 0.85
							// base opacity made the bar look like it disappeared
							// on hover.
							emphasis: {
								style: {
									fill,
									opacity: 1,
									shadowBlur: 8,
									shadowColor: emphasisShadow
								}
							}
						}
					);
				}) as unknown as CustomSeriesOption['renderItem'],
				encode: {
					x: [1, 2],
					y: 0,
					tooltip: [1, 2]
				},
				data: sortedData.map((d, i) => [
					i,
					d.start,
					d.end,
					d.name,
					d.category ?? '',
					d.tooltip ?? ''
				]),
				clip: true
			}
		],
		legend:
			showLegend && allCategories.length > 1
				? {
						show: true,
						bottom: 0,
						data: allCategories.map((cat) => ({
							name: cat,
							icon: 'roundRect',
							itemStyle: {
								color: categoryColorMap.get(cat) ?? CHART_COLORS[0]
							}
						}))
					}
				: undefined
	});

	function handleClick(params: unknown) {
		const p = params as { data: [number, number, number, string] };
		if (onclick && p.data) {
			onclick(p.data[3]);
		}
	}
</script>

<div class={cn('h-full w-full', className)}>
	<EChart
		{option}
		class="h-full w-full"
		onclick={handleClick}
		showZoomControls={false}
		notMerge={true}
	/>
</div>
