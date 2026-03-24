<script lang="ts">
	import { base } from '$app/paths';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui';
	import NetworkGraph from './NetworkGraph.svelte';
	import type { NetworkData } from '$lib/types';
	import { Share2, Maximize2, Minimize2 } from '@lucide/svelte';
	import {
		researchItemUrl,
		personUrl,
		subjectUrl,
		tagUrl,
		locationUrl,
		genreUrl,
		institutionUrl
	} from '$lib/utils/urls';

	interface Props {
		entityType: string;
		entityId: string;
		height?: string;
	}

	let { entityType, entityId, height = 'h-chart-2xl' }: Props = $props();

	let graphData: NetworkData | null = $state(null);
	let loading = $state(false);
	let error = $state(false);
	let fullscreen = $state(false);

	// Cache loaded graphs in memory to avoid refetching
	const cache = new Map<string, NetworkData>();

	async function loadGraph(type: string, id: string) {
		if (!id) return;
		const cacheKey = `${type}:${id}`;
		if (cache.has(cacheKey)) {
			graphData = cache.get(cacheKey)!;
			return;
		}

		loading = true;
		error = false;
		try {
			const resp = await fetch(`${base}/data/knowledge_graphs/${encodeURIComponent(id)}.json`);
			if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
			const data: NetworkData = await resp.json();
			cache.set(cacheKey, data);
			graphData = data;
		} catch {
			error = true;
			graphData = null;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadGraph(entityType, entityId);
	});

	function toggleFullscreen() {
		fullscreen = !fullscreen;
		if (fullscreen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
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
				url = `${base}/projects`;
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

{#if fullscreen}
	<!-- Fullscreen overlay -->
	<div class="fixed inset-0 z-50 bg-background flex flex-col">
		<div class="flex items-center justify-between px-4 py-3 border-b border-border">
			<h2 class="text-lg font-semibold flex items-center gap-2">
				<Share2 class="h-5 w-5 text-primary" />
				Knowledge Graph
			</h2>
			<button
				onclick={toggleFullscreen}
				class="p-2 rounded-lg hover:bg-muted transition-colors"
				aria-label="Exit fullscreen"
			>
				<Minimize2 class="h-5 w-5" />
			</button>
		</div>
		<div class="flex-1">
			{#if graphData}
				<NetworkGraph
					data={graphData}
					onclick={handleNodeClick}
					forceConfig={{ repulsion: 300, gravity: 0.05, edgeLength: [100, 250], friction: 0.3, layoutAnimation: false }}
					class="w-full h-full"
				/>
			{/if}
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
								Knowledge Graph
							</span>
						{/snippet}
					</CardTitle>
					{#if graphData}
						<button
							onclick={toggleFullscreen}
							class="p-2 rounded-lg hover:bg-muted transition-colors"
							aria-label="Fullscreen"
						>
							<Maximize2 class="h-4 w-4 text-muted-foreground" />
						</button>
					{/if}
				</div>
				<p class="text-xs text-muted-foreground mt-1">
					Click a node to navigate. Drag to rearrange, scroll to zoom.
				</p>
			{/snippet}
		</CardHeader>
		<CardContent>
			{#snippet children()}
				{#if loading}
					<div class="flex items-center justify-center {height}">
						<p class="text-sm text-muted-foreground animate-pulse">Loading knowledge graph...</p>
					</div>
				{:else if error || !graphData}
					<div class="flex items-center justify-center {height}">
						<p class="text-sm text-muted-foreground">No knowledge graph available</p>
					</div>
				{:else}
					<div class={height}>
						<NetworkGraph
							data={graphData}
							onclick={handleNodeClick}
							forceConfig={{ repulsion: 200, gravity: 0.08, edgeLength: [80, 200], friction: 0.3, layoutAnimation: false }}
							class="w-full h-full"
						/>
					</div>
				{/if}
			{/snippet}
		</CardContent>
	{/snippet}
</Card>
