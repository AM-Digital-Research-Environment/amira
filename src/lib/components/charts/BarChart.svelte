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
	import type { BarChartDataPoint } from '$lib/types';
	import { cn } from '$lib/utils/cn';
	import { CHART_COLORS } from '$lib/styles';
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { buildTitle, buildGrid } from './utils';

	echarts.use([EBarChart, TitleComponent, TooltipComponent, GridComponent, AxisPointerComponent]);

	interface Props {
		data: BarChartDataPoint[];
		title?: string;
		maxItems?: number;
		horizontal?: boolean;
		class?: string;
		onclick?: (name: string) => void;
	}

	let {
		data,
		title = '',
		maxItems = 10,
		horizontal = true,
		class: className = '',
		onclick
	}: Props = $props();

	let currentPage = $state(0);

	let totalPages = $derived(Math.ceil(data.length / maxItems));
	let needsPagination = $derived(data.length > maxItems);

	let displayData = $derived.by(() => {
		const start = currentPage * maxItems;
		const end = start + maxItems;
		return data.slice(start, end);
	});

	function nextPage() {
		if (currentPage < totalPages - 1) {
			currentPage++;
		}
	}

	function prevPage() {
		if (currentPage > 0) {
			currentPage--;
		}
	}

	// Reset to first page when data changes
	$effect(() => {
		data;
		currentPage = 0;
	});

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
			}
		},
		grid: buildGrid({
			left: '3%',
			right: '4%',
			bottom: horizontal ? '3%' : '25%',
			top: title ? '15%' : '3%'
		}),
		xAxis: horizontal
			? {
					type: 'value'
				}
			: {
					type: 'category',
					data: displayData.map((d) => d.name),
					axisLabel: {
						rotate: 45,
						interval: 0
					}
				},
		yAxis: horizontal
			? {
					type: 'category',
					data: displayData.map((d) => d.name).reverse(),
					axisLabel: {
						width: 120,
						overflow: 'truncate'
					}
				}
			: {
					type: 'value'
				},
		series: [
			{
				name: 'Count',
				type: 'bar',
				data: horizontal
					? displayData.map((d) => d.value).reverse()
					: displayData.map((d) => d.value),
				itemStyle: {
					color: CHART_COLORS[0],
					borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]
				},
				emphasis: {
					itemStyle: {
						color: CHART_COLORS[0] + 'cc'
					}
				}
			}
		]
	});

	function handleClick(params: unknown) {
		const p = params as { name: string };
		if (onclick && p.name) {
			onclick(p.name);
		}
	}
</script>

<div class={cn('flex flex-col h-full', className)}>
	<div class="flex-1 min-h-0">
		<EChart {option} class="h-full w-full" onclick={handleClick} showZoomControls={false} />
	</div>

	{#if needsPagination}
		<div class="flex-shrink-0 h-8 flex items-center justify-center gap-2">
			<button
				onclick={prevPage}
				disabled={currentPage === 0}
				class="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
				aria-label="Previous page"
			>
				<ChevronLeft class="h-4 w-4" />
			</button>

			<span class="text-sm text-muted-foreground min-w-[60px] text-center">
				{currentPage + 1} / {totalPages}
			</span>

			<button
				onclick={nextPage}
				disabled={currentPage === totalPages - 1}
				class="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
				aria-label="Next page"
			>
				<ChevronRight class="h-4 w-4" />
			</button>
		</div>
	{/if}
</div>
