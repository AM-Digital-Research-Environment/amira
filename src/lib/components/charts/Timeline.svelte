<script lang="ts">
	import EChart from './EChart.svelte';
	import { echarts } from '$lib/utils/echarts';
	import { BarChart as EBarChart } from 'echarts/charts';
	import {
		TitleComponent,
		TooltipComponent,
		GridComponent,
		AxisPointerComponent
	} from 'echarts/components';
	import type { EChartsOption } from 'echarts';
	import type { TimelineDataPoint } from '$lib/types';
	import { cn } from '$lib/utils/cn';
	import { CHART_COLORS } from '$lib/styles';
	import { buildTitle, buildGrid, itemCountFormatter } from './utils';

	echarts.use([EBarChart, TitleComponent, TooltipComponent, GridComponent, AxisPointerComponent]);

	interface Props {
		data: TimelineDataPoint[];
		title?: string;
		class?: string;
		onclick?: (year: number) => void;
	}

	let { data, title = '', class: className = '', onclick }: Props = $props();

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
			bottom: '15%',
			top: title ? '15%' : '3%'
		}),
		xAxis: {
			type: 'category',
			data: data.map((d) => d.year.toString()),
			axisLabel: {
				rotate: 45
			}
		},
		yAxis: {
			type: 'value',
			name: 'Count'
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
