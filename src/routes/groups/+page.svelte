<script lang="ts">
	import { StatCard, BackToList, SEO } from '$lib/components/ui';
	import {
		EntityCard,
		EntityBrowseGrid,
		EntityToolbar,
		EntityDetailHeader,
		EntityItemsCard,
		applyEntitySort,
		type EntitySort
	} from '$lib/components/entity-browse';
	import { allCollections, groups as groupsStore } from '$lib/stores/data';
	import { page } from '$app/stores';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import type { CollectionItem } from '$lib/types';
	import { createSearchFilter } from '$lib/utils/search';
	import { UsersRound, FileText } from '@lucide/svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

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

	const searchGroups = createSearchFilter<GroupData>([(g) => g.name]);
	let visibleGroups = $derived(applyEntitySort(searchGroups(allGroups, searchQuery), sort));

	let selectedGroup = $derived(selectedName ? groupMap.get(selectedName) || null : null);

	let groupItems = $derived.by((): CollectionItem[] => {
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

	{#if selectedGroup}
		<div class="space-y-6">
			<BackToList show={true} onclick={clearSelection} label="Back to groups" />
			<EntityDetailHeader
				title={selectedGroup.name}
				icon={UsersRound}
				count={selectedGroup.count}
				countLabel="item"
				wisskiCategory="groups"
				wisskiKey={selectedGroup.name}
			/>
			<EntityItemsCard
				items={groupItems}
				emptyMessage="No research items associated with this group."
			/>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2">
			<StatCard label="Total Groups" value={allGroups.length} icon={UsersRound} />
			<StatCard label="With Items" value={groupsWithItems.length} icon={FileText} />
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
