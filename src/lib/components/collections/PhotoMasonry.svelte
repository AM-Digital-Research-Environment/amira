<script lang="ts">
	import type { CollectionItem } from '$lib/types';
	import PhotoCard from './PhotoCard.svelte';
	import { revealOnScroll } from '$lib/utils/revealOnScroll';
	import { onDestroy, onMount } from 'svelte';
	import { Loader2 } from '@lucide/svelte';
	import type { CardLabels } from './photoHelpers';

	interface Props {
		items: CollectionItem[];
		onSelect?: (item: CollectionItem) => void;
		density?: 'default' | 'compact';
		/** Number of items rendered initially and per page. Kept modest so
		 *  first paint is fast even for 1,000+ photo collections. */
		pageSize?: number;
		/** Optional map from item._id → number of deduped records that
		 *  share the same photo. Drives the "× N" badge on cards. */
		countsById?: Map<string, number> | null;
		/** Optional map from item._id → display label override. Used by
		 *  callers that want a card to show e.g. an issue title instead of
		 *  the item's own descriptive title. */
		labelsById?: Map<string, CardLabels> | null;
	}

	let {
		items,
		onSelect,
		density = 'default',
		pageSize = 60,
		countsById = null,
		labelsById = null
	}: Props = $props();

	// Progressive window — grows as the user scrolls near the sentinel.
	let shown = $state(0);
	let sentinel: HTMLDivElement | undefined = $state();
	let sentinelObserver: IntersectionObserver | null = null;

	// Reset window on items / pageSize change so the user always sees the
	// top of the list after changing filters. Initialises on first run too.
	$effect(() => {
		void items;
		shown = pageSize;
	});

	let visible = $derived(items.slice(0, shown));
	let hasMore = $derived(shown < items.length);

	// Responsive column count, tracked via a resize listener. Using a live
	// viewport width means newly-appended items get placed into the same
	// column bucket their index implies, so existing items never jump.
	let viewportWidth = $state(1024);
	onMount(() => {
		viewportWidth = window.innerWidth;
		const onResize = () => {
			viewportWidth = window.innerWidth;
		};
		window.addEventListener('resize', onResize, { passive: true });
		return () => window.removeEventListener('resize', onResize);
	});

	let numCols = $derived(
		viewportWidth >= 1440 ? 5 : viewportWidth >= 1024 ? 4 : viewportWidth >= 640 ? 3 : 2
	);

	// Round-robin items into N vertical columns. The trick that makes true
	// masonry work without reshuffle: each item's column is determined
	// purely by its *index*, not by which column is currently shortest.
	// Appending new items only grows the existing columns — never rewrites
	// them. Columns end up roughly balanced over many items; for short
	// lists some unevenness is acceptable.
	let columns = $derived.by<CollectionItem[][]>(() => {
		const out: CollectionItem[][] = Array.from({ length: numCols }, () => []);
		visible.forEach((item, i) => out[i % numCols].push(item));
		return out;
	});

	$effect(() => {
		if (typeof IntersectionObserver === 'undefined') return;
		sentinelObserver?.disconnect();
		if (!sentinel || !hasMore) return;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						shown = Math.min(shown + pageSize, items.length);
					}
				}
			},
			{ rootMargin: '600px 0px' }
		);
		observer.observe(sentinel);
		sentinelObserver = observer;
		return () => observer.disconnect();
	});

	onDestroy(() => sentinelObserver?.disconnect());
</script>

<div>
	<div class="masonry">
		{#each columns as column, colIndex (colIndex)}
			<div class="masonry-col">
				{#each column as item, rowIndex (item._id)}
					<div class="masonry-item" use:revealOnScroll={{ delay: (rowIndex % 8) * 25 }}>
						<PhotoCard
							{item}
							{onSelect}
							{density}
							count={countsById?.get(item._id) ?? 1}
							labels={labelsById?.get(item._id) ?? null}
						/>
					</div>
				{/each}
			</div>
		{/each}
	</div>

	{#if hasMore}
		<div bind:this={sentinel} class="masonry-sentinel">
			<span class="masonry-sentinel-chip">
				<Loader2 class="h-4 w-4 masonry-spin" />
				Loading more — {shown.toLocaleString('en-GB')} of {items.length.toLocaleString('en-GB')}
			</span>
		</div>
	{:else if items.length > 0}
		<div class="masonry-endstop">
			Showing all {items.length.toLocaleString('en-GB')} photos
		</div>
	{/if}
</div>

<style>
	/* Flex-columns masonry: each column is an independent vertical stack
	   with items placed by their list index. Appending new items only
	   lengthens existing columns — there is no layout-driven rebalancing,
	   so scrolling doesn't cause old cards to jump the way CSS `columns`
	   or auto-placed grids do. */
	.masonry {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
	}

	.masonry-col {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.masonry-item {
		display: block;
		min-width: 0;
	}

	.masonry-sentinel {
		display: flex;
		justify-content: center;
		padding: 2rem 0;
	}

	.masonry-sentinel-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.875rem;
		border-radius: 999px;
		background: hsl(var(--muted));
		border: 1px solid hsl(var(--border));
		font-size: var(--font-size-xs);
		color: hsl(var(--muted-foreground));
	}

	:global(.masonry-spin) {
		animation: masonry-spin-kf 1s linear infinite;
	}

	@keyframes masonry-spin-kf {
		to {
			transform: rotate(360deg);
		}
	}

	.masonry-endstop {
		text-align: center;
		padding: 1.5rem 0;
		font-size: var(--font-size-xs);
		color: hsl(var(--muted-foreground));
	}
</style>
