<script lang="ts">
	import { base } from '$app/paths';
	import { Images, ArrowRight } from '@lucide/svelte';
	import { revealOnScroll } from '$lib/utils/revealOnScroll';
	import type { FeaturedCollection } from '$lib/utils/collectionsRegistry';

	interface Props {
		meta: FeaturedCollection;
		itemCount: number;
		photoCount: number;
		coverUrls: string[];
		/** Per-card reveal delay (ms). The reveal action keeps elements
		 *  hidden until they cross the viewport threshold, then fades. */
		revealDelay?: number;
		/** Compact variant — used in the overview sneak-peek. Shrinks the
		 *  cover, tightens padding, hides the description and partner. */
		compact?: boolean;
	}

	let {
		meta,
		itemCount,
		photoCount,
		coverUrls,
		revealDelay = 0,
		compact = false
	}: Props = $props();
</script>

<a
	href="{base}/collections/{meta.slug}"
	class="collection-card"
	class:compact
	use:revealOnScroll={{ delay: revealDelay }}
>
	<div class="collection-card-cover" aria-hidden="true">
		{#if meta.thumbnail}
			<img
				class="collection-card-thumb"
				src="{base}/{meta.thumbnail}"
				alt=""
				loading="lazy"
				draggable="false"
			/>
		{:else if coverUrls.length > 0}
			<div class="collection-card-mosaic" data-count={coverUrls.length}>
				{#each coverUrls as url, i (i)}
					<img src={url} alt="" loading="lazy" draggable="false" />
				{/each}
			</div>
		{:else}
			<div class="collection-card-placeholder">
				<Images class="h-10 w-10 opacity-40" />
			</div>
		{/if}
	</div>

	<div class="collection-card-body">
		<h3 class="collection-card-title">{meta.title}</h3>
		{#if meta.tagline && !compact}
			<p class="collection-card-tagline">{meta.tagline}</p>
		{/if}
		{#if !compact}
			<p class="collection-card-desc">{meta.description}</p>
			{#if meta.partner}
				<p class="collection-card-partner">{meta.partner}</p>
			{/if}
		{/if}

		<div class="collection-card-footer">
			<div class="collection-card-stats">
				<span><strong>{photoCount}</strong> photos</span>
				{#if itemCount !== photoCount}
					<span class="collection-card-stats-alt">/ {itemCount} items</span>
				{/if}
			</div>
			<span class="collection-card-cta">
				Browse <ArrowRight class="h-4 w-4" />
			</span>
		</div>
	</div>
</a>

<style>
	.collection-card {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: var(--radius);
		border: 1px solid hsl(var(--border));
		background: hsl(var(--card));
		color: hsl(var(--card-foreground));
		text-decoration: none;
		transition:
			transform 200ms var(--ease-expo-out),
			box-shadow 200ms ease,
			border-color 200ms ease;
	}

	.collection-card:hover {
		transform: translateY(-2px);
		border-color: hsl(var(--primary) / 0.4);
		box-shadow: 0 10px 25px -12px hsl(var(--foreground) / 0.15);
	}

	.collection-card-cover {
		aspect-ratio: 16 / 9;
		background: hsl(var(--muted));
		overflow: hidden;
	}
	.collection-card.compact .collection-card-cover {
		aspect-ratio: 3 / 2;
	}

	.collection-card-thumb {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 400ms var(--ease-expo-out);
	}

	.collection-card:hover .collection-card-thumb {
		transform: scale(1.03);
	}

	.collection-card-mosaic {
		display: grid;
		width: 100%;
		height: 100%;
		gap: 2px;
	}
	.collection-card-mosaic[data-count='1'] {
		grid-template: 1fr / 1fr;
	}
	.collection-card-mosaic[data-count='2'] {
		grid-template: 1fr / 1fr 1fr;
	}
	.collection-card-mosaic[data-count='3'] {
		grid-template: 1fr 1fr / 1fr 1fr;
	}
	.collection-card-mosaic[data-count='3'] :global(img:first-child) {
		grid-row: 1 / span 2;
	}
	.collection-card-mosaic[data-count='4'] {
		grid-template: 1fr 1fr / 1fr 1fr;
	}
	.collection-card-mosaic :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.collection-card-placeholder {
		display: flex;
		width: 100%;
		height: 100%;
		align-items: center;
		justify-content: center;
		color: hsl(var(--muted-foreground));
	}

	.collection-card-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1.25rem 1.5rem 1.5rem;
	}
	.collection-card.compact .collection-card-body {
		padding: 0.875rem 1rem 1rem;
		gap: 0.375rem;
	}

	.collection-card-title {
		font-family: var(--font-display);
		font-size: var(--font-size-xl);
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		line-height: var(--line-height-tight);
		color: hsl(var(--foreground));
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.collection-card.compact .collection-card-title {
		font-size: var(--font-size-base);
	}

	.collection-card-tagline {
		font-size: var(--font-size-sm);
		color: hsl(var(--chart-2));
		font-weight: 500;
	}

	.collection-card-desc {
		font-size: var(--font-size-sm);
		color: hsl(var(--muted-foreground));
		line-height: var(--line-height-relaxed);
		display: -webkit-box;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.collection-card-partner {
		display: inline-flex;
		width: fit-content;
		margin-top: 0.5rem;
		padding: 0.125rem 0.5rem;
		background: hsl(var(--muted));
		border: 1px solid hsl(var(--border));
		border-radius: 999px;
		font-size: var(--font-size-xs);
		color: hsl(var(--muted-foreground));
	}

	.collection-card-footer {
		margin-top: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 0.75rem;
		border-top: 1px solid hsl(var(--border));
	}
	.collection-card.compact .collection-card-footer {
		margin-top: 0.25rem;
		padding-top: 0.5rem;
		font-size: var(--font-size-xs);
	}

	.collection-card-stats {
		font-size: var(--font-size-sm);
		color: hsl(var(--foreground));
	}

	.collection-card-stats-alt {
		color: hsl(var(--muted-foreground));
	}

	.collection-card-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: hsl(var(--primary));
	}

	.collection-card:hover .collection-card-cta :global(svg) {
		transform: translateX(2px);
		transition: transform 160ms ease;
	}
</style>
