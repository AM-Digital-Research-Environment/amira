<script lang="ts">
	import { StatCard, ChartCard, BackToList, SEO } from '$lib/components/ui';
	import { PieChart, BarChart, StackedAreaChart, HeatmapChart } from '$lib/components/charts';
	import { EntityDashboardSection } from '$lib/components/dashboards';
	import {
		EntityCard,
		EntityBrowseGrid,
		EntityToolbar,
		EntityDetailHeader,
		SearchableItemsCard,
		applyEntitySort,
		useEntityCollectionLoader,
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
	import { extractItemYear } from '$lib/utils/transforms/dates';
	import { languageName, normalizeLanguageCode } from '$lib/utils/languages';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { CategoryEntry, StackedAreaDataPoint, HeatmapDataPoint } from '$lib/types';
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

	useEntityCollectionLoader(() => selectedType);

	const searchTypes = createSearchFilter<CategoryEntry>([(t) => t.name]);
	let visibleTypes = $derived(applyEntitySort(searchTypes(types, searchQuery), sort));

	let pieData = $derived(categoryToChartData(types));
	let barData = $derived(categoryToChartData(types));

	// Top-N resource types over time, stacked. Smaller types fold into "Other".
	const TOP_TYPE_SERIES = 8;
	let topTypeNames = $derived(types.slice(0, TOP_TYPE_SERIES).map((t) => t.name));

	let typeTimelineData = $derived.by((): StackedAreaDataPoint[] => {
		const top = new SvelteSet(topTypeNames);
		const byYear = new SvelteMap<number, Record<string, number>>();
		for (const item of $allCollections) {
			const year = extractItemYear(item);
			if (year == null) continue;
			const rtype = item.typeOfResource || 'Unknown';
			const bucket = top.has(rtype) ? rtype : 'Other';
			let row = byYear.get(year);
			if (!row) {
				row = {};
				byYear.set(year, row);
			}
			row[bucket] = (row[bucket] ?? 0) + 1;
		}
		return Array.from(byYear.entries())
			.sort(([a], [b]) => a - b)
			.map(([year, byCategory]) => ({ year, byCategory }));
	});

	// Heatmap: type (y) × language (x). Top 10 of each.
	let typeLanguageHeatmap = $derived.by((): HeatmapDataPoint[] => {
		const langTotals = new SvelteMap<string, number>();
		const typeTotals = new SvelteMap<string, number>();
		const cell = new SvelteMap<string, number>();
		for (const item of $allCollections) {
			const codes = item.language || [];
			if (codes.length === 0) continue;
			const rtype = item.typeOfResource || 'Unknown';
			typeTotals.set(rtype, (typeTotals.get(rtype) ?? 0) + 1);
			const seen = new SvelteSet<string>();
			for (const raw of codes) {
				const name = languageName(normalizeLanguageCode(raw));
				if (seen.has(name)) continue;
				seen.add(name);
				langTotals.set(name, (langTotals.get(name) ?? 0) + 1);
				const key = `${name}|${rtype}`;
				cell.set(key, (cell.get(key) ?? 0) + 1);
			}
		}
		const topLangs = Array.from(langTotals.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([n]) => n);
		const topTypes = Array.from(typeTotals.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([n]) => n);
		const result: HeatmapDataPoint[] = [];
		for (const l of topLangs) {
			for (const t of topTypes) {
				const v = cell.get(`${l}|${t}`) ?? 0;
				if (v > 0) result.push({ x: l, y: t, value: v });
			}
		}
		return result;
	});

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

		{#if typeTimelineData.length > 0}
			<ChartCard
				title="Resource types over time"
				subtitle="Top {TOP_TYPE_SERIES} types by item count, with smaller types folded into 'Other'"
				contentHeight="h-chart-lg"
			>
				<StackedAreaChart data={typeTimelineData} class="h-full w-full" />
			</ChartCard>
		{/if}

		{#if typeLanguageHeatmap.length > 0}
			<ChartCard
				title="Resource type × language"
				subtitle="How types and languages overlap across the archive"
				contentHeight="h-chart-lg"
			>
				<HeatmapChart data={typeLanguageHeatmap} class="h-full w-full" />
			</ChartCard>
		{/if}

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
