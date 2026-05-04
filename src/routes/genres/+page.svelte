<script lang="ts">
	import { StatCard, ChartCard, SEO } from '$lib/components/ui';
	import { BarChart, EntityKnowledgeGraph, HeatmapChart } from '$lib/components/charts';
	import { languageName, normalizeLanguageCode } from '$lib/utils/languages';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { HeatmapDataPoint } from '$lib/types';
	import { EntityDashboardSection } from '$lib/components/dashboards';
	import {
		EntityCard,
		EntityBrowseGrid,
		EntityToolbar,
		EntityDetailHeader,
		EntityDetailViewShell,
		EntityPageContainer,
		SearchableItemsCard,
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

	// Heatmap: top 12 genres × top 8 languages.
	let genreLanguageHeatmap = $derived.by((): HeatmapDataPoint[] => {
		const topGenres = new SvelteSet(genres.slice(0, 12).map((g) => g.name));
		const langTotals = new SvelteMap<string, number>();
		const cell = new SvelteMap<string, number>();
		for (const item of $allCollections) {
			const codes = item.language || [];
			if (codes.length === 0) continue;
			const itemGenres = getItemGenres(item).filter((g) => topGenres.has(g));
			if (itemGenres.length === 0) continue;
			const seenLangs = new SvelteSet<string>();
			const seenGenres = new SvelteSet<string>();
			for (const raw of codes) {
				const lname = languageName(normalizeLanguageCode(raw));
				if (seenLangs.has(lname)) continue;
				seenLangs.add(lname);
				langTotals.set(lname, (langTotals.get(lname) ?? 0) + 1);
				for (const g of itemGenres) {
					if (seenGenres.has(`${lname}|${g}`)) continue;
					seenGenres.add(`${lname}|${g}`);
					const key = `${lname}|${g}`;
					cell.set(key, (cell.get(key) ?? 0) + 1);
				}
			}
		}
		const topLangs = Array.from(langTotals.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8)
			.map(([n]) => n);
		const result: HeatmapDataPoint[] = [];
		for (const l of topLangs) {
			for (const g of topGenres) {
				const v = cell.get(`${l}|${g}`) ?? 0;
				if (v > 0) result.push({ x: l, y: g, value: v });
			}
		}
		return result;
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

<EntityPageContainer
	title="Genres"
	subtitle="Browse research items by genre classification"
	selected={() => selectedGenre}
>
	{#snippet detailView()}
		<EntityDetailViewShell
			backLabel="Back to genres"
			onBack={clearSelection}
			resolved={selectedGenreData}
			loading={detail.loading}
			emptyMessage="No data available for this genre."
		>
			{#snippet body(genre)}
				<EntityDetailHeader
					title={genre.name}
					icon={BookType}
					count={genre.count}
					percentOfTotal={$allCollections.length
						? (genre.count / $allCollections.length) * 100
						: undefined}
					wisskiCategory="genres"
					wisskiKey={genre.name}
				/>
				<SearchableItemsCard items={genre.items} showProject={true} />
				<EntityDashboardSection
					entityType="genre"
					entityId={genre.name}
					items={genre.items}
					data={detail.data}
				/>
				<EntityKnowledgeGraph
					entityType="genre"
					entityId={genre.name}
					title="Genre knowledge graph"
				/>
			{/snippet}
		</EntityDetailViewShell>
	{/snippet}

	{#snippet listView()}
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

		{#if genreLanguageHeatmap.length > 0}
			<ChartCard
				title="Genre × language"
				subtitle="Where each genre concentrates in the language mix"
				contentHeight="h-chart-lg"
			>
				<HeatmapChart data={genreLanguageHeatmap} class="h-full w-full" />
			</ChartCard>
		{/if}

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
	{/snippet}
</EntityPageContainer>
