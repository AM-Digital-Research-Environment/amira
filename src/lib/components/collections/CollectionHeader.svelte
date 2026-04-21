<script lang="ts">
	import type { FeaturedCollection } from '$lib/utils/collectionsRegistry';
	import type { Snippet } from 'svelte';

	interface Props {
		meta: FeaturedCollection;
		photoCount: number;
		itemCount: number;
		dateRange?: { from: number | null; to: number | null };
		locationCount?: number;
		actions?: Snippet;
	}

	let { meta, photoCount, itemCount, dateRange, locationCount, actions }: Props = $props();
</script>

<header class="collection-hero animate-slide-in-up">
	<div class="collection-hero-text">
		<p class="collection-hero-eyebrow">Collection</p>
		<h1 class="page-title">{meta.title}</h1>
		{#if meta.tagline}
			<p class="collection-hero-tagline">{meta.tagline}</p>
		{/if}
		<p class="page-subtitle mt-3">{meta.description}</p>
		{#if meta.partner}
			<p class="collection-hero-partner">{meta.partner}</p>
		{/if}

		<dl class="collection-hero-stats">
			<div>
				<dt>Photos</dt>
				<dd>{photoCount.toLocaleString('en-GB')}</dd>
			</div>
			{#if itemCount !== photoCount}
				<div>
					<dt>Records</dt>
					<dd>{itemCount.toLocaleString('en-GB')}</dd>
				</div>
			{/if}
			{#if dateRange && dateRange.from && dateRange.to}
				<div>
					<dt>Years</dt>
					<dd>
						{dateRange.from === dateRange.to ? dateRange.from : `${dateRange.from}–${dateRange.to}`}
					</dd>
				</div>
			{/if}
			{#if locationCount && locationCount > 0}
				<div>
					<dt>Places</dt>
					<dd>{locationCount.toLocaleString('en-GB')}</dd>
				</div>
			{/if}
		</dl>

		{#if actions}
			<div class="collection-hero-actions">
				{@render actions()}
			</div>
		{/if}
	</div>
</header>

<style>
	.collection-hero {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid hsl(var(--border));
		margin-bottom: 1.5rem;
	}

	.collection-hero-eyebrow {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
		color: hsl(var(--chart-2));
		font-weight: 600;
	}

	.collection-hero-tagline {
		font-size: var(--font-size-base);
		color: hsl(var(--chart-2));
		font-weight: 500;
		margin-top: 0.25rem;
	}

	.collection-hero-partner {
		display: inline-flex;
		width: fit-content;
		margin-top: 0.875rem;
		padding: 0.25rem 0.75rem;
		background: hsl(var(--muted));
		border: 1px solid hsl(var(--border));
		border-radius: 999px;
		font-size: var(--font-size-xs);
		color: hsl(var(--muted-foreground));
		font-weight: 500;
	}

	.collection-hero-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 2rem;
		margin-top: 1.25rem;
		padding: 0;
	}
	.collection-hero-stats div {
		display: flex;
		flex-direction: column;
	}
	.collection-hero-stats dt {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
		color: hsl(var(--muted-foreground));
	}
	.collection-hero-stats dd {
		font-family: var(--font-display);
		font-size: var(--font-size-2xl);
		font-weight: 600;
		color: hsl(var(--foreground));
	}

	.collection-hero-actions {
		margin-top: 0.5rem;
	}
</style>
