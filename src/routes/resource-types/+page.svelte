<script lang="ts">
	import { StatCard, ChartCard, BackToList, SEO } from '$lib/components/ui';
	import { PieChart, BarChart } from '$lib/components/charts';
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
	import type { CategoryEntry } from '$lib/types';
	import { FileText, Layers } from '@lucide/svelte';
	import { createEntityDetailState } from '$lib/utils/loaders';

	const urlSelection = createUrlSelection('type');

	let searchQuery = $state('');
	let sort = $state<EntitySort>('count-desc');

	let selectedType = $derived($page.url.searchParams.get('type') ?? '');

	let typeMap = $derived(
		buildCategoryIndex($allCollections, (item) => [item.typeOfResource || 'Unknown'])
	);
	let types = $derived(sortedCategoryList(typeMap));

	const detail = createEntityDetailState('resource-type', () => selectedType);

	let selectedTypeData = $derived.by((): CategoryEntry | null => {
		if (!selectedType) return null;
		const live = typeMap.get(selectedType);
		if (live && live.items.length > 0) return live;
		if (detail.data?.meta) {
			return {
				name: detail.data.meta.name ?? selectedType,
				count: detail.data.meta.count ?? 0,
				items: detail.items
			};
		}
		return null;
	});

	onMount(() => {
		if (!selectedType) void ensureCollections(base);
	});

	$effect(() => {
		if (!selectedType) void ensureCollections(base);
	});

	const searchTypes = createSearchFilter<CategoryEntry>([(t) => t.name]);
	let visibleTypes = $derived(applyEntitySort(searchTypes(types, searchQuery), sort));

	let pieData = $derived(categoryToChartData(types));
	let barData = $derived(categoryToChartData(types));

	function selectType(type: string) {
		urlSelection.pushToUrl(type);
		scrollToTop();
	}

	function clearSelection() {
		urlSelection.removeFromUrl();
		scrollToTop();
	}
</script>

<SEO title="Resource Types" description="Browse research items organized by resource type" />

<div class="space-y-8 animate-slide-in-up">
	<div>
		<h1 class="page-title">Resource Types</h1>
		<p class="page-subtitle">Browse research items by their resource type classification</p>
	</div>

	{#if selectedType}
		<div class="space-y-6">
			<BackToList show={true} onclick={clearSelection} label="Back to resource types" />
			{#if selectedTypeData}
				<EntityDetailHeader
					title={selectedTypeData.name}
					icon={FileText}
					count={selectedTypeData.count}
					percentOfTotal={$allCollections.length
						? (selectedTypeData.count / $allCollections.length) * 100
						: undefined}
					wisskiCategory="resourceTypes"
					wisskiKey={selectedTypeData.name}
				/>
				<SearchableItemsCard items={selectedTypeData.items} showType={false} showProject={true} />
				<EntityDashboardSection
					entityType="resource-type"
					entityId={selectedTypeData.name}
					items={selectedTypeData.items}
					data={detail.data}
				/>
			{:else if detail.loading}
				<p class="text-sm text-muted-foreground">Loading dashboard…</p>
			{:else}
				<p class="text-sm text-muted-foreground">No data available for this type.</p>
			{/if}
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-3">
			<StatCard label="Resource Types" value={types.length} icon={Layers} />
			<StatCard label="Total Items" value={$allCollections.length} icon={FileText} />
			<StatCard label="Most Common" value={types[0]?.name || '—'} icon={FileText} />
		</div>

		<div class="grid gap-6 md:grid-cols-2">
			<ChartCard title="Distribution" subtitle="Click a segment to open" contentHeight="h-chart-md">
				{#if pieData.length > 0}
					<PieChart data={pieData} onclick={(name) => selectType(name)} />
				{/if}
			</ChartCard>
			<ChartCard title="Item counts" subtitle="Click a bar to open" contentHeight="h-chart-md">
				{#if barData.length > 0}
					<BarChart data={barData} onclick={(name) => selectType(name)} />
				{/if}
			</ChartCard>
		</div>

		<EntityToolbar
			{searchQuery}
			onSearchChange={(v) => (searchQuery = v)}
			searchPlaceholder="Search resource types..."
			{sort}
			onSortChange={(v) => (sort = v)}
			totalCount={visibleTypes.length}
			totalLabel="types"
		/>

		<EntityBrowseGrid
			items={visibleTypes}
			getKey={(t) => t.name}
			emptyMessage="No resource types match your search"
		>
			{#snippet card(type)}
				<EntityCard
					name={type.name}
					description="Resource type"
					count={type.count}
					countLabel="item"
					icon={FileText}
					onclick={() => selectType(type.name)}
				/>
			{/snippet}
		</EntityBrowseGrid>
	{/if}
</div>
