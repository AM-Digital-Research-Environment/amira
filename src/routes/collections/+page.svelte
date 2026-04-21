<script lang="ts">
	import { Images } from '@lucide/svelte';
	import { allCollections } from '$lib/stores/data';
	import { SEO } from '$lib/components/ui';
	import { buildCollectionCards } from '$lib/utils/featuredCollectionLoader';
	import CollectionIndexCard from '$lib/components/collections/CollectionIndexCard.svelte';

	let cards = $derived(buildCollectionCards($allCollections));
</script>

<SEO
	title="Collections"
	description="Featured collections from the Africa Multiple archive — photos, texts, audio and video."
/>

<div class="page-container">
	<header class="page-header animate-slide-in-up">
		<h1 class="page-title">Collections</h1>
		<p class="page-subtitle">
			Featured collections from the Africa Multiple archive — spanning photographs, texts, audio and
			video, each with multiple ways to browse.
		</p>
	</header>

	{#if cards.length === 0}
		<div class="rounded-lg border bg-card p-12 text-center text-muted-foreground">
			<Images class="mx-auto mb-3 h-12 w-12 opacity-50" />
			<p>No featured collections yet.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			{#each cards as card, index (card.meta.slug)}
				<CollectionIndexCard
					meta={card.meta}
					itemCount={card.itemCount}
					photoCount={card.photoCount}
					coverUrls={card.coverUrls}
					revealDelay={index * 80}
				/>
			{/each}
		</div>
	{/if}
</div>
