<script lang="ts">
	import EChart from './EChart.svelte';
	import { echarts } from '$lib/utils/echarts';
	import { GraphChart } from 'echarts/charts';
	import { TitleComponent, TooltipComponent, LegendComponent } from 'echarts/components';
	import type { EChartsOption } from 'echarts';
	import type { NetworkData, NetworkLink, NetworkNode } from '$lib/types';
	import { cn } from '$lib/utils/cn';
	import { CHART_COLORS, THEME_COLORS, legendTextStyle } from '$lib/styles';
	import { theme } from '$lib/stores/data';
	import { buildTitle, hideAxes } from './utils';

	echarts.use([GraphChart, TitleComponent, TooltipComponent, LegendComponent]);

	interface Props {
		data: NetworkData;
		title?: string;
		class?: string;
		onclick?: (id: string, category: number) => void;
		forceConfig?: {
			repulsion?: number;
			gravity?: number;
			edgeLength?: [number, number];
			friction?: number;
			layoutAnimation?: boolean;
		};
		/**
		 * Show community halo behind each node (coloured by `cluster`).
		 * Off by default because it can overwhelm when clusters and
		 * categories compete for attention.
		 */
		showCommunityHalo?: boolean;
		/** Hide edges with value below this threshold. */
		minEdgeValue?: number;
		/** Only show edges of this relation type. `undefined` = both. */
		relationFilter?: 'direct' | 'latent' | undefined;
		/** Only show nodes whose category is in this set. Empty set = all. */
		categoryFilter?: Set<number>;
		/** Only show nodes whose cluster is in this set. Empty set = all. */
		clusterFilter?: Set<number>;
	}

	let {
		data,
		title = '',
		class: className = '',
		onclick,
		forceConfig,
		showCommunityHalo = false,
		minEdgeValue = 0,
		relationFilter = undefined,
		categoryFilter,
		clusterFilter
	}: Props = $props();

	let isDark = $derived($theme === 'dark');
	let labelColor = $derived(isDark ? THEME_COLORS.dark.chartText : THEME_COLORS.light.chartText);
	let legendStyle = $derived(legendTextStyle(isDark));

	// Palette used for community halos. Independent from category colours so
	// the two layers (entity-type vs discursive-mode) don't collide visually.
	const CLUSTER_PALETTE = [
		'#6366f1',
		'#14b8a6',
		'#f59e0b',
		'#ec4899',
		'#84cc16',
		'#0ea5e9',
		'#a855f7',
		'#f43f5e',
		'#22c55e',
		'#eab308'
	];

	function clusterColor(cid: number | undefined): string | undefined {
		if (cid === undefined || cid < 0) return undefined;
		return CLUSTER_PALETTE[cid % CLUSTER_PALETTE.length];
	}

	// Facet-filter the nodes + edges before handing them to ECharts. Computing
	// once here keeps the chart option tree simple.
	let filteredNodes = $derived.by(() => {
		const catSet = categoryFilter && categoryFilter.size > 0 ? categoryFilter : null;
		const cluSet = clusterFilter && clusterFilter.size > 0 ? clusterFilter : null;
		return data.nodes.filter((n) => {
			if (catSet && !catSet.has(n.category)) return false;
			if (cluSet && !cluSet.has(n.cluster ?? -1)) return false;
			return true;
		});
	});

	let visibleIds = $derived(new Set(filteredNodes.map((n) => n.id)));

	let filteredLinks = $derived.by(() => {
		return data.links.filter((link) => {
			const value = link.value ?? 1;
			if (value < minEdgeValue) return false;
			if (relationFilter && link.relation !== relationFilter) return false;
			const source = typeof link.source === 'string' ? link.source : '';
			const target = typeof link.target === 'string' ? link.target : '';
			if (!visibleIds.has(source) || !visibleIds.has(target)) return false;
			return true;
		});
	});

	function describeNode(node: NetworkNode): string {
		const catIdx = node.category ?? -1;
		const catName =
			catIdx >= 0 && catIdx < data.categories.length ? data.categories[catIdx].name : '';
		const parts: string[] = [];
		if (catName) parts.push(`<b>${catName}</b>`);
		parts.push(node.name);
		if (node.importance !== undefined && node.importance > 0.1) {
			parts.push(
				`<span style="opacity:0.7">centrality ${(node.importance * 100).toFixed(0)}%</span>`
			);
		}
		if (node.cluster !== undefined && node.cluster >= 0 && data.clusters) {
			const cluster = data.clusters.find((c) => c.id === node.cluster);
			if (cluster) {
				const dot = clusterColor(node.cluster);
				parts.push(
					`<span style="opacity:0.7">community: <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dot};vertical-align:middle"></span> ${cluster.label}</span>`
				);
			}
		}
		return parts.join('<br/>');
	}

	function describeEdge(link: NetworkLink & { custom_label?: string }): string {
		const labelText = link.custom_label ?? link.label;
		const bits: string[] = [];
		if (typeof labelText === 'string' && labelText) {
			bits.push(`<span style="font-style:italic">${labelText}</span>`);
		}
		if (link.relation === 'latent') {
			bits.push('<span style="opacity:0.6">latent / structural</span>');
		}
		if (link.value !== undefined) {
			bits.push(`<span style="opacity:0.6">weight ${link.value.toFixed(2)}</span>`);
		}
		return bits.join('<br/>');
	}

	function graphTooltipFormatter(params: Record<string, unknown>): string {
		if (params.dataType === 'edge') {
			return describeEdge(params.data as NetworkLink);
		}
		const d = params.data as NetworkNode | undefined;
		if (d) return describeNode(d);
		return (params.name as string) ?? '';
	}

	// Build ECharts series data with per-node styling. Node colour follows the
	// category palette (entity type). Cluster membership shows up as a halo
	// via border colour so the two signals don't fight.
	let seriesNodes = $derived.by(() => {
		return filteredNodes.map((node) => {
			const baseColor = CHART_COLORS[node.category % CHART_COLORS.length];
			const halo = showCommunityHalo ? clusterColor(node.cluster) : undefined;
			return {
				...node,
				itemStyle: {
					color: baseColor,
					borderColor: halo ?? 'transparent',
					borderWidth: halo ? 2.5 : 0
				}
			};
		});
	});

	// Styling per edge: latent edges use a dashed line, direct edges solid.
	// Width scales with the stored `value` so the strongest edges pop. We
	// strip the custom `label` (a plain string in our schema) before handing
	// the link to ECharts, since ECharts reserves `label` for its own rendering
	// config object and would reject the string; the tooltip formatter reads
	// our label off the original link data via `data.custom_label`.
	let seriesLinks = $derived.by(() => {
		return filteredLinks.map((link) => {
			const value = link.value ?? 1;
			const width = Math.min(6, Math.max(0.8, Math.sqrt(value) * 1.2));
			const isLatent = link.relation === 'latent';
			const { label, ...rest } = link;
			return {
				...rest,
				custom_label: label,
				lineStyle: {
					width,
					opacity: isLatent ? 0.45 : 0.7,
					type: isLatent ? ('dashed' as const) : ('solid' as const),
					curveness: isLatent ? 0.15 : 0.25
				}
			};
		});
	});

	let option: EChartsOption = $derived({
		...buildTitle(title),
		tooltip: {
			confine: true,
			trigger: 'item',
			formatter: graphTooltipFormatter as unknown as string
		},
		...hideAxes(),
		legend: {
			data: data.categories.map((c) => c.name),
			orient: 'vertical',
			left: 'left',
			top: 'middle',
			textStyle: { ...legendStyle }
		},
		animationDuration: 1500,
		animationEasingUpdate: 'quinticInOut',
		series: [
			{
				name: 'Network',
				type: 'graph',
				layout: 'force',
				data: seriesNodes,
				links: seriesLinks,
				categories: data.categories.map((c, i) => ({
					name: c.name,
					itemStyle: {
						color: CHART_COLORS[i % CHART_COLORS.length]
					}
				})),
				roam: true,
				label: {
					show: true,
					position: 'right',
					formatter: '{b}',
					fontSize: 10,
					color: labelColor
				},
				labelLayout: {
					hideOverlap: true
				},
				force: {
					repulsion: forceConfig?.repulsion ?? 120,
					gravity: forceConfig?.gravity ?? 0.1,
					edgeLength: forceConfig?.edgeLength ?? [50, 160],
					friction: forceConfig?.friction ?? 0.6,
					layoutAnimation: forceConfig?.layoutAnimation ?? true
				},
				lineStyle: {
					color: 'source',
					curveness: 0.25,
					opacity: 0.55
				},
				emphasis: {
					focus: 'adjacency',
					lineStyle: {
						width: 3
					}
				}
			}
		]
	});

	function handleClick(params: unknown) {
		const p = params as { data: { id: string; category: number } };
		if (onclick && p.data) {
			onclick(p.data.id, p.data.category);
		}
	}
</script>

<EChart {option} class={cn(className)} onclick={handleClick} />
