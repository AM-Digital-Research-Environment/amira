<script lang="ts">
	import {
		StatCard,
		ChartCard,
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		Badge,
		Input,
		Pagination,
		BackToList,
		CollectionItemRow,
		SEO
	} from '$lib/components/ui';
	import { BarChart } from '$lib/components/charts';
	import { allCollections } from '$lib/stores/data';
	import { page } from '$app/stores';
	import { createUrlSelection, scrollToElement } from '$lib/utils/urlSelection';
	import { createSearchFilter } from '$lib/utils/search';
	import { paginate } from '$lib/utils/pagination';
	import { DEFAULT_ITEMS_PER_PAGE } from '$lib/utils/constants';
	import {
		buildCategoryIndex,
		sortedCategoryList,
		categoryToChartData
	} from '$lib/utils/categoryIndex';
	import type { CollectionItem } from '$lib/types';
	import { BookType, FileText } from '@lucide/svelte';
	import { WissKILink } from '$lib/components/ui';

	const urlSelection = createUrlSelection('genre');

	let selectedGenre = $state('');
	let searchQuery = $state('');

	// Sync from URL query param
	$effect(() => {
		const urlGenre = $page.url.searchParams.get('genre');
		if (urlGenre) selectedGenre = urlGenre;
	});

	// Extract all genres from an item
	function getItemGenres(item: CollectionItem): string[] {
		if (!item.genre) return [];
		const entries: string[] = [];
		for (const values of Object.values(item.genre)) {
			if (Array.isArray(values)) entries.push(...values.filter(Boolean));
		}
		return entries;
	}

	// Build genre index
	let genreMap = $derived(buildCategoryIndex($allCollections, getItemGenres));

	let genres = $derived(sortedCategoryList(genreMap));

	let selectedGenreData = $derived(selectedGenre ? genreMap.get(selectedGenre) || null : null);

	// Search filter for genre list
	let filteredGenres = $derived.by(() => {
		if (!searchQuery.trim()) return genres;
		const q = searchQuery.toLowerCase();
		return genres.filter((g) => g.name.toLowerCase().includes(q));
	});

	// Chart data (top 20)
	let barData = $derived(categoryToChartData(genres, 20));

	// Pagination
	const itemsPerPage = DEFAULT_ITEMS_PER_PAGE;
	let itemPage = $state(0);
	let paginatedItems = $derived.by(() => {
		if (!selectedGenreData) return [];
		return paginate(selectedGenreData.items, itemPage, itemsPerPage);
	});

	let detailSection: HTMLDivElement | undefined = $state();

	$effect(() => {
		selectedGenre;
		itemPage = 0;
	});

	function selectGenre(genre: string) {
		selectedGenre = genre;
		urlSelection.pushToUrl(genre);
		scrollToElement(detailSection);
	}

	function clearSelection() {
		selectedGenre = '';
		urlSelection.removeFromUrl();
	}
</script>

<SEO title="Genres" description="Browse research items by genre classification" />

<div class="space-y-8 animate-slide-in-up">
	<div>
		<h1 class="page-title">Genres</h1>
		<p class="page-subtitle">Browse research items by genre classification</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		<StatCard label="Genres" value={genres.length} icon={BookType} />
		<StatCard label="Total Items" value={$allCollections.length} icon={FileText} />
		<StatCard label="Most Common" value={genres[0]?.name || '—'} icon={BookType} />
	</div>

	<!-- Chart -->
	<ChartCard title="Top 20 Genres" subtitle="Click a bar to view items" contentHeight="h-chart-lg">
		{#if barData.length > 0}
			<BarChart data={barData} onclick={(name) => selectGenre(name)} />
		{/if}
	</ChartCard>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Genre List -->
		<Card class="lg:col-span-1 lg:sticky lg:top-20 lg:self-start overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle>
							{#snippet children()}
								<BackToList show={!!selectedGenre} onclick={clearSelection} />
								<span class="flex items-center justify-between">
									Genres
									<Badge variant="secondary">
										{#snippet children()}{genres.length}{/snippet}
									</Badge>
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<Input placeholder="Search genres..." bind:value={searchQuery} />
						<div class="space-y-0.5 mt-3 max-h-list-scroll overflow-y-auto">
							{#each filteredGenres as genre}
								{@const isSelected = selectedGenre === genre.name}
								<button
									onclick={() => selectGenre(genre.name)}
									class="list-item-btn {isSelected ? 'active' : ''}"
								>
									<span class="flex items-center justify-between gap-2">
										<span class="truncate">{genre.name}</span>
										<Badge variant="secondary" class="text-2xs px-1.5 py-0 shrink-0">
											{#snippet children()}{genre.count}{/snippet}
										</Badge>
									</span>
								</button>
							{/each}
							{#if filteredGenres.length === 0}
								<p class="text-sm text-muted-foreground text-center py-4">No genres found</p>
							{/if}
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>

		<!-- Genre Detail -->
		<div bind:this={detailSection} class="lg:col-span-2 space-y-6 scroll-mt-20">
			{#if selectedGenreData}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<div class="min-w-0">
									<div class="flex items-center gap-2">
										<BookType class="h-6 w-6 text-primary shrink-0" />
										<CardTitle class="break-words">
											{#snippet children()}{selectedGenreData.name}{/snippet}
										</CardTitle>
									</div>
									<div class="flex flex-wrap gap-2 mt-3">
										<Badge variant="secondary">
											{#snippet children()}{selectedGenreData.count} item{selectedGenreData.count !==
												1
													? 's'
													: ''}{/snippet}
										</Badge>
										<Badge variant="outline">
											{#snippet children()}{(
													(selectedGenreData.count / $allCollections.length) *
													100
												).toFixed(1)}% of total{/snippet}
										</Badge>
										<WissKILink category="genres" entityKey={selectedGenreData.name} />
									</div>
								</div>
							{/snippet}
						</CardHeader>
					{/snippet}
				</Card>

				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}
										<span class="flex items-center gap-2">
											<FileText class="h-5 w-5 text-muted-foreground" />
											Research Items
											<Badge variant="secondary">
												{#snippet children()}{selectedGenreData.items.length}{/snippet}
											</Badge>
										</span>
									{/snippet}
								</CardTitle>
							{/snippet}
						</CardHeader>
						<CardContent>
							{#snippet children()}
								<ul class="space-y-2">
									{#each paginatedItems as item}
										<CollectionItemRow {item} showType={true} showProject={true} />
									{/each}
								</ul>
								<Pagination
									currentPage={itemPage}
									totalItems={selectedGenreData.items.length}
									{itemsPerPage}
									onPageChange={(p) => (itemPage = p)}
								/>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{:else}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardContent>
							{#snippet children()}
								<div class="flex flex-col items-center justify-center py-16 text-center">
									<BookType class="h-12 w-12 text-muted-foreground/50 mb-4" />
									<p class="text-lg font-medium text-muted-foreground">Select a genre</p>
									<p class="text-sm text-muted-foreground/70 mt-1">
										Choose a genre from the list or click a bar in the chart to view its items
									</p>
								</div>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}
		</div>
	</div>
</div>
