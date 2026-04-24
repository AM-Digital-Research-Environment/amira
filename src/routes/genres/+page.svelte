<script lang="ts">
	import { StatCard, ChartCard, BackToList, SEO } from '$lib/components/ui';
	import { BarChart, EntityKnowledgeGraph } from '$lib/components/charts';
	import {
		EntityCard,
		EntityBrowseGrid,
		EntityToolbar,
		EntityDetailHeader,
		EntityItemsCard,
		applyEntitySort,
		type EntitySort
	} from '$lib/components/entity-browse';
	import { allCollections } from '$lib/stores/data';
	import { page } from '$app/stores';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import { createSearchFilter } from '$lib/utils/search';
	import {
		buildCategoryIndex,
		sortedCategoryList,
		categoryToChartData
	} from '$lib/utils/categoryIndex';
	import type { CollectionItem, CategoryEntry } from '$lib/types';
	import { BookType } from '@lucide/svelte';

	const urlSelection = createUrlSelection('genre');

	let searchQuery = $state('');
	let sort = $state<EntitySort>('count-desc');

	// Writable $derived mirrors the URL param. Click handlers can still
	// overwrite it optimistically (`selectedGenre = name`); assignment wins
	// until the derivation dependency changes, which happens when `goto()`
	// updates the URL. Using $derived (not $state + $effect) is what makes
	// browser Back restore the list view — the derivation re-runs when the
	// URL param disappears.
	let selectedGenre = $derived($page.url.searchParams.get('genre') ?? '');

	function getItemGenres(item: CollectionItem): string[] {
		if (!item.genre) return [];
		const entries: string[] = [];
		for (const values of Object.values(item.genre)) {
			if (Array.isArray(values)) entries.push(...values.filter(Boolean));
		}
		return entries;
	}

	let genreMap = $derived(buildCategoryIndex($allCollections, getItemGenres));
	let genres = $derived(sortedCategoryList(genreMap));
	let selectedGenreData = $derived(selectedGenre ? genreMap.get(selectedGenre) || null : null);

	const searchGenres = createSearchFilter<CategoryEntry>([(g) => g.name]);
	let visibleGenres = $derived(applyEntitySort(searchGenres(genres, searchQuery), sort));

	let barData = $derived(categoryToChartData(genres, 20));

	function selectGenre(genre: string) {
		urlSelection.pushToUrl(genre);
		scrollToTop();
	}

	function clearSelection() {
		urlSelection.removeFromUrl();
		scrollToTop();
	}
</script>

<SEO title="Genres" description="Browse research items by genre classification" />

<div class="space-y-8 animate-slide-in-up">
	<div>
		<h1 class="page-title">Genres</h1>
		<p class="page-subtitle">Browse research items by genre classification</p>
	</div>

	{#if selectedGenreData}
		<div class="space-y-6">
			<BackToList show={true} onclick={clearSelection} label="Back to genres" />
			<EntityDetailHeader
				title={selectedGenreData.name}
				icon={BookType}
				count={selectedGenreData.count}
				percentOfTotal={(selectedGenreData.count / $allCollections.length) * 100}
				wisskiCategory="genres"
				wisskiKey={selectedGenreData.name}
			/>
			<EntityItemsCard items={selectedGenreData.items} />
			<EntityKnowledgeGraph
				entityType="genre"
				entityId={selectedGenreData.name}
				title="Genre knowledge graph"
			/>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-3">
			<StatCard label="Genres" value={genres.length} icon={BookType} />
			<StatCard label="Most Common" value={genres[0]?.name || '—'} icon={BookType} />
			<StatCard label="Total Items" value={$allCollections.length} icon={BookType} />
		</div>

		<ChartCard
			title="Top 20 Genres"
			subtitle="Click a bar to open a genre"
			contentHeight="h-chart-lg"
		>
			{#if barData.length > 0}
				<BarChart data={barData} onclick={(name) => selectGenre(name)} />
			{/if}
		</ChartCard>

		<EntityToolbar
			{searchQuery}
			onSearchChange={(v) => (searchQuery = v)}
			searchPlaceholder="Search genres..."
			{sort}
			onSortChange={(v) => (sort = v)}
			totalCount={visibleGenres.length}
			totalLabel="genres"
		/>

		<EntityBrowseGrid
			items={visibleGenres}
			getKey={(g) => g.name}
			emptyMessage="No genres match your search"
		>
			{#snippet card(genre)}
				<EntityCard
					name={genre.name}
					description="Genre"
					count={genre.count}
					countLabel="item"
					icon={BookType}
					onclick={() => selectGenre(genre.name)}
				/>
			{/snippet}
		</EntityBrowseGrid>
	{/if}
</div>
