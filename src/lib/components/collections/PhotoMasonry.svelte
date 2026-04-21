<script lang="ts">
	import type { CollectionItem } from '$lib/types';
	import PhotoCard from './PhotoCard.svelte';
	import { revealOnScroll } from '$lib/utils/revealOnScroll';
	import { onDestroy } from 'svelte';
	import { Loader2 } from '@lucide/svelte';

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
	}

	let { items, onSelect, density = 'default', pageSize = 60, countsById = null }: Props = $props();

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
		{#each visible as item, index (item._id)}
			<div class="masonry-item" use:revealOnScroll={{ delay: (index % 12) * 25 }}>
				<PhotoCard {item} {onSelect} {density} count={countsById?.get(item._id) ?? 1} />
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
	.masonry {
		column-count: 2;
		column-gap: 1rem;
	}

	@media (min-width: 640px) {
		.masonry {
			column-count: 3;
		}
	}
	@media (min-width: 1024px) {
		.masonry {
			column-count: 4;
		}
	}
	@media (min-width: 1440px) {
		.masonry {
			column-count: 5;
		}
	}

	.masonry-item {
		break-inside: avoid;
		margin-bottom: 1rem;
		display: block;
		/* Skip layout + paint for offscreen cards — huge win when the
		   window grows past a few hundred items. */
		content-visibility: auto;
		contain-intrinsic-size: auto 240px;
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
