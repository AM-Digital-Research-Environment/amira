<script lang="ts">
	/**
	 * Semantic-kNN suggestions for a single research item.
	 *
	 * Reads `static/data/embeddings/similar.json` (precomputed top-12 cosine
	 * neighbours per `dre_id`). Lazy-loaded on first paint of an items detail
	 * view so the home/list pages never pay for the 6 MB blob.
	 *
	 * Renders nothing if:
	 *   - the embeddings file is missing (fresh install before
	 *     `scripts/generate_embeddings.py` runs)
	 *   - the current item is `lowSignal` (the embedding pipeline marks items
	 *     with too little metadata as unreliable matches)
	 *   - no neighbours resolve to a title we can show
	 */
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { Card, CardHeader, CardTitle, CardContent, Badge } from '$lib/components/ui';
	import { Sparkles, FileText } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { researchItemUrl } from '$lib/utils/urls';
	import { loadSimilarItems, loadSemanticMap } from '$lib/utils/loaders';
	import type { SimilarItemRef, SemanticMapItem } from '$lib/types';

	interface Props {
		/** `dre_id` of the current item — same identifier used in similar.json. */
		itemId: string;
		/** Max neighbours to display (default 8). */
		topK?: number;
	}

	let { itemId, topK = 8 }: Props = $props();

	// Module-scope memoisation: load each file once per session.
	type SimilarLookup = Record<string, SimilarItemRef[]>;
	type ItemLookup = SvelteMap<string, SemanticMapItem>;

	let similar = $state<SimilarLookup | null>(null);
	let itemMeta = $state<ItemLookup | null>(null);
	let loading = $state(false);
	let loadFailed = $state(false);

	onMount(async () => {
		loading = true;
		try {
			const [sim, map] = await Promise.all([loadSimilarItems(base), loadSemanticMap(base)]);
			if (sim?.items) {
				similar = sim.items;
			}
			if (map?.items) {
				const lookup = new SvelteMap<string, SemanticMapItem>();
				for (const it of map.items) lookup.set(it.id, it);
				itemMeta = lookup;
			}
			if (!sim?.items && !map?.items) loadFailed = true;
		} catch {
			loadFailed = true;
		} finally {
			loading = false;
		}
	});

	let neighbours = $derived.by(() => {
		if (!similar || !itemMeta) return [];
		const refs = similar[itemId];
		if (!Array.isArray(refs) || refs.length === 0) return [];
		return refs
			.slice(0, topK)
			.map((ref) => {
				const meta = itemMeta!.get(ref.id);
				if (!meta || meta.lowSignal) return null;
				return { ref, meta };
			})
			.filter((n): n is { ref: SimilarItemRef; meta: SemanticMapItem } => n !== null);
	});

	// Hide the card entirely when nothing useful resolves — no point showing
	// "no similar items found" empty states for items that are themselves
	// low-signal or missing from the embeddings batch.
	const visible = $derived(!loading && !loadFailed && neighbours.length > 0);
</script>

{#if visible}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}
							<span class="flex items-center gap-2">
								<Sparkles class="h-5 w-5 text-primary" />
								Similar items
								<Badge variant="secondary">
									{#snippet children()}{neighbours.length}{/snippet}
								</Badge>
							</span>
						{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<p class="mb-3 text-xs text-muted-foreground">
						Closest matches by semantic similarity (Gemini text embeddings).
					</p>
					<ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{#each neighbours as neighbour (neighbour.ref.id)}
							{@const m = neighbour.meta}
							<li
								class="group flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-transparent transition-all duration-fast ease-out hover:bg-muted/60 hover:border-border/60"
							>
								<FileText
									class="h-4 w-4 mt-0.5 text-muted-foreground shrink-0 transition-colors group-hover:text-primary"
								/>
								<div class="min-w-0 flex-1">
									<a
										href={researchItemUrl(neighbour.ref.id)}
										class="text-sm font-medium text-foreground hover:text-primary transition-colors break-words"
									>
										{m.title || 'Untitled'}
									</a>
									<div
										class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground"
									>
										{#if m.typeOfResource}
											<span>{m.typeOfResource}</span>
										{/if}
										{#if m.projectName}
											<span class="truncate" title={m.projectName}
												>· {m.projectName.length > 28
													? m.projectName.slice(0, 26) + '…'
													: m.projectName}</span
											>
										{/if}
										<span class="ml-auto rounded-full bg-primary/10 text-primary px-1.5 py-0.5">
											{(neighbour.ref.score * 100).toFixed(0)}%
										</span>
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}
