<script lang="ts">
	import { StatCard, ChartCard, BackToList, SEO } from '$lib/components/ui';
	import { BarChart, EntityKnowledgeGraph } from '$lib/components/charts';
	import { EntityDashboardSection } from '$lib/components/dashboards';
	import {
		EntityCard,
		EntityBrowseGrid,
		EntityToolbar,
		EntityDetailHeader,
		SearchableItemsCard,
		applyEntitySort,
		type EntitySort
	} from '$lib/components/entity-browse';
	import { allCollections, ensureCollections } from '$lib/stores/data';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import { createSearchFilter } from '$lib/utils/search';
	import {
		buildCategoryIndex,
		sortedCategoryList,
		categoryToChartData
	} from '$lib/utils/categoryIndex';
	import type { CollectionItem, CategoryEntry } from '$lib/types';
	import { BookType } from '@lucide/svelte';
	import { createEntityDetailState } from '$lib/utils/loaders';

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

	const detail = createEntityDetailState('genre', () => selectedGenre);

	let selectedGenreData = $derived.by((): CategoryEntry | null => {
		if (!selectedGenre) return null;
		const live = genreMap.get(selectedGenre);
		if (live && live.items.length > 0) return live;
		if (detail.data?.meta) {
			return {
				name: detail.data.meta.name ?? selectedGenre,
				count: detail.data.meta.count ?? 0,
				items: detail.items
			};
		}
		return null;
	});

	const searchGenres = createSearchFilter<CategoryEntry>([(g) => g.name]);
	let visibleGenres = $derived(applyEntitySort(searchGenres(genres, searchQuery), sort));

	let barData = $derived(categoryToChartData(genres, 20));

	onMount(() => {
		if (!selectedGenre) void ensureCollections(base);
	});

	$effect(() => {
		if (!selectedGenre) void ensureCollections(base);
	});

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

	{#if selectedGenre}
		<div class="space-y-6">
			<BackToList show={true} onclick={clearSelection} label="Back to genres" />
			{#if selectedGenreData}
				<EntityDetailHeader
					title={selectedGenreData.name}
					icon={BookType}
					count={selectedGenreData.count}
					percentOfTotal={$allCollections.length
						? (selectedGenreData.count / $allCollections.length) * 100
						: undefined}
					wisskiCategory="genres"
					wisskiKey={selectedGenreData.name}
				/>
				<SearchableItemsCard items={selectedGenreData.items} showProject={true} />
				<EntityDashboardSection
					entityType="genre"
					entityId={selectedGenreData.name}
					items={selectedGenreData.items}
					data={detail.data}
				/>
				<EntityKnowledgeGraph
					entityType="genre"
					entityId={selectedGenreData.name}
					title="Genre knowledge graph"
				/>
			{:else if detail.loading}
				<p class="text-sm text-muted-foreground">Loading dashboard…</p>
			{:else}
				<p class="text-sm text-muted-foreground">No data available for this genre.</p>
			{/if}
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
