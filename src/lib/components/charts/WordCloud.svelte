<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as echarts from 'echarts';
	import 'echarts-wordcloud';
	import type { ECharts } from 'echarts';
	import type { WordCloudDataPoint } from '$lib/types';
	import { theme } from '$lib/stores/data';
	import { cn } from '$lib/utils/cn';
	import { CHART_COLORS, FONT_FAMILY, getThemeColors } from '$lib/styles';

	interface Props {
		data: WordCloudDataPoint[];
		title?: string;
		class?: string;
		maxWords?: number;
		onclick?: (word: string) => void;
	}

	let { data, title = '', class: className = '', maxWords = 100, onclick }: Props = $props();

	let chartContainer: HTMLDivElement;
	let chartInstance: ECharts | null = null;

	function getOption() {
		const slicedData = data.slice(0, maxWords);
		const themeColors = getThemeColors($theme === 'dark');

		// Dynamic font size based on word count - fewer words = bigger fonts
		const minFontSize = maxWords <= 30 ? 14 : maxWords <= 60 ? 12 : 10;
		const maxFontSize = maxWords <= 30 ? 64 : maxWords <= 60 ? 52 : maxWords <= 100 ? 44 : 36;

		// Dynamic grid size - more words need tighter packing
		const gridSize = maxWords <= 50 ? 4 : maxWords <= 100 ? 3 : 2;

		return {
			title: title
				? {
						text: title,
						left: 'center',
						top: 0,
						textStyle: {
							color: themeColors.foreground
						}
					}
				: undefined,
			tooltip: {
			confine: true,
				show: true,
				formatter: (params: unknown) => {
					const p = params as { name: string; value: number };
					return `${p.name}: ${p.value}`;
				}
			},
			series: [
				{
					type: 'wordCloud',
					shape: 'circle',
					left: 'center',
					top: 'center',
					width: '100%',
					height: '100%',
					sizeRange: [minFontSize, maxFontSize],
					rotationRange: [-45, 45],
					rotationStep: 15,
					gridSize: gridSize,
					drawOutOfBound: false,
					textStyle: {
						fontFamily: FONT_FAMILY.sans,
						fontWeight: 'bold',
						color: () => CHART_COLORS[Math.floor(Math.random() * CHART_COLORS.length)]
					},
					emphasis: {
						textStyle: {
							shadowBlur: 10,
							shadowColor: themeColors.foreground
						}
					},
					data: slicedData.map((d) => ({
						name: d.name,
						value: d.value,
						textStyle: {
							color: CHART_COLORS[Math.floor(Math.random() * CHART_COLORS.length)]
						}
					}))
				}
			]
		};
	}

	function initChart() {
		if (!chartContainer) return;

		chartInstance = echarts.init(chartContainer);
		chartInstance.setOption(getOption());

		if (onclick) {
			chartInstance.on('click', (params) => {
				const p = params as { name: string };
				onclick(p.name);
			});
		}

		const resizeObserver = new ResizeObserver(() => {
			chartInstance?.resize();
		});
		resizeObserver.observe(chartContainer);

		return () => {
			resizeObserver.disconnect();
		};
	}

	$effect(() => {
		$theme;
		data;
		maxWords;
		if (chartInstance) {
			chartInstance.setOption(getOption(), true);
		}
	});

	onMount(() => {
		const cleanup = initChart();
		return cleanup;
	});

	onDestroy(() => {
		chartInstance?.dispose();
	});
</script>

<div bind:this={chartContainer} class={cn('w-full h-full min-h-[300px]', className)}></div>
