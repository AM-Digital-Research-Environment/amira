<script lang="ts">
	import { base } from '$app/paths';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui';
	import NetworkGraph from './NetworkGraph.svelte';
	import ChartDownloadButton from './ChartDownloadButton.svelte';
	import { setChartRegistry, type ChartRegistry } from './chart-registry';
	import type { NetworkData } from '$lib/types';
	import { Share2, Maximize2, Minimize2, Filter, SlidersHorizontal } from '@lucide/svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import {
		researchItemUrl,
		personUrl,
		subjectUrl,
		tagUrl,
		locationUrl,
		genreUrl,
		institutionUrl,
		projectUrl
	} from '$lib/utils/urls';
	import { slugify } from '$lib/utils/slugify';

	type EntityType =
		| 'researchItems'
		| 'items'
		| 'person'
		| 'persons'
		| 'subject'
		| 'subjects'
		| 'tag'
		| 'tags'
		| 'location'
		| 'locations'
		| 'project'
		| 'projects'
		| 'genre'
		| 'genres'
		| 'institution'
		| 'institutions';

	interface Props {
		entityType: EntityType | string;
		entityId: string;
		height?: string;
		/** Label shown in the card header. */
		title?: string;
	}

	let { entityType, entityId, height = 'h-chart-2xl', title = 'Knowledge Graph' }: Props = $props();

	const uid = $props.id();

	// Share the underlying NetworkGraph's ECharts instance with the header
	// download button. NetworkGraph registers into this via EChart.svelte.
	const chartRegistry = $state<ChartRegistry>({ instance: null });
	setChartRegistry(chartRegistry);

	// Map front-end entity-type values to the directory the precompute script
	// writes to. Keeping this mapping in one place avoids a stream of small
	// bugs when a new entity page is wired up.
	const TYPE_DIR: Record<string, string> = {
		researchItems: 'items',
		items: 'items',
		item: 'items',
		person: 'persons',
		persons: 'persons',
		subject: 'subjects',
		subjects: 'subjects',
		tag: 'tags',
		tags: 'tags',
		location: 'locations',
		locations: 'locations',
		project: 'projects',
		projects: 'projects',
		genre: 'genres',
		genres: 'genres',
		institution: 'institutions',
		institutions: 'institutions'
	};

	let graphData = $state<NetworkData | null>(null);
	let loading = $state(false);
	let error = $state(false);
	let fullscreen = $state(false);
	let showFacets = $state(false);

	// Facet state. Kept in $state so the UI stays reactive without forcing a
	// re-fetch.
	let minEdgeValue = $state(0);
	let relationFilter = $state<'all' | 'direct' | 'latent'>('all');
	let hiddenCategories = new SvelteSet<number>();
	let focusedCluster = $state<number | null>(null);
	let showCommunityHalo = $state(true);

	// Cache loaded graphs in memory to avoid refetching
	const cache = new SvelteMap<string, NetworkData | 'error'>();

	async function loadGraph(type: string, id: string) {
		if (!id) return;
		const dir = TYPE_DIR[type] ?? type;
		const slug = dir === 'items' ? id : slugify(id);
		const cacheKey = `${dir}:${slug}`;

		const cached = cache.get(cacheKey);
		if (cached === 'error') {
			error = true;
			graphData = null;
			return;
		}
		if (cached) {
			graphData = cached;
			error = false;
			return;
		}

		loading = true;
		error = false;
		try {
			// Try typed path first (new layout).
			let resp = await fetch(
				`${base}/data/knowledge_graphs/${dir}/${encodeURIComponent(slug)}.json`
			);
			// Fall back to legacy flat layout for items if we ever re-introduce it.
			if (!resp.ok && dir === 'items') {
				resp = await fetch(`${base}/data/knowledge_graphs/${encodeURIComponent(slug)}.json`);
			}
			if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
			const data: NetworkData = await resp.json();
			cache.set(cacheKey, data);
			graphData = data;
		} catch {
			cache.set(cacheKey, 'error');
			error = true;
			graphData = null;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadGraph(entityType, entityId);
	});

	// Reset facet state whenever a new graph loads so we don't carry user
	// selections from one entity to another.
	$effect(() => {
		if (graphData) {
			minEdgeValue = 0;
			relationFilter = 'all';
			hiddenCategories.clear();
			focusedCluster = null;
		}
	});

	let visibleCategories = $derived.by(() => {
		const out = new SvelteSet<number>();
		if (!graphData) return out;
		for (let i = 0; i < graphData.categories.length; i++) {
			if (!hiddenCategories.has(i)) out.add(i);
		}
		return out;
	});

	let visibleClusters = $derived.by(() => {
		const out = new SvelteSet<number>();
		if (focusedCluster !== null) out.add(focusedCluster);
		return out;
	});

	let effectiveRelationFilter = $derived(relationFilter === 'all' ? undefined : relationFilter);

	// Stats for the facet header.
	let nodeCount = $derived(graphData?.nodes.length ?? 0);
	let edgeCount = $derived(graphData?.links.length ?? 0);
	let maxEdgeWeight = $derived.by(() => {
		if (!graphData) return 0;
		let m = 0;
		for (const e of graphData.links) m = Math.max(m, e.value ?? 0);
		return m;
	});

	function toggleFullscreen() {
		fullscreen = !fullscreen;
		if (typeof document !== 'undefined') {
			document.body.style.overflow = fullscreen ? 'hidden' : '';
		}
	}

	function toggleCategory(idx: number) {
		if (hiddenCategories.has(idx)) hiddenCategories.delete(idx);
		else hiddenCategories.add(idx);
	}

	function selectCluster(id: number) {
		focusedCluster = focusedCluster === id ? null : id;
	}

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

	function clusterColor(id: number): string {
		return CLUSTER_PALETTE[id % CLUSTER_PALETTE.length];
	}

	// Portal the fullscreen overlay to <body>. Without this, an ancestor with
	// `transform`, `filter`, `backdrop-filter`, or `will-change` creates a new
	// containing block for `position: fixed` descendants -- so `inset-0` is
	// relative to that ancestor rather than the viewport, and z-index wars are
	// fought inside a parent stacking context that the sticky header/sidebar
	// also participate in. Re-parenting to <body> side-steps both.
	function toBody(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	// Navigate to entity page on node click
	function handleNodeClick(id: string, _category: number) {
		const colonIdx = id.indexOf(':');
		if (colonIdx === -1) return;

		const nodeType = id.substring(0, colonIdx);
		const nodeKey = id.substring(colonIdx + 1);
		let url = '';

		switch (nodeType) {
			case 'item':
				url = researchItemUrl(nodeKey);
				break;
			case 'person':
				url = personUrl(nodeKey);
				break;
			case 'subject':
				url = subjectUrl(nodeKey);
				break;
			case 'tag':
				url = tagUrl(nodeKey);
				break;
			case 'loc':
				url = locationUrl(nodeKey);
				break;
			case 'proj':
				url = projectUrl(nodeKey);
				break;
			case 'genre':
				url = genreUrl(nodeKey);
				break;
			case 'inst':
				url = institutionUrl(nodeKey);
				break;
		}

		if (url) {
			window.location.href = url;
		}
	}
</script>

{#snippet facetPanel()}
	{#if graphData}
		<div class="space-y-4 p-4 rounded-lg border border-border bg-muted/30 text-sm">
			<div class="flex items-center justify-between">
				<span class="font-medium flex items-center gap-1.5">
					<Filter class="h-4 w-4" /> Entity types
				</span>
				<span class="text-xs text-muted-foreground">
					{nodeCount} nodes &middot; {edgeCount} edges
				</span>
			</div>
			<div class="flex flex-wrap gap-1.5">
				{#each graphData.categories as cat, idx (cat.name)}
					{@const active = !hiddenCategories.has(idx)}
					<button
						type="button"
						onclick={() => toggleCategory(idx)}
						class="px-2.5 py-1 rounded-full text-xs border transition-colors {active
							? 'bg-primary/15 border-primary/40 text-foreground'
							: 'bg-background border-border text-muted-foreground'}"
					>
						{cat.name}
					</button>
				{/each}
			</div>

			{#if graphData.clusters && graphData.clusters.length > 0}
				<div class="flex items-center justify-between">
					<span class="font-medium">Discursive communities</span>
					<button
						type="button"
						onclick={() => (focusedCluster = null)}
						class="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
						disabled={focusedCluster === null}
					>
						Show all
					</button>
				</div>
				<div class="flex flex-wrap gap-1.5">
					{#each graphData.clusters as cluster (cluster.id)}
						{@const active = focusedCluster === cluster.id}
						<button
							type="button"
							onclick={() => selectCluster(cluster.id)}
							class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors {active
								? 'border-foreground/60 text-foreground'
								: 'border-border text-muted-foreground hover:text-foreground'}"
							style="background-color:{clusterColor(cluster.id)}22;"
						>
							<span
								class="inline-block w-2.5 h-2.5 rounded-full"
								style="background-color:{clusterColor(cluster.id)}"
							></span>
							{cluster.label}
							<span class="opacity-60">{cluster.count}</span>
						</button>
					{/each}
				</div>
			{/if}

			<div>
				<div class="flex items-center justify-between mb-1.5">
					<span class="font-medium">Edge relation</span>
					<span class="text-xs text-muted-foreground">
						direct = metadata, latent = structural
					</span>
				</div>
				<div class="flex gap-1">
					{#each [{ value: 'all' as const, label: 'All' }, { value: 'direct' as const, label: 'Direct only' }, { value: 'latent' as const, label: 'Latent only' }] as opt (opt.value)}
						{@const active = relationFilter === opt.value}
						<button
							type="button"
							onclick={() => (relationFilter = opt.value)}
							class="px-2.5 py-1 rounded-md text-xs border transition-colors {active
								? 'bg-primary/15 border-primary/40'
								: 'bg-background border-border text-muted-foreground'}"
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>

			<div>
				<div class="flex items-center justify-between mb-1.5">
					<span class="font-medium">
						Minimum edge weight: <span class="font-mono">{minEdgeValue.toFixed(1)}</span>
					</span>
					<label class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
						<input
							id="{uid}-community-halo"
							name="community-halo"
							type="checkbox"
							bind:checked={showCommunityHalo}
							class="rounded border-border accent-primary"
						/>
						Community halo
					</label>
				</div>
				<input
					id="{uid}-min-edge-weight"
					name="min-edge-weight"
					type="range"
					min="0"
					max={Math.max(1, maxEdgeWeight)}
					step="0.1"
					bind:value={minEdgeValue}
					aria-label="Minimum edge weight"
					class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
				/>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet graphBody(inFullscreen: boolean)}
	{#if loading}
		<div class="flex items-center justify-center {inFullscreen ? 'flex-1' : height}">
			<p class="text-sm text-muted-foreground animate-pulse">Loading knowledge graph...</p>
		</div>
	{:else if error || !graphData || graphData.nodes.length === 0}
		<div class="flex items-center justify-center {inFullscreen ? 'flex-1' : height}">
			<p class="text-sm text-muted-foreground">No knowledge graph available</p>
		</div>
	{:else}
		<div class={inFullscreen ? 'flex-1' : height}>
			<NetworkGraph
				data={graphData}
				onclick={handleNodeClick}
				{showCommunityHalo}
				{minEdgeValue}
				relationFilter={effectiveRelationFilter}
				categoryFilter={visibleCategories}
				clusterFilter={visibleClusters}
				nodeSizeScale={0.7}
				forceConfig={{
					repulsion: inFullscreen ? 320 : 200,
					gravity: 0.08,
					edgeLength: inFullscreen ? [110, 240] : [80, 200],
					friction: 0.3,
					layoutAnimation: false
				}}
				class="w-full h-full"
			/>
		</div>
	{/if}
{/snippet}

{#if fullscreen}
	<!-- Fullscreen overlay -- portalled to <body> to escape containing-block traps -->
	<div class="fixed inset-0 z-[100] bg-background flex" use:toBody>
		<aside class="w-80 border-r border-border overflow-y-auto p-4 space-y-4">
			<h2 class="text-lg font-semibold flex items-center gap-2">
				<Share2 class="h-5 w-5 text-primary" />
				{title}
			</h2>
			{@render facetPanel()}
		</aside>
		<div class="flex-1 flex flex-col">
			<div class="flex items-center justify-end px-4 py-3 border-b border-border">
				<button
					onclick={toggleFullscreen}
					class="p-2 rounded-lg hover:bg-muted transition-colors"
					aria-label="Exit fullscreen"
				>
					<Minimize2 class="h-5 w-5" />
				</button>
			</div>
			{@render graphBody(true)}
		</div>
	</div>
{/if}

<Card class="overflow-hidden">
	{#snippet children()}
		<CardHeader>
			{#snippet children()}
				<div class="flex items-center justify-between">
					<CardTitle class="text-lg">
						{#snippet children()}
							<span class="flex items-center gap-2">
								<Share2 class="h-5 w-5 text-primary" />
								{title}
							</span>
						{/snippet}
					</CardTitle>
					{#if graphData}
						<div class="flex items-center gap-1">
							<button
								onclick={() => (showFacets = !showFacets)}
								class="p-2 rounded-lg hover:bg-muted transition-colors {showFacets
									? 'bg-muted'
									: ''}"
								aria-label="Toggle facets"
								aria-pressed={showFacets}
							>
								<SlidersHorizontal class="h-4 w-4 text-muted-foreground" />
							</button>
							{#if chartRegistry.instance}
								<ChartDownloadButton
									getChart={() => chartRegistry.instance}
									filename={title}
									{title}
									subtitle="{nodeCount} nodes · {edgeCount} edges"
								/>
							{/if}
							<button
								onclick={toggleFullscreen}
								class="p-2 rounded-lg hover:bg-muted transition-colors"
								aria-label="Fullscreen"
							>
								<Maximize2 class="h-4 w-4 text-muted-foreground" />
							</button>
						</div>
					{/if}
				</div>
				<div class="text-xs text-muted-foreground mt-1 space-y-0.5 leading-relaxed">
					<p>
						Nodes are entities in the archive (items, people, subjects, projects,
						institutions&hellip;). Click any node to navigate to its page.
					</p>
					<p>
						<span class="font-medium text-foreground">Solid edges</span> are direct metadata links
						(e.g. "has subject", "contributor").
						<span class="font-medium text-foreground">Dashed edges</span> are latent ties surfaced by
						structural similarity &mdash; two entities that share a neighbourhood without sharing an explicit
						tag.
					</p>
					<p>
						<span class="font-medium text-foreground">Node size</span> reflects how central the
						entity is across the whole archive (PageRank).
						<span class="font-medium text-foreground">Halo colour</span> marks its
						<span class="font-medium text-foreground">community</span> &mdash; a cluster of entities that
						are densely inter-connected, which we read as a recurring "discursive mode" in how the archive
						organises meaning (Louvain community detection).
					</p>
				</div>
			{/snippet}
		</CardHeader>
		<CardContent>
			{#snippet children()}
				{#if showFacets}
					<div class="mb-4">
						{@render facetPanel()}
					</div>
				{/if}
				{@render graphBody(false)}
			{/snippet}
		</CardContent>
	{/snippet}
</Card>
