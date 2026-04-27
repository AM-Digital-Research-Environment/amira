<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { echarts } from '$lib/utils/echarts';
	import { CanvasRenderer } from 'echarts/renderers';
	import type { EChartsType } from 'echarts/core';
	import type { EChartsOption } from 'echarts';
	import { theme } from '$lib/stores/data';
	import { cn } from '$lib/utils/cn';
	import { getEChartsTheme, ECHARTS_PERFORMANCE } from '$lib/styles';
	import { ZoomIn, ZoomOut, RotateCcw } from '@lucide/svelte';
	import { getChartRegistry } from './chart-registry';

	// Every chart routed through this wrapper needs the canvas renderer.
	// Series & feature components are registered by the individual chart
	// modules so the bundler can drop ones the current page doesn't use.
	echarts.use([CanvasRenderer]);

	interface Props {
		option: EChartsOption;
		class?: string;
		showZoomControls?: boolean;
		onclick?: (params: unknown) => void;
		/** Enable large dataset optimizations (auto-detected if not specified) */
		largeData?: boolean;
		/** Enable progressive rendering for very large datasets */
		progressive?: boolean;
		/** Whether to replace the entire option (true) or merge (false) */
		notMerge?: boolean;
	}

	let {
		option,
		class: className = '',
		showZoomControls = true,
		onclick,
		largeData,
		progressive,
		notMerge = false
	}: Props = $props();

	let chartContainer: HTMLDivElement;
	let chartInstance: EChartsType | null = null;
	let zoomLevel = $state(1);
	let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
	let initRaf: number | null = null;
	let resizeObserver: ResizeObserver | null = null;
	// Parent ChartCard (if any) exposes a registry so its header can wire a
	// download button to this chart without the page passing the instance
	// through props.
	const chartRegistry = getChartRegistry();

	/**
	 * Count total data points in the option to determine if large mode is needed
	 */
	function countDataPoints(opt: EChartsOption): number {
		let count = 0;
		const series = opt.series;

		if (Array.isArray(series)) {
			for (const s of series) {
				if (s && typeof s === 'object' && 'data' in s && Array.isArray(s.data)) {
					count += s.data.length;
				}
			}
		} else if (
			series &&
			typeof series === 'object' &&
			'data' in series &&
			Array.isArray(series.data)
		) {
			count += series.data.length;
		}

		return count;
	}

	/**
	 * Apply performance optimizations based on data size
	 */
	function applyPerformanceOptimizations(opt: EChartsOption): EChartsOption {
		const dataCount = countDataPoints(opt);
		const isLargeData = largeData ?? dataCount >= ECHARTS_PERFORMANCE.LARGE_DATASET_THRESHOLD;
		const useProgressive = progressive ?? dataCount >= ECHARTS_PERFORMANCE.PROGRESSIVE_THRESHOLD;

		if (!isLargeData) {
			return opt;
		}

		const performanceOpts: Partial<EChartsOption> = {
			animation: !useProgressive
		};

		if (useProgressive) {
			performanceOpts.progressive = ECHARTS_PERFORMANCE.PROGRESSIVE_CHUNK_SIZE;
			performanceOpts.progressiveThreshold = ECHARTS_PERFORMANCE.PROGRESSIVE_THRESHOLD;
		}

		// Apply large mode to series
		if (Array.isArray(opt.series)) {
			performanceOpts.series = opt.series.map((s) => {
				if (s && typeof s === 'object') {
					return {
						...s,
						large: true,
						largeThreshold: ECHARTS_PERFORMANCE.LARGE_DATASET_THRESHOLD
					};
				}
				return s;
			});
		}

		return { ...opt, ...performanceOpts };
	}

	/**
	 * Throttled resize handler. Coalescing through setTimeout already
	 * collapses bursty ResizeObserver callbacks; the resize() call itself
	 * is the layout-querying step we want to defer off the synchronous
	 * observer callback so it doesn't force a reflow on the same frame
	 * that mutated the DOM.
	 */
	function handleResize() {
		if (resizeTimeout) {
			clearTimeout(resizeTimeout);
		}
		resizeTimeout = setTimeout(() => {
			chartInstance?.resize();
		}, ECHARTS_PERFORMANCE.RESIZE_THROTTLE_MS);
	}

	function initChart() {
		if (!chartContainer) return;

		chartInstance = echarts.init(chartContainer);
		applyTheme();
		updateChart();

		if (onclick) {
			chartInstance.on('click', onclick);
		}

		// First-wins: when a host (e.g. EntityKnowledgeGraph) renders two
		// NetworkGraphs simultaneously (inline + fullscreen portal), the
		// first to mount claims the registry so the header button keeps
		// pointing at the always-mounted inline chart.
		if (chartRegistry && !chartRegistry.instance) {
			chartRegistry.instance = chartInstance;
		}

		// Handle resize with throttling via ResizeObserver
		resizeObserver = new ResizeObserver(handleResize);
		resizeObserver.observe(chartContainer);
	}

	/**
	 * Apply theme using ECharts 6 setTheme() for dynamic theme switching
	 * without needing to dispose/reinit the chart instance.
	 */
	function applyTheme() {
		if (!chartInstance) return;
		const themeConfig = getEChartsTheme($theme === 'dark');
		// ECharts 6: setTheme allows runtime theme changes
		if (typeof chartInstance.setTheme === 'function') {
			chartInstance.setTheme(themeConfig);
		}
	}

	function updateChart() {
		if (!chartInstance) return;

		const optimizedOption = applyPerformanceOptimizations(option);

		// Merge a SUBSET of the theme into the option — specifically the
		// `tooltip` defaults, since ECharts 6's `setTheme()` does not
		// propagate `theme.tooltip` styling onto the floating tooltip DOM
		// (it stays white in dark mode otherwise). Other theme keys
		// (`legend`, `title`, axes, colors) continue to flow through
		// `setTheme()` and don't need merging here — and crucially we must
		// NOT merge `legend` from the theme into every option, or charts
		// that never declared a legend (e.g. heatmap) would suddenly grow
		// one because LegendComponent is registered globally by other
		// chart modules. Per-chart `tooltip` overrides still win because
		// the option's keys overwrite the theme's during the deep merge.
		const themeConfig = getEChartsTheme($theme === 'dark');
		const tooltipBase = { tooltip: echarts.util.clone(themeConfig.tooltip) };
		const mergedOption = echarts.util.merge(tooltipBase, optimizedOption, true);
		chartInstance.setOption(mergedOption, notMerge);
	}

	// React to theme changes — use setTheme for ECharts 6 dynamic switching
	$effect(() => {
		$theme; // subscribe to theme
		applyTheme();
		updateChart();
	});

	// React to option changes
	$effect(() => {
		option; // subscribe to option
		updateChart();
	});

	onMount(() => {
		// Defer init off the mount task so the browser can finish painting
		// the surrounding layout (page header, stat cards, etc.) before
		// ECharts queries `offsetWidth`/`offsetHeight` and forces a reflow.
		// Multiple charts that mount in the same tick all wait until the
		// next animation frame, batching their layout reads together.
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
		if (chartRegistry && chartRegistry.instance === chartInstance) {
			chartRegistry.instance = null;
		}
		chartInstance?.dispose();
		chartInstance = null;
	});

	function zoomIn() {
		if (!chartInstance) return;
		zoomLevel = Math.min(zoomLevel * 1.2, 5);
		applyZoom();
	}

	function zoomOut() {
		if (!chartInstance) return;
		zoomLevel = Math.max(zoomLevel / 1.2, 0.5);
		applyZoom();
	}

	function resetZoom() {
		if (!chartInstance) return;
		zoomLevel = 1;
		applyZoom();
		// Also reset dataZoom if present
		chartInstance.dispatchAction({
			type: 'dataZoom',
			start: 0,
			end: 100
		});
	}

	function applyZoom() {
		if (!chartInstance) return;
		const currentOption = chartInstance.getOption();
		const seriesType = (currentOption?.series as { type: string }[])?.[0]?.type;

		// `graph` has built-in roam — let ECharts apply the zoom natively so
		// labels/edges stay sharp. The dispatched action plays nicely with
		// drag/pan.
		if (seriesType === 'graph') {
			chartInstance.setOption({
				series: [{ zoom: zoomLevel, center: ['50%', '50%'] }]
			});
			return;
		}

		// Sunburst / sankey / treemap / tree don't expose a `zoom` series option
		// (ECharts ignores it silently — that was the bug). Apply a CSS
		// transform to the canvas instead. We anchor on the centre so the
		// chart grows from the middle, and let the surrounding container's
		// `overflow-hidden` clip anything that runs past the card.
		if (['sunburst', 'sankey', 'treemap', 'tree'].includes(seriesType)) {
			applyCssZoom();
			return;
		}

		// Cartesian / time-series — use dataZoom which actually changes the
		// visible window rather than scaling pixels.
		const zoomStart = Math.max(0, 50 - 50 / zoomLevel);
		const zoomEnd = Math.min(100, 50 + 50 / zoomLevel);
		chartInstance.dispatchAction({
			type: 'dataZoom',
			start: zoomStart,
			end: zoomEnd
		});
	}

	function applyCssZoom() {
		if (!chartContainer) return;
		const inner = chartContainer.firstElementChild as HTMLElement | null;
		const target = inner ?? chartContainer;
		target.style.transformOrigin = 'center center';
		target.style.transform = zoomLevel === 1 ? '' : `scale(${zoomLevel})`;
		target.style.transition = 'transform 120ms ease-out';
	}
</script>

<div class={cn('relative w-full h-full min-w-0 max-w-full overflow-hidden', className)}>
	<div bind:this={chartContainer} class="w-full h-full min-w-0 max-w-full"></div>

	{#if showZoomControls}
		<div class="absolute top-2 right-2 flex flex-col gap-1 z-10">
			<button
				type="button"
				onclick={zoomIn}
				class="w-8 h-8 flex items-center justify-center rounded bg-secondary/80 hover:bg-secondary text-secondary-foreground transition-colors backdrop-blur-sm"
				title="Zoom in"
			>
				<ZoomIn class="w-4 h-4" />
			</button>
			<button
				type="button"
				onclick={zoomOut}
				class="w-8 h-8 flex items-center justify-center rounded bg-secondary/80 hover:bg-secondary text-secondary-foreground transition-colors backdrop-blur-sm"
				title="Zoom out"
			>
				<ZoomOut class="w-4 h-4" />
			</button>
			<button
				type="button"
				onclick={resetZoom}
				class="w-8 h-8 flex items-center justify-center rounded bg-secondary/80 hover:bg-secondary text-secondary-foreground transition-colors backdrop-blur-sm"
				title="Reset zoom"
			>
				<RotateCcw class="w-4 h-4" />
			</button>
		</div>
	{/if}
</div>
