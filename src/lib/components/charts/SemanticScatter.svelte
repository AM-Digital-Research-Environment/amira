<script lang="ts">
	import EChart from './EChart.svelte';
	import { echarts } from '$lib/utils/echarts';
	import { ScatterChart } from 'echarts/charts';
	import {
		TitleComponent,
		TooltipComponent,
		GridComponent,
		LegendComponent,
		DataZoomComponent
	} from 'echarts/components';
	import type { EChartsOption } from 'echarts';
	import { cn } from '$lib/utils/cn';
	import { CHART_COLORS_EXTENDED, getMarkerBorderColor } from '$lib/styles';
	import { theme } from '$lib/stores/data';
	import { SvelteMap } from 'svelte/reactivity';
	import type { SemanticMapItem } from '$lib/types';

	echarts.use([
		ScatterChart,
		TitleComponent,
		TooltipComponent,
		GridComponent,
		LegendComponent,
		DataZoomComponent
	]);

	export type ColorBy = 'university' | 'project' | 'typeOfResource';

	interface Props {
		items: SemanticMapItem[];
		colorBy?: ColorBy;
		selectedId?: string | null;
		class?: string;
		onSelect?: (id: string | null) => void;
	}

	let {
		items,
		colorBy = 'university',
		selectedId = null,
		class: className = '',
		onSelect
	}: Props = $props();

	let isDark = $derived($theme === 'dark');
	let markerBorder = $derived(getMarkerBorderColor(isDark));

	/**
	 * Compute axis bounds at a given percentile of the data (plus a small pad)
	 * so a handful of UMAP outliers don't stretch the plot area and leave 30%
	 * of the chart empty. 1st/99th percentile keeps ~98% of points comfortably
	 * inside while still letting the user scroll-zoom out if they want.
	 */
	function percentile(sorted: number[], p: number): number {
		if (sorted.length === 0) return 0;
		const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
		return sorted[idx];
	}

	let axisBounds = $derived.by(() => {
		if (items.length === 0) {
			return { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
		}
		const xs = items.map((i) => i.x).sort((a, b) => a - b);
		const ys = items.map((i) => i.y).sort((a, b) => a - b);
		const xLo = percentile(xs, 0.01);
		const xHi = percentile(xs, 0.99);
		const yLo = percentile(ys, 0.01);
		const yHi = percentile(ys, 0.99);
		// 3% pad on each side so points don't kiss the edge
		const xPad = (xHi - xLo) * 0.03 || 1;
		const yPad = (yHi - yLo) * 0.03 || 1;
		return { xMin: xLo - xPad, xMax: xHi + xPad, yMin: yLo - yPad, yMax: yHi + yPad };
	});

	function bucketKey(item: SemanticMapItem, field: ColorBy): string {
		const val = item[field];
		if (!val) return 'Other';
		if (field === 'university') return val.toUpperCase();
		return val;
	}

	// Stable bucket ordering (largest first) so the legend and colours don't
	// jitter when items change.
	let buckets = $derived.by(() => {
		const counts = new SvelteMap<string, number>();
		for (const item of items) {
			const k = bucketKey(item, colorBy);
			counts.set(k, (counts.get(k) ?? 0) + 1);
		}
		return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
	});

	let colorFor = $derived.by(() => {
		const map = new SvelteMap<string, string>();
		buckets.forEach((b, i) => {
			map.set(b, CHART_COLORS_EXTENDED[i % CHART_COLORS_EXTENDED.length]);
		});
		return map;
	});

	// ECharts needs one series per legend entry. We group items into a series
	// per bucket, which also lets users toggle visibility by clicking the
	// legend — far better UX than a single series with per-point colours.
	let series = $derived.by(() => {
		const grouped = new SvelteMap<string, SemanticMapItem[]>();
		for (const item of items) {
			const k = bucketKey(item, colorBy);
			const arr = grouped.get(k) ?? [];
			arr.push(item);
			grouped.set(k, arr);
		}
		return buckets.map((bucket) => {
			const bucketItems = grouped.get(bucket) ?? [];
			return {
				type: 'scatter' as const,
				name: bucket,
				data: bucketItems.map((item) => ({
					value: [item.x, item.y],
					id: item.id,
					name: item.title || 'Untitled',
					itemStyle: {
						opacity: item.lowSignal ? 0.25 : 0.8,
						borderColor: markerBorder,
						borderWidth: item.id === selectedId ? 2 : 0.5
					},
					symbolSize: item.id === selectedId ? 14 : 6,
					_project: item.projectName ?? item.project ?? null,
					_type: item.typeOfResource ?? null,
					_university: item.university ?? null,
					_lowSignal: item.lowSignal,
					_inputChars: item.inputChars
				})),
				itemStyle: { color: colorFor.get(bucket) ?? CHART_COLORS_EXTENDED[0] },
				// `large: true` + low threshold puts every bucket on the fast
				// batch-rendered path, which is what makes panning feel smooth
				// with ~4k total points spread across several series.
				large: true,
				largeThreshold: 100,
				progressive: 0,
				animation: false,
				emphasis: {
					focus: 'series' as const,
					scale: 1.4,
					itemStyle: { borderColor: markerBorder, borderWidth: 1.5 }
				}
			};
		});
	});

	let option: EChartsOption = $derived({
		animation: false,
		hoverLayerThreshold: Infinity,
		grid: { left: 12, right: 12, top: 12, bottom: 48, containLabel: false },
		// Axes must have type: 'value' for a numeric scatter, but we hide the
		// lines, ticks, and labels -- UMAP coordinates have no interpretable
		// units so showing axis scales would mislead. We clamp min/max to the
		// 1st/99th percentile of the data so a few UMAP outliers don't leave
		// 30% of the canvas empty.
		xAxis: {
			show: false,
			type: 'value',
			min: axisBounds.xMin,
			max: axisBounds.xMax,
			splitLine: { show: false }
		},
		yAxis: {
			show: false,
			type: 'value',
			min: axisBounds.yMin,
			max: axisBounds.yMax,
			splitLine: { show: false }
		},
		tooltip: {
			trigger: 'item',
			confine: true,
			formatter: (params: unknown) => {
				const p = params as {
					data?: {
						name?: string;
						_project?: string | null;
						_type?: string | null;
						_university?: string | null;
						_lowSignal?: boolean;
						_inputChars?: number;
					};
				};
				const d = p.data;
				if (!d) return '';
				const lines: string[] = [
					`<div style="max-width: 280px; white-space: normal;"><strong>${escapeHtml(d.name ?? 'Untitled')}</strong>`
				];
				if (d._project) lines.push(`<div>Project: ${escapeHtml(d._project)}</div>`);
				if (d._type) lines.push(`<div>Type: ${escapeHtml(d._type)}</div>`);
				if (d._university)
					lines.push(`<div>University: ${escapeHtml(d._university.toUpperCase())}</div>`);
				if (d._lowSignal)
					lines.push(
						`<div style="opacity:.8;font-style:italic;margin-top:4px;">Low-signal (${d._inputChars ?? 0} chars)</div>`
					);
				lines.push('</div>');
				return lines.join('');
			}
		},
		legend: {
			type: 'scroll',
			bottom: 0,
			icon: 'circle',
			data: buckets,
			textStyle: { color: 'inherit' }
		},
		// Two inside dataZooms, one per axis. ECharts routes mouse drag and
		// wheel to both, so the user can pan AND zoom in both directions
		// (previously only x panned because both entries declared both axes,
		// which confuses the dispatch).
		dataZoom: [
			{
				type: 'inside',
				xAxisIndex: 0,
				filterMode: 'none',
				zoomOnMouseWheel: true,
				moveOnMouseMove: true,
				moveOnMouseWheel: false
			},
			{
				type: 'inside',
				yAxisIndex: 0,
				filterMode: 'none',
				zoomOnMouseWheel: true,
				moveOnMouseMove: true,
				moveOnMouseWheel: false
			}
		],
		series
	});

	function escapeHtml(s: string): string {
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function handleClick(params: unknown) {
		const p = params as { data?: { id?: string } };
		const id = p.data?.id ?? null;
		if (id) onSelect?.(id);
	}
</script>

<div class={cn('h-full w-full', className)}>
	<EChart {option} class="h-full w-full" onclick={handleClick} showZoomControls={true} />
</div>
