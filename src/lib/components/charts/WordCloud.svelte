<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { echarts } from '$lib/utils/echarts';
	import { CanvasRenderer } from 'echarts/renderers';
	import { TitleComponent, TooltipComponent } from 'echarts/components';
	import 'echarts-wordcloud';
	import type { EChartsType } from 'echarts/core';
	import type { WordCloudDataPoint } from '$lib/types';
	import { theme } from '$lib/stores/data';
	import { cn } from '$lib/utils/cn';
	import { CHART_COLORS, FONT_FAMILY, getEChartsTheme, getThemeColors } from '$lib/styles';

	// echarts-wordcloud registers its own series; we just need the renderer + components.
	echarts.use([CanvasRenderer, TitleComponent, TooltipComponent]);

	interface Props {
		data: WordCloudDataPoint[];
		title?: string;
		class?: string;
		maxWords?: number;
		onclick?: (word: string) => void;
	}

	let { data, title = '', class: className = '', maxWords = 100, onclick }: Props = $props();

	let chartContainer: HTMLDivElement;
	let chartInstance: EChartsType | null = null;
	let initRaf: number | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

	function getOption() {
		const slicedData = data.slice(0, maxWords);
		const themeColors = getThemeColors($theme === 'dark');

		// Dynamic font size based on word count - fewer words = bigger fonts.
		// Sizes bumped up for readability.
		const minFontSize = maxWords <= 30 ? 18 : maxWords <= 60 ? 15 : 12;
		const maxFontSize = maxWords <= 30 ? 72 : maxWords <= 60 ? 60 : maxWords <= 100 ? 52 : 44;

		// Dynamic grid size — tighter packing so more words fit without gaps.
		const gridSize = maxWords <= 50 ? 3 : maxWords <= 100 ? 2 : 2;

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
				// Set the tooltip palette inline. echarts-wordcloud renders
				// its own tooltip path that doesn't merge the global theme's
				// tooltip styles, so we have to spell out backgroundColor /
				// borderColor / textStyle here. Without this the tooltip
				// stays white-on-light even in dark mode.
				backgroundColor: themeColors.chartTooltipBg,
				borderColor: themeColors.chartTooltipBorder,
				borderWidth: 1,
				padding: [8, 12],
				textStyle: {
					color: themeColors.chartText,
					fontFamily: FONT_FAMILY.sans,
					fontSize: 12
				},
				extraCssText: 'border-radius: 8px; box-shadow: 0 10px 30px -10px hsl(0 0% 0% / 0.4);',
				formatter: (params: unknown) => {
					const p = params as { name: string; value: number };
					return `${p.name}: ${p.value}`;
				}
			},
			series: [
				{
					type: 'wordCloud',
					// 'pentagon' fills the rectangle more evenly than the default
					// 'circle', which tends to cluster in the middle and leave
					// the top/bottom of wide containers blank. Inset slightly so
					// rotated edge words stay within the card rather than being
					// clipped by its border.
					shape: 'pentagon',
					left: '2%',
					top: '2%',
					width: '96%',
					height: '96%',
					sizeRange: [minFontSize, maxFontSize],
					rotationRange: [-45, 45],
					rotationStep: 15,
					gridSize: gridSize,
					drawOutOfBound: false,
					shrinkToFit: true,
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

	function applyTheme() {
		if (!chartInstance) return;
		const themeConfig = getEChartsTheme($theme === 'dark');
		// ECharts 6: setTheme() lets us swap the tooltip / text palette
		// without disposing the chart. WordCloud previously skipped this
		// call, so its tooltip stayed light-on-light in dark mode.
		if (typeof chartInstance.setTheme === 'function') {
			chartInstance.setTheme(themeConfig);
		}
	}

	function initChart() {
		if (!chartContainer) return;

		chartInstance = echarts.init(chartContainer);
		applyTheme();
		chartInstance.setOption(getOption());

		if (onclick) {
			chartInstance.on('click', (params) => {
				const p = params as { name: string };
				onclick(p.name);
			});
		}

		// Throttle resize callbacks so bursty observer fires don't each
		// trigger a synchronous layout query / render pass.
		resizeObserver = new ResizeObserver(() => {
			if (resizeTimeout) clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => chartInstance?.resize(), 100);
		});
		resizeObserver.observe(chartContainer);
	}

	$effect(() => {
		$theme;
		data;
		maxWords;
		if (chartInstance) {
			applyTheme();
			chartInstance.setOption(getOption(), true);
		}
	});

	onMount(() => {
		// Defer init to next frame so the surrounding layout paints first
		// before ECharts queries `offsetWidth` and forces a reflow.
		initRaf = requestAnimationFrame(() => {
			initRaf = null;
			initChart();
		});
	});

	onDestroy(() => {
		if (initRaf !== null) {
			cancelAnimationFrame(initRaf);
			initRaf = null;
		}
		if (resizeTimeout) {
			clearTimeout(resizeTimeout);
			resizeTimeout = null;
		}
		resizeObserver?.disconnect();
		resizeObserver = null;
		chartInstance?.dispose();
		chartInstance = null;
	});
</script>

<div bind:this={chartContainer} class={cn('w-full h-full min-h-chart-sm', className)}></div>
