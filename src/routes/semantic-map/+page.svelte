<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		Sparkles,
		FileText,
		AlertCircle,
		ExternalLink,
		Briefcase,
		ArrowRight
	} from '@lucide/svelte';
	import SEO from '$lib/components/ui/seo.svelte';
	import StatCard from '$lib/components/ui/stat-card.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import CardContent from '$lib/components/ui/card-content.svelte';
	import Badge from '$lib/components/ui/badge.svelte';
	import EmptyState from '$lib/components/ui/empty-state.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Callout from '$lib/components/ui/callout.svelte';
	import { SemanticScatter } from '$lib/components/charts';
	import type { ColorBy } from '$lib/components/charts/SemanticScatter.svelte';
	import { loadSemanticMap, loadSimilarItems } from '$lib/utils/loaders';
	import { allCollections, ensureCollections } from '$lib/stores/data';
	import { researchItemUrl } from '$lib/utils/urls';
	import { universities } from '$lib/types';
	import type {
		CollectionItem,
		SemanticMapData,
		SemanticMapItem,
		SimilarItemsData
	} from '$lib/types';
	import { SvelteMap, SvelteSet, SvelteURLSearchParams } from 'svelte/reactivity';

	let mapData = $state<SemanticMapData | null>(null);
	let similarData = $state<SimilarItemsData | null>(null);
	let loading = $state(true);
	let loadFailed = $state(false);
	// Tracks the in-flight fetch for similar.json so concurrent clicks don't
	// kick off duplicate requests, and so the panel can show a loading state
	// while the ~2.4 MB payload is on the wire.
	let similarPromise = $state<Promise<SimilarItemsData | null> | null>(null);
	let similarLoading = $state(false);

	let colorBy = $state<ColorBy>('university');
	let universityFilter = $state('all');
	let searchQuery = $state('');
	let selectedId = $state<string | null>(null);

	// Sync selection from ?id= query param so the page is linkable.
	$effect(() => {
		const urlId = $page.url.searchParams.get('id');
		if (urlId && urlId !== selectedId) selectedId = urlId;
	});

	function setSelected(id: string | null) {
		selectedId = id;
		const params = new SvelteURLSearchParams($page.url.searchParams);
		if (id) params.set('id', id);
		else params.delete('id');
		const qs = params.toString();
		const href = `${$page.url.pathname}${qs ? `?${qs}` : ''}`;
		goto(href, { replaceState: true, keepFocus: true, noScroll: true });
	}

	onMount(async () => {
		void ensureCollections(base);
		// Only load map.json up-front; similar.json (~2.4 MB) is deferred
		// until the first item is selected so the scatter renders sooner.
		try {
			mapData = await loadSemanticMap(base);
			if (!mapData) loadFailed = true;
		} catch {
			loadFailed = true;
		} finally {
			loading = false;
		}
	});

	async function ensureSimilar() {
		if (similarData) return similarData;
		if (similarPromise) return similarPromise;
		similarLoading = true;
		similarPromise = loadSimilarItems(base)
			.then((s) => {
				similarData = s;
				return s;
			})
			.finally(() => {
				similarLoading = false;
			});
		return similarPromise;
	}

	// Kick off the similar.json fetch the first time the user selects an item
	// (and on deep-links arriving with ?id=... in the URL).
	$effect(() => {
		if (selectedId) void ensureSimilar();
	});

	// Quick lookup from collection items by dre_id → CollectionItem.
	let collectionsById = $derived.by(() => {
		const map = new SvelteMap<string, CollectionItem>();
		for (const item of $allCollections) {
			const id = item.dre_id || item._id;
			if (id) map.set(id, item);
		}
		return map;
	});

	let universityOpts = $derived([
		{ value: 'all', label: 'All universities + external' },
		...universities.map((u) => ({ value: u.id, label: `${u.name} (${u.code})` })),
		{ value: 'external', label: 'External sources' }
	]);

	let colorByOpts = [
		{ value: 'university', label: 'Colour by university' },
		{ value: 'project', label: 'Colour by project' },
		{ value: 'typeOfResource', label: 'Colour by resource type' }
	];

	let filteredItems = $derived.by(() => {
		if (!mapData) return [];
		const q = searchQuery.trim().toLowerCase();
		return mapData.items.filter((item) => {
			if (universityFilter !== 'all') {
				const u = (item.university ?? '').toLowerCase();
				if (universityFilter === 'external') {
					// Items with no partner-university tag count as external.
					if (u && universities.some((x) => x.id === u)) return false;
				} else if (u !== universityFilter) {
					return false;
				}
			}
			if (q) {
				const hay =
					`${item.title} ${item.projectName ?? ''} ${item.typeOfResource ?? ''}`.toLowerCase();
				if (!hay.includes(q)) return false;
			}
			return true;
		});
	});

	let totalItems = $derived(mapData?.items.length ?? 0);
	let lowSignalCount = $derived(mapData?.items.filter((i) => i.lowSignal).length ?? 0);
	let projectCount = $derived.by(() => {
		if (!mapData) return 0;
		const s = new SvelteSet<string>();
		for (const i of mapData.items) if (i.project) s.add(i.project);
		return s.size;
	});

	let selectedItem = $derived.by(() => {
		if (!selectedId || !mapData) return null;
		return mapData.items.find((i) => i.id === selectedId) ?? null;
	});

	let selectedCollection = $derived.by(() => {
		if (!selectedId) return null;
		return collectionsById.get(selectedId) ?? null;
	});

	// Similar items for the currently selected item. We filter out low-signal
	// neighbours for the selected item's suggestions when the selection itself
	// is low-signal (both sides weak = noise).
	let similarForSelected = $derived.by(() => {
		if (!selectedId || !similarData || !mapData) return [];
		const raw = similarData.items[selectedId] ?? [];
		const byId = new SvelteMap<string, SemanticMapItem>();
		for (const it of mapData.items) byId.set(it.id, it);
		const selectedIsLow = selectedItem?.lowSignal ?? false;
		return raw
			.map((ref) => {
				const meta = byId.get(ref.id);
				if (!meta) return null;
				return { ...ref, meta };
			})
			.filter((x): x is { id: string; score: number; meta: SemanticMapItem } => {
				if (!x) return false;
				if (selectedIsLow && x.meta.lowSignal) return false;
				return true;
			})
			.slice(0, 10);
	});

	function formatScore(score: number): string {
		return `${Math.round(score * 100)}%`;
	}

	function closeDetail() {
		setSelected(null);
	}
</script>

<SEO
	title="Semantic Map"
	description="Explore research items through semantic embeddings (Gemini Embedding) projected to 2D with UMAP, plus similar-item suggestions based on cosine similarity."
/>

<div class="space-y-6">
	<div class="animate-slide-in-up">
		<h1 class="page-title">Semantic Map</h1>
		<p class="page-subtitle">
			Each dot is a research item. A <em>semantic embedding</em> turns each item's metadata into a
			point in a high-dimensional "meaning space", so items about similar topics sit near each other
			— even when they don't share any keywords. Vectors are computed with
			<a
				href="https://ai.google.dev/gemini-api/docs/embeddings"
				target="_blank"
				rel="noopener noreferrer"
				class="underline decoration-dotted hover:text-primary"
				><strong>Google's Gemini Embedding</strong></a
			>
			and then reduced to 2-D with
			<a
				href="https://umap-learn.readthedocs.io/en/latest/"
				target="_blank"
				rel="noopener noreferrer"
				class="underline decoration-dotted hover:text-primary">UMAP</a
			> for plotting.
		</p>
	</div>

	{#if loading}
		<div class="flex items-center gap-2 text-sm text-muted-foreground">
			<div
				class="h-3 w-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin"
			></div>
			<span>Loading embeddings…</span>
		</div>
	{:else if loadFailed || !mapData}
		<Card>
			<CardContent class="p-6">
				<div class="flex items-start gap-3">
					<div
						class="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0"
					>
						<AlertCircle class="h-5 w-5 text-destructive" />
					</div>
					<div>
						<h2 class="font-semibold">Embeddings not yet generated</h2>
						<p class="text-sm text-muted-foreground mt-1">
							This page renders <code class="text-xs">static/data/embeddings/map.json</code>
							and
							<code class="text-xs">static/data/embeddings/similar.json</code>, produced by the
							Python pipeline. Add <code class="text-xs">GEMINI_API_KEY</code> to
							<code class="text-xs">.env</code> and run:
						</p>
						<pre class="mt-3 text-xs bg-muted rounded-md p-3 overflow-x-auto"><code
								>.venv/Scripts/pip install -r scripts/requirements.txt
.venv/Scripts/python scripts/generate_embeddings.py</code
							></pre>
					</div>
				</div>
			</CardContent>
		</Card>
	{:else}
		<div
			class="grid gap-4 grid-cols-2 lg:grid-cols-4 animate-slide-in-up"
			style="animation-delay: 50ms"
		>
			<StatCard value={totalItems} label="Items in map" icon={FileText} />
			<StatCard
				value={projectCount}
				label="Projects represented"
				icon={Briefcase}
				iconBgClass="bg-chart-2/10"
				animationDelay="75ms"
			/>
			<StatCard
				value={lowSignalCount}
				label="Low-signal items"
				subtitle="< {mapData.lowSignalThreshold} chars of metadata"
				icon={Sparkles}
				iconBgClass="bg-chart-3/10"
				animationDelay="150ms"
			/>
			<StatCard
				value="{mapData.dims}d"
				label={mapData.model}
				subtitle="task: {mapData.taskType}"
				iconBgClass="bg-chart-4/10"
				animationDelay="225ms"
			/>
		</div>

		<div class="space-y-6 animate-slide-in-up" style="animation-delay: 100ms">
			<!-- Visualization spans the full width so dense clusters get the
			     full pixel budget. The info card + similar-items list now
			     render below the map instead of crowding it on the right. -->
			<div class="space-y-4 min-w-0">
				<div class="flex flex-wrap gap-2">
					<Select options={colorByOpts} bind:value={colorBy} class="sm:w-60" />
					<Select options={universityOpts} bind:value={universityFilter} class="sm:w-60" />
					<Input
						placeholder="Search title / project…"
						bind:value={searchQuery}
						class="flex-1 min-w-[12rem]"
					/>
				</div>

				<Callout tone="warning" title="Read clusters with caution — this map is metadata-only">
					Embeddings are computed from each item's metadata (title, contributors, subjects,
					abstract, project) — <strong>not from the full text</strong> of the underlying source. Items
					with identical or near-identical metadata land on top of each other, so a tight cluster doesn't
					always mean the works themselves are similar. Treat clusters as a hint for further reading,
					not as a finding in their own right.
				</Callout>

				<Card>
					<CardContent class="p-2">
						<div class="h-[28rem] md:h-[34rem] lg:h-[42rem] w-full">
							<SemanticScatter
								items={filteredItems}
								{colorBy}
								{selectedId}
								onSelect={setSelected}
							/>
						</div>
					</CardContent>
				</Card>

				<Callout tone="info" title="Methodology & limits" collapsible>
					<ul class="list-disc pl-5 space-y-1.5">
						<li>
							<strong>Source signal:</strong> vectors are built from MODS-style metadata only — titles,
							contributors, subjects, tags, abstract, and project name. Full-text content (PDF/audio transcripts)
							is not included.
						</li>
						<li>
							<strong>Duplicate-metadata clustering:</strong> many records in the catalogue share the
							same boilerplate metadata (e.g. journal-issue records that differ only by article title).
							They will appear artificially close in the map.
						</li>
						<li>
							<strong>Low-signal items</strong> (under {mapData.lowSignalThreshold} characters of concatenated
							metadata) are dimmed — their coordinates are dominated by a handful of keywords and similarity
							scores against them are unreliable.
						</li>
						<li>
							<strong>2-D projection trade-offs:</strong> UMAP preserves local neighbourhoods but distorts
							global distances. Two clusters being far apart on the plot does not mean the items are particularly
							dissimilar; nearness is more meaningful than farness.
						</li>
						<li>
							<strong>Pipeline:</strong> Gemini Embedding ({mapData.dims}d, task
							<code>{mapData.taskType}</code>) → UMAP (n_neighbors {mapData.umap.nNeighbors},
							min_dist {mapData.umap.minDist}, metric
							<code>{mapData.umap.metric}</code>).
						</li>
						<li>
							Use this view to <em>discover</em> candidate links between items, then verify by reading
							the underlying records — don't quote distances or cluster membership as evidence on their
							own.
						</li>
					</ul>
				</Callout>

				<p class="text-xs text-muted-foreground">
					Low-signal items (dimmed) have under {mapData.lowSignalThreshold} chars of concatenated metadata.
					Zoom with the scroll wheel; click a dot to inspect it.
				</p>
			</div>

			<aside class="grid gap-6 min-w-0 {selectedItem ? 'lg:grid-cols-2' : ''}">
				{#if selectedItem}
					<Card>
						<CardContent class="p-5">
							<div class="flex items-start justify-between gap-3">
								<h2 class="font-display font-semibold leading-snug text-foreground">
									{selectedItem.title || 'Untitled'}
								</h2>
								<button
									type="button"
									onclick={closeDetail}
									class="text-xs text-muted-foreground hover:text-foreground shrink-0"
								>
									Close
								</button>
							</div>

							<div class="flex flex-wrap gap-1.5 mt-3">
								{#if selectedItem.university}
									<Badge variant="outline">{selectedItem.university.toUpperCase()}</Badge>
								{/if}
								{#if selectedItem.typeOfResource}
									<Badge variant="secondary">{selectedItem.typeOfResource}</Badge>
								{/if}
								{#if selectedItem.lowSignal}
									<Badge variant="outline">Low signal</Badge>
								{/if}
							</div>

							{#if selectedItem.projectName}
								<p class="text-xs text-muted-foreground mt-3">
									<span class="uppercase tracking-wide">Project</span><br />
									<span class="text-foreground">{selectedItem.projectName}</span>
								</p>
							{/if}

							<a
								href={researchItemUrl(selectedItem.id)}
								class="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover mt-4"
							>
								Open item details
								<ExternalLink class="h-3.5 w-3.5" />
							</a>

							{#if selectedCollection}
								{@const abstract =
									typeof selectedCollection.abstract === 'string'
										? selectedCollection.abstract
										: null}
								{#if abstract}
									<p class="text-sm text-muted-foreground mt-4 whitespace-pre-line">
										{abstract}
									</p>
								{/if}
							{/if}
						</CardContent>
					</Card>

					<div class="min-w-0">
						<h3 class="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
							<Sparkles class="h-4 w-4 text-primary" />
							Similar items
						</h3>
						{#if similarLoading && !similarData}
							<div class="flex items-center gap-2 text-sm text-muted-foreground py-4">
								<div
									class="h-3 w-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin"
								></div>
								<span>Loading similar items…</span>
							</div>
						{:else if similarForSelected.length > 0}
							<ul class="space-y-2">
								{#each similarForSelected as neighbour (neighbour.id)}
									<li>
										<button
											type="button"
											onclick={() => setSelected(neighbour.id)}
											class="w-full text-left group"
										>
											<Card class="group-hover:border-primary/40 transition-colors">
												<CardContent class="p-3">
													<div class="flex items-start justify-between gap-2">
														<div class="min-w-0 flex-1">
															<p class="text-sm font-medium text-foreground line-clamp-2">
																{neighbour.meta.title || 'Untitled'}
															</p>
															<p class="text-xs text-muted-foreground mt-1 truncate">
																{neighbour.meta.projectName ?? neighbour.meta.project ?? '—'}
															</p>
														</div>
														<div class="text-right shrink-0 flex flex-col items-end gap-1">
															<span class="text-xs font-medium text-chart-1">
																{formatScore(neighbour.score)}
															</span>
															<ArrowRight
																class="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors"
															/>
														</div>
													</div>
												</CardContent>
											</Card>
										</button>
									</li>
								{/each}
							</ul>
						{:else}
							<EmptyState
								message={selectedItem.lowSignal
									? 'Selected item is low-signal — suggestions suppressed to avoid keyword noise.'
									: 'No similar items available.'}
								icon={Sparkles}
							/>
						{/if}
					</div>
				{:else}
					<Card>
						<CardContent class="p-5">
							<p class="text-sm text-muted-foreground">
								Click a dot on the map to see the item's metadata and its nearest semantic
								neighbours.
							</p>
							<p class="text-xs text-muted-foreground mt-3">
								<span class="text-foreground">Tip:</span> use the legend at the bottom of the map to toggle
								categories on and off, and scroll to zoom into dense clusters.
							</p>
						</CardContent>
					</Card>
				{/if}
			</aside>
		</div>
	{/if}
</div>
