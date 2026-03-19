<script lang="ts">
	import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, Input, Pagination, CollectionItemRow, BackToList, SEO } from '$lib/components/ui';
	import { allCollections, groups as groupsStore } from '$lib/stores/data';
	import { page } from '$app/stores';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import type { CollectionItem } from '$lib/types';
	import { createSearchFilter } from '$lib/utils/search';
	import { paginate } from '$lib/utils/pagination';
	import { UsersRound, FileText } from '@lucide/svelte';
	import { WissKILink } from '$lib/components/ui';

	const urlSelection = createUrlSelection('name');

	let searchQuery = $state('');
	let selectedName = $state('');

	// Sync from URL query param
	$effect(() => {
		const urlName = $page.url.searchParams.get('name');
		if (urlName) selectedName = urlName;
	});

	interface GroupData {
		name: string;
		collectionItemCount: number;
	}

	let groupMap = $derived.by(() => {
		const map = new Map<string, GroupData>();

		const getOrCreate = (name: string): GroupData => {
			if (!map.has(name)) {
				map.set(name, { name, collectionItemCount: 0 });
			}
			return map.get(name)!;
		};

		// Seed from dev.groups.json
		$groupsStore.forEach((g) => {
			getOrCreate(g.name);
		});

		// From collection item contributors with qualifier 'group'
		$allCollections.forEach((item) => {
			if (!Array.isArray(item.name)) return;
			item.name.forEach((n) => {
				if (n?.name?.label && n?.name?.qualifier === 'group') {
					const grp = getOrCreate(n.name.label);
					grp.collectionItemCount++;
				}
			});
		});

		return map;
	});

	let allGroups = $derived(
		Array.from(groupMap.values())
			.sort((a, b) => b.collectionItemCount - a.collectionItemCount || a.name.localeCompare(b.name))
	);

	let groupsWithItems = $derived(allGroups.filter((g) => g.collectionItemCount > 0));

	const searchGroups = createSearchFilter<GroupData>([(g) => g.name]);

	let filteredGroups = $derived(searchGroups(allGroups, searchQuery));

	let selectedGroup = $derived(selectedName ? groupMap.get(selectedName) || null : null);

	// Collection items for selected group
	let groupCollectionItems = $derived.by((): CollectionItem[] => {
		if (!selectedGroup) return [];
		const name = selectedGroup.name;
		const seen = new Set<string>();
		const results: CollectionItem[] = [];
		$allCollections.forEach((item) => {
			const id = item._id || item.dre_id;
			if (seen.has(id)) return;
			if (!Array.isArray(item.name)) return;
			const isContributor = item.name.some(
				(n) => n?.name?.label === name && n?.name?.qualifier === 'group'
			);
			if (isContributor) {
				seen.add(id);
				results.push(item);
			}
		});
		return results;
	});

	const collectionPerPage = 10;
	let collectionPage = $state(0);
	let paginatedCollectionItems = $derived(paginate(groupCollectionItems, collectionPage, collectionPerPage));

	$effect(() => {
		selectedName;
		collectionPage = 0;
	});

	function selectGroup(name: string) {
		selectedName = name;
		urlSelection.pushToUrl(name);
		scrollToTop();
	}

	function clearSelection() {
		selectedName = '';
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

	<div class="grid gap-4 sm:grid-cols-2">
		<StatCard label="Total Groups" value={allGroups.length} icon={UsersRound} />
		<StatCard label="With Items" value={groupsWithItems.length} icon={FileText} />
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Group List -->
		<Card class="lg:col-span-1 lg:sticky lg:top-20 lg:self-start overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle>
							{#snippet children()}
								<BackToList show={!!selectedName} onclick={clearSelection} />
								<span class="flex items-center justify-between">
									Groups
									<Badge variant="secondary">
										{#snippet children()}{filteredGroups.length}{/snippet}
									</Badge>
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="space-y-3">
							<Input placeholder="Search groups..." bind:value={searchQuery} />
							<div class="space-y-1 max-h-[60vh] overflow-y-auto">
								{#each filteredGroups as grp}
									{@const isSelected = selectedName === grp.name}
									<button
										onclick={() => selectGroup(grp.name)}
										class="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors {isSelected ? 'bg-primary/10 text-primary font-medium' : ''}"
									>
										<span class="break-words">{grp.name}</span>
										{#if grp.collectionItemCount > 0}
											<span class="text-xs text-muted-foreground mt-0.5 block">
												{grp.collectionItemCount} item{grp.collectionItemCount !== 1 ? 's' : ''}
											</span>
										{/if}
									</button>
								{/each}
								{#if filteredGroups.length === 0}
									<p class="text-sm text-muted-foreground text-center py-4">No groups found</p>
								{/if}
							</div>
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>

		<!-- Group Detail -->
		<div class="lg:col-span-2 space-y-6">
			{#if selectedGroup}
				<!-- Header -->
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<div class="min-w-0">
									<CardTitle class="break-words">
										{#snippet children()}{selectedGroup.name}{/snippet}
									</CardTitle>
									<div class="flex flex-wrap gap-2 mt-3">
										{#if selectedGroup.collectionItemCount > 0}
											<Badge variant="outline">
												{#snippet children()}{selectedGroup.collectionItemCount} collection item{selectedGroup.collectionItemCount !== 1 ? 's' : ''}{/snippet}
											</Badge>
										{/if}
										<WissKILink category="groups" entityKey={selectedGroup.name} />
									</div>
								</div>
							{/snippet}
						</CardHeader>
					{/snippet}
				</Card>

				<!-- Research Items -->
				{#if groupCollectionItems.length > 0}
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
													{#snippet children()}{groupCollectionItems.length}{/snippet}
												</Badge>
											</span>
										{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<ul class="space-y-2">
										{#each paginatedCollectionItems as item}
											<CollectionItemRow {item} showProject={false} />
										{/each}
									</ul>
									<Pagination
										currentPage={collectionPage}
										totalItems={groupCollectionItems.length}
										itemsPerPage={collectionPerPage}
										onPageChange={(p) => collectionPage = p}
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
									<p class="text-sm text-muted-foreground text-center py-8">
										No research items associated with this group
									</p>
								{/snippet}
							</CardContent>
						{/snippet}
					</Card>
				{/if}

			{:else}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardContent>
							{#snippet children()}
								<div class="flex flex-col items-center justify-center py-16 text-center">
									<UsersRound class="h-12 w-12 text-muted-foreground/50 mb-4" />
									<p class="text-lg font-medium text-muted-foreground">Select a group</p>
									<p class="text-sm text-muted-foreground/70 mt-1">
										Choose a group from the list to view its associated research items
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
