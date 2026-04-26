<script lang="ts">
	import { StatCard, ChartCard, BackToList, SEO } from '$lib/components/ui';
	import { BarChart, BoxPlot } from '$lib/components/charts';
	import { EntityDashboardSection } from '$lib/components/dashboards';
	import type { BarChartDataPoint, BoxPlotGroup } from '$lib/types';
	import {
		EntityCard,
		EntityBrowseGrid,
		EntityToolbar,
		EntityDetailHeader,
		SearchableItemsCard,
		applyEntitySort,
		type EntitySort
	} from '$lib/components/entity-browse';
	import { allCollections, groups as groupsStore, ensureCollections } from '$lib/stores/data';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import type { CollectionItem } from '$lib/types';
	import { createSearchFilter } from '$lib/utils/search';
	import { UsersRound, FileText } from '@lucide/svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { createEntityDetailState } from '$lib/utils/loaders';

	const urlSelection = createUrlSelection('name');

	let searchQuery = $state('');
	let sort = $state<EntitySort>('count-desc');

	let selectedName = $derived($page.url.searchParams.get('name') ?? '');

	interface GroupData {
		name: string;
		count: number;
	}

	let groupMap = $derived.by(() => {
		const map = new SvelteMap<string, GroupData>();

		const getOrCreate = (name: string): GroupData => {
			if (!map.has(name)) map.set(name, { name, count: 0 });
			return map.get(name)!;
		};

		$groupsStore.forEach((g) => getOrCreate(g.name));

		$allCollections.forEach((item) => {
			if (!Array.isArray(item.name)) return;
			item.name.forEach((n) => {
				if (n?.name?.label && n?.name?.qualifier === 'group') {
					getOrCreate(n.name.label).count++;
				}
			});
		});

		return map;
	});

	let allGroups = $derived(Array.from(groupMap.values()));
	let groupsWithItems = $derived(allGroups.filter((g) => g.count > 0));

	let topGroupsBar = $derived.by((): BarChartDataPoint[] => {
		return groupsWithItems
			.slice()
			.sort((a, b) => b.count - a.count)
			.slice(0, 15)
			.map((g) => ({ name: g.name, value: g.count }));
	});

	// Distribution of items-per-group — flags whether activity is heavily
	// concentrated in a few groups or spread evenly.
	let groupSizeDistribution = $derived.by((): BoxPlotGroup[] => {
		const values = groupsWithItems.map((g) => g.count);
		if (values.length === 0) return [];
		return [{ name: 'Items per group', values }];
	});

	const searchGroups = createSearchFilter<GroupData>([(g) => g.name]);
	let visibleGroups = $derived(applyEntitySort(searchGroups(allGroups, searchQuery), sort));

	const detail = createEntityDetailState('group', () => selectedName);

	let selectedGroup = $derived.by((): GroupData | null => {
		if (!selectedName) return null;
		const live = groupMap.get(selectedName);
		if (live) return live;
		if (detail.data?.meta) {
			return {
				name: detail.data.meta.name ?? selectedName,
				count: detail.data.meta.count ?? 0
			};
		}
		return null;
	});

	let groupItems = $derived.by((): CollectionItem[] => {
		// Prefer the precomputed JSON's items so direct-detail-URL hits don't
		// wait on (or trigger) the 13 MB collections dump.
		if (detail.items.length > 0) return detail.items;
		if (!selectedGroup) return [];
		const name = selectedGroup.name;
		const seen = new SvelteSet<string>();
		const results: CollectionItem[] = [];
		$allCollections.forEach((item) => {
			const id = item._id || item.dre_id;
			if (seen.has(id)) return;
			if (!Array.isArray(item.name)) return;
			if (item.name.some((n) => n?.name?.label === name && n?.name?.qualifier === 'group')) {
				seen.add(id);
				results.push(item);
			}
		});
		return results;
	});

	onMount(() => {
		if (!selectedName) void ensureCollections(base);
	});

	$effect(() => {
		if (!selectedName) void ensureCollections(base);
	});

	function selectGroup(name: string) {
		urlSelection.pushToUrl(name);
		scrollToTop();
	}

	function clearSelection() {
		urlSelection.removeFromUrl();
		scrollToTop();
	}
</script>

<SEO title="Groups" description="Browse groups featured in the research items" />

<div class="space-y-8 animate-slide-in-up">
	<div>
		<h1 class="page-title">Groups</h1>
		<p class="page-subtitle">Browse groups featured in the research items</p>
	</div>

	{#if selectedName}
		<div class="space-y-6">
			<BackToList show={true} onclick={clearSelection} label="Back to groups" />
			{#if selectedGroup}
				<EntityDetailHeader
					title={selectedGroup.name}
					icon={UsersRound}
					count={selectedGroup.count}
					countLabel="item"
					wisskiCategory="groups"
					wisskiKey={selectedGroup.name}
				/>
				<SearchableItemsCard
					items={groupItems}
					emptyMessage="No research items associated with this group."
				/>
				<EntityDashboardSection
					entityType="group"
					entityId={selectedGroup.name}
					items={groupItems}
					data={detail.data}
				/>
			{:else if detail.loading}
				<p class="text-sm text-muted-foreground">Loading dashboard…</p>
			{:else}
				<p class="text-sm text-muted-foreground">No data available for this group.</p>
			{/if}
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2">
			<StatCard label="Total Groups" value={allGroups.length} icon={UsersRound} />
			<StatCard label="With Items" value={groupsWithItems.length} icon={FileText} />
		</div>

		<div class="grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[2fr_1fr]">
			{#if topGroupsBar.length > 0}
				<ChartCard
					title="Top groups"
					subtitle="Click a bar to open a group"
					contentHeight="h-chart-md"
				>
					<BarChart data={topGroupsBar} onclick={(name) => selectGroup(name)} />
				</ChartCard>
			{/if}

			{#if groupSizeDistribution.length > 0}
				<ChartCard
					title="Group size distribution"
					subtitle="How items are spread across groups"
					contentHeight="h-chart-md"
				>
					<BoxPlot data={groupSizeDistribution} valueAxisLabel="Items" class="h-full w-full" />
				</ChartCard>
			{/if}
		</div>

		<EntityToolbar
			{searchQuery}
			onSearchChange={(v) => (searchQuery = v)}
			searchPlaceholder="Search groups..."
			{sort}
			onSortChange={(v) => (sort = v)}
			totalCount={visibleGroups.length}
			totalLabel="groups"
		/>

		<EntityBrowseGrid
			items={visibleGroups}
			getKey={(g) => g.name}
			emptyMessage="No groups match your search"
		>
			{#snippet card(grp)}
				<EntityCard
					name={grp.name}
					description="Group"
					count={grp.count}
					countLabel="item"
					icon={UsersRound}
					onclick={() => selectGroup(grp.name)}
				/>
			{/snippet}
		</EntityBrowseGrid>
	{/if}
</div>
