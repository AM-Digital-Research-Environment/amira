<script lang="ts">
	import { StatCard, ChartCard, Card, CardHeader, CardTitle, CardContent, Badge, Pagination, BackToList, CollectionItemRow } from '$lib/components/ui';
	import { PieChart, BarChart } from '$lib/components/charts';
	import { allCollections } from '$lib/stores/data';
	import { page } from '$app/stores';
	import { createUrlSelection, scrollToElement } from '$lib/utils/urlSelection';
	import { paginate } from '$lib/utils/pagination';
	import type { CollectionItem } from '$lib/types';
	import { FileText, Layers } from '@lucide/svelte';
	import { WissKILink } from '$lib/components/ui';

	const urlSelection = createUrlSelection('type');

	let selectedType = $state('');

	// Sync from URL query param
	$effect(() => {
		const urlType = $page.url.searchParams.get('type');
		if (urlType) selectedType = urlType;
	});

	// Build resource type index
	interface TypeData {
		name: string;
		count: number;
		items: CollectionItem[];
	}

	let typeMap = $derived.by(() => {
		const map = new Map<string, TypeData>();
		$allCollections.forEach((item) => {
			const type = item.typeOfResource || 'Unknown';
			if (!map.has(type)) map.set(type, { name: type, count: 0, items: [] });
			const entry = map.get(type)!;
			entry.count++;
			entry.items.push(item);
		});
		return map;
	});

	let types = $derived(Array.from(typeMap.values()).sort((a, b) => b.count - a.count));

	let selectedTypeData = $derived(selectedType ? typeMap.get(selectedType) || null : null);

	// Chart data
	let pieData = $derived(types.map((t) => ({ name: t.name, value: t.count })));
	let barData = $derived(types.map((t) => ({ name: t.name, value: t.count })));

	// Pagination
	const itemsPerPage = 10;
	let itemPage = $state(0);
	let paginatedItems = $derived.by(() => {
		if (!selectedTypeData) return [];
		return paginate(selectedTypeData.items, itemPage, itemsPerPage);
	});

	let detailSection: HTMLDivElement | undefined = $state();

	$effect(() => {
		selectedType;
		itemPage = 0;
	});

	function selectType(type: string) {
		selectedType = type;
		urlSelection.pushToUrl(type);
		scrollToElement(detailSection);
	}

	function clearSelection() {
		selectedType = '';
		urlSelection.removeFromUrl();
	}

</script>

<div class="space-y-8 animate-slide-in-up">
	<div>
		<h1 class="page-title">Resource Types</h1>
		<p class="page-subtitle">Browse research items by their resource type classification</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		<StatCard label="Resource Types" value={types.length} icon={Layers} />
		<StatCard label="Total Items" value={$allCollections.length} icon={FileText} />
		<StatCard label="Most Common" value={types[0]?.name || '—'} icon={FileText} />
	</div>

	<!-- Charts -->
	<div class="grid gap-6 md:grid-cols-2">
		<ChartCard title="Distribution" subtitle="Click a segment to view items" contentHeight="h-[350px]">
			{#if pieData.length > 0}
				<PieChart data={pieData} onclick={(name) => selectType(name)} />
			{/if}
		</ChartCard>
		<ChartCard title="Item Counts" subtitle="Click a bar to view items" contentHeight="h-[350px]">
			{#if barData.length > 0}
				<BarChart data={barData} onclick={(name) => selectType(name)} />
			{/if}
		</ChartCard>
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Type List -->
		<Card class="lg:col-span-1 lg:sticky lg:top-20 lg:self-start overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle>
							{#snippet children()}
								<BackToList show={!!selectedType} onclick={clearSelection} />
								<span class="flex items-center justify-between">
									Types
									<Badge variant="secondary">
										{#snippet children()}{types.length}{/snippet}
									</Badge>
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="space-y-0.5">
							{#each types as type}
								{@const isSelected = selectedType === type.name}
								<button
									onclick={() => selectType(type.name)}
									class="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors {isSelected ? 'bg-primary/10 text-primary font-medium' : ''}"
								>
									<span class="flex items-center justify-between gap-2">
										<span>{type.name}</span>
										<Badge variant="secondary" class="text-[10px] px-1.5 py-0 shrink-0">
											{#snippet children()}{type.count}{/snippet}
										</Badge>
									</span>
								</button>
							{/each}
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>

		<!-- Type Detail -->
		<div bind:this={detailSection} class="lg:col-span-2 space-y-6 scroll-mt-20">
			{#if selectedTypeData}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<div class="min-w-0">
									<div class="flex items-center gap-2">
										<FileText class="h-6 w-6 text-primary shrink-0" />
										<CardTitle class="break-words">
											{#snippet children()}{selectedTypeData.name}{/snippet}
										</CardTitle>
									</div>
									<div class="flex flex-wrap gap-2 mt-3">
										<Badge variant="secondary">
											{#snippet children()}{selectedTypeData.count} item{selectedTypeData.count !== 1 ? 's' : ''}{/snippet}
										</Badge>
										<Badge variant="outline">
											{#snippet children()}{(selectedTypeData.count / $allCollections.length * 100).toFixed(1)}% of total{/snippet}
										</Badge>
										<WissKILink category="resourceTypes" entityKey={selectedTypeData.name} />
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
												{#snippet children()}{selectedTypeData.items.length}{/snippet}
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
										<CollectionItemRow {item} showType={false} showProject={true} />
									{/each}
								</ul>
								<Pagination
									currentPage={itemPage}
									totalItems={selectedTypeData.items.length}
									{itemsPerPage}
									onPageChange={(p) => itemPage = p}
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
									<Layers class="h-12 w-12 text-muted-foreground/50 mb-4" />
									<p class="text-lg font-medium text-muted-foreground">Select a resource type</p>
									<p class="text-sm text-muted-foreground/70 mt-1">
										Choose a type from the list or click a chart segment to view its items
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
