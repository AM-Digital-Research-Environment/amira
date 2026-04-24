<script lang="ts">
	import EChart from './EChart.svelte';
	import { echarts } from '$lib/utils/echarts';
	import { BarChart as EBarChart } from 'echarts/charts';
	import {
		TitleComponent,
		TooltipComponent,
		GridComponent,
		DataZoomComponent,
		AxisPointerComponent
	} from 'echarts/components';
	import type { EChartsOption } from 'echarts';
	import type { TimelineDataPoint } from '$lib/types';
	import { cn } from '$lib/utils/cn';
	import { CHART_COLORS, axisLabelStyle } from '$lib/styles';
	import { theme } from '$lib/stores/data';
	import { buildTitle, buildGrid, buildDataZoom, itemCountFormatter } from './utils';

	echarts.use([
		EBarChart,
		TitleComponent,
		TooltipComponent,
		GridComponent,
		DataZoomComponent,
		AxisPointerComponent
	]);

	interface Props {
		data: TimelineDataPoint[];
		title?: string;
		class?: string;
		onclick?: (year: number) => void;
	}

	let { data, title = '', class: className = '', onclick }: Props = $props();

	let labelStyle = $derived(axisLabelStyle($theme === 'dark'));

	let option: EChartsOption = $derived({
		...buildTitle(title),
		legend: {
			show: false
		},
		tooltip: {
			confine: true,
			trigger: 'axis',
			axisPointer: {
				type: 'shadow'
			},
			formatter: itemCountFormatter
		},
		grid: buildGrid({
			left: '3%',
			right: '4%',
			// Match StackedTimeline: leave room for the DataZoom slider plus
			// the rotated year labels when the slider is active.
			bottom: data.length > 15 ? '22%' : '15%',
			top: title ? '15%' : '3%'
		}),
		// Year slider appears once we have more than ~15 years to browse,
		// matching StackedTimeline's behaviour so the two charts feel uniform.
		dataZoom:
			data.length > 15
				? buildDataZoom({ start: 0, end: 100, showSlider: true, showInside: true })
				: undefined,
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
		series: [
			{
				name: 'Count',
				type: 'bar',
				data: data.map((d) => d.count),
				itemStyle: {
					color: {
						type: 'linear',
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{ offset: 0, color: CHART_COLORS[0] },
							{ offset: 1, color: CHART_COLORS[0] + 'aa' }
						]
					},
					borderRadius: [6, 6, 0, 0]
				},
				emphasis: {
					itemStyle: {
						color: {
							type: 'linear',
							x: 0,
							y: 0,
							x2: 0,
							y2: 1,
							colorStops: [
								{ offset: 0, color: CHART_COLORS[1] },
								{ offset: 1, color: CHART_COLORS[0] }
							]
						}
					}
				}
			}
		]
	});

	function handleClick(params: unknown) {
		const p = params as { name: string };
		if (onclick && p.name) {
			onclick(parseInt(p.name));
		}
	}
</script>

<EChart {option} class={cn(className)} onclick={handleClick} showZoomControls={false} />
