<script lang="ts">
	import { StatCard, ChartCard, BackToList, SEO } from '$lib/components/ui';
	import { WordCloud, EntityKnowledgeGraph } from '$lib/components/charts';
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
	import { goto } from '$app/navigation';
	import { scrollToTop } from '$lib/utils/urlSelection';
	import { createSearchFilter } from '$lib/utils/search';
	import {
		buildCategoryIndex,
		sortedCategoryList,
		categoryToChartData
	} from '$lib/utils/categoryIndex';
	import type { WordCloudDataPoint, CategoryEntry, CollectionItem } from '$lib/types';
	import { BookOpen, Tag, FileText } from '@lucide/svelte';
	import { createEntityDetailState } from '$lib/utils/loaders';

	let searchQuery = $state('');
	let sort = $state<EntitySort>('count-desc');

	// URL-derived state — browser Back auto-restores list / clears selection.
	let viewMode = $derived(
		($page.url.searchParams.get('view') === 'tags' ? 'tags' : 'subjects') as 'subjects' | 'tags'
	);
	let selectedName = $derived($page.url.searchParams.get('name') ?? '');

	let subjectMap = $derived(
		buildCategoryIndex($allCollections, (item) => {
			if (!Array.isArray(item.subject)) return [];
			return item.subject.map((s) => s.authLabel || s.origLabel).filter(Boolean) as string[];
		})
	);

	let tagMap = $derived(
		buildCategoryIndex($allCollections, (item) => {
			if (!Array.isArray(item.tags)) return [];
			return item.tags.filter(Boolean) as string[];
		})
	);

	let subjectList = $derived(sortedCategoryList(subjectMap));
	let tagList = $derived(sortedCategoryList(tagMap));

	let wordCloudData = $derived.by((): WordCloudDataPoint[] => {
		const list = viewMode === 'subjects' ? subjectList : tagList;
		return categoryToChartData(list, 100);
	});
	let currentList = $derived(viewMode === 'subjects' ? subjectList : tagList);
	let currentMap = $derived(viewMode === 'subjects' ? subjectMap : tagMap);

	const searchTerms = createSearchFilter<CategoryEntry>([(t) => t.name]);
	let visibleTerms = $derived(applyEntitySort(searchTerms(currentList, searchQuery), sort));

	// Per-entity JSON (items + aggregates). Direct detail URLs skip the full
	// collections load and render from this.
	const detail = createEntityDetailState(
		() => (viewMode === 'subjects' ? 'subject' : 'tag'),
		() => selectedName
	);

	let selectedTerm = $derived.by((): CategoryEntry | null => {
		if (!selectedName) return null;
		const live = currentMap.get(selectedName);
		if (live && live.items.length > 0) return live;
		if (detail.data?.meta) {
			return {
				name: detail.data.meta.name ?? selectedName,
				count: detail.data.meta.count ?? 0,
				items: detail.items
			};
		}
		return null;
	});

	// Collections power the list view (browse grid, word cloud, counts). Not
	// needed on direct detail URLs — the per-entity JSON has everything
	// required to render that branch.
	onMount(() => {
		if (!selectedName) void ensureCollections(base);
	});

	$effect(() => {
		if (!selectedName) void ensureCollections(base);
	});

	function selectTerm(name: string) {
		goto(`?name=${encodeURIComponent(name)}&view=${viewMode}`, { noScroll: true });
		scrollToTop();
	}

	function clearSelection() {
		goto(`?view=${viewMode}`, { noScroll: true });
		scrollToTop();
	}

	function switchView(mode: 'subjects' | 'tags') {
		searchQuery = '';
		goto(`?view=${mode}`, { noScroll: true });
	}
</script>

<SEO title="Subjects and Tags" description="Browse research items by subject headings and tags" />

<div class="space-y-8 animate-slide-in-up">
	<div>
		<h1 class="page-title">Subjects & Tags</h1>
		<p class="page-subtitle">
			Browse research items by controlled subjects (LCSH) and free-form tags
		</p>
	</div>

	{#if selectedName}
		<div class="space-y-6">
			<BackToList
				show={true}
				onclick={clearSelection}
				label={`Back to ${viewMode === 'subjects' ? 'subjects' : 'tags'}`}
			/>
			{#if selectedTerm}
				<EntityDetailHeader
					title={selectedTerm.name}
					icon={Tag}
					subtitle={viewMode === 'subjects' ? 'LCSH subject heading' : 'Free-form tag'}
					count={selectedTerm.count}
					wisskiCategory={viewMode === 'subjects' ? 'subjects' : 'tags'}
					wisskiKey={selectedTerm.name}
				/>
				<SearchableItemsCard items={selectedTerm.items as CollectionItem[]} />
				<EntityDashboardSection
					entityType={viewMode === 'subjects' ? 'subject' : 'tag'}
					entityId={selectedTerm.name}
					items={selectedTerm.items as CollectionItem[]}
					data={detail.data}
				/>
				<EntityKnowledgeGraph
					entityType={viewMode === 'subjects' ? 'subject' : 'tag'}
					entityId={selectedTerm.name}
					title={viewMode === 'subjects'
						? 'Subject co-occurrence graph'
						: 'Tag neighbourhood graph'}
				/>
			{:else if detail.loading}
				<p class="text-sm text-muted-foreground">Loading dashboard…</p>
			{:else}
				<p class="text-sm text-muted-foreground">No data available.</p>
			{/if}
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-3">
			<StatCard label="Subjects (LCSH)" value={subjectList.length} icon={BookOpen} />
			<StatCard label="Tags" value={tagList.length} icon={Tag} />
			<StatCard label="Total Items" value={$allCollections.length} icon={FileText} />
		</div>

		<ChartCard
			title="{viewMode === 'subjects' ? 'Subject' : 'Tag'} Cloud"
			subtitle="Click a word to open its page"
			contentHeight="h-chart-md"
		>
			{#if wordCloudData.length > 0}
				<WordCloud data={wordCloudData} onclick={(word) => selectTerm(word)} />
			{/if}
		</ChartCard>

		<!-- View switcher -->
		<div class="flex rounded-lg border border-input overflow-hidden w-fit">
			<button
				onclick={() => switchView('subjects')}
				class="px-4 py-2 text-sm font-medium transition-colors {viewMode === 'subjects'
					? 'bg-primary text-primary-foreground'
					: 'hover:bg-muted'}"
			>
				Subjects
			</button>
			<button
				onclick={() => switchView('tags')}
				class="px-4 py-2 text-sm font-medium transition-colors {viewMode === 'tags'
					? 'bg-primary text-primary-foreground'
					: 'hover:bg-muted'}"
			>
				Tags
			</button>
		</div>

		<EntityToolbar
			{searchQuery}
			onSearchChange={(v) => (searchQuery = v)}
			searchPlaceholder="Search {viewMode}..."
			{sort}
			onSortChange={(v) => (sort = v)}
			totalCount={visibleTerms.length}
			totalLabel={viewMode}
		/>

		<EntityBrowseGrid
			items={visibleTerms}
			getKey={(t) => t.name}
			emptyMessage="No {viewMode} match your search"
		>
			{#snippet card(term)}
				<EntityCard
					name={term.name}
					description={viewMode === 'subjects' ? 'LCSH heading' : 'Free-form tag'}
					count={term.count}
					countLabel="item"
					icon={Tag}
					onclick={() => selectTerm(term.name)}
				/>
			{/snippet}
		</EntityBrowseGrid>
	{/if}
</div>
