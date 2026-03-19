<script lang="ts">
	import { StatCard, ChartCard, Card, CardHeader, CardTitle, CardContent, Badge, Input, Pagination, CollectionItemRow, BackToList } from '$lib/components/ui';
	import { WordCloud } from '$lib/components/charts';
	import { allCollections } from '$lib/stores/data';
	import { page } from '$app/stores';
	import { createUrlSelection, scrollToElement, scrollToTop } from '$lib/utils/urlSelection';
	import { createSearchFilter } from '$lib/utils/search';
	import { paginate } from '$lib/utils/pagination';
	import type { CollectionItem, WordCloudDataPoint } from '$lib/types';
	import { BookOpen, Tag, FileText } from '@lucide/svelte';
	import { WissKILink } from '$lib/components/ui';

	const urlSelection = createUrlSelection('name');

	let searchQuery = $state('');
	let selectedName = $state('');
	let viewMode = $state<'subjects' | 'tags'>('subjects');

	// Sync from URL query params
	$effect(() => {
		const urlName = $page.url.searchParams.get('name');
		const urlView = $page.url.searchParams.get('view');
		if (urlView === 'tags') viewMode = 'tags';
		else if (urlView === 'subjects') viewMode = 'subjects';
		if (urlName) selectedName = urlName;
	});

	interface TermData {
		name: string;
		count: number;
		items: CollectionItem[];
	}

	// Build subject index (LCSH controlled vocabulary)
	let subjectMap = $derived.by(() => {
		const map = new Map<string, TermData>();
		$allCollections.forEach((item) => {
			if (!Array.isArray(item.subject)) return;
			item.subject.forEach((s) => {
				const label = s.authLabel || s.origLabel;
				if (!label) return;
				if (!map.has(label)) map.set(label, { name: label, count: 0, items: [] });
				const entry = map.get(label)!;
				entry.count++;
				entry.items.push(item);
			});
		});
		return map;
	});

	// Build tag index (free-form keywords)
	let tagMap = $derived.by(() => {
		const map = new Map<string, TermData>();
		$allCollections.forEach((item) => {
			if (!Array.isArray(item.tags)) return;
			item.tags.forEach((t) => {
				if (!t) return;
				if (!map.has(t)) map.set(t, { name: t, count: 0, items: [] });
				const entry = map.get(t)!;
				entry.count++;
				entry.items.push(item);
			});
		});
		return map;
	});

	let subjectList = $derived(Array.from(subjectMap.values()).sort((a, b) => b.count - a.count));
	let tagList = $derived(Array.from(tagMap.values()).sort((a, b) => b.count - a.count));

	// Word cloud data
	let wordCloudData = $derived.by((): WordCloudDataPoint[] => {
		const list = viewMode === 'subjects' ? subjectList : tagList;
		return list.slice(0, 100).map((t) => ({ name: t.name, value: t.count }));
	});
	let currentList = $derived(viewMode === 'subjects' ? subjectList : tagList);
	let currentMap = $derived(viewMode === 'subjects' ? subjectMap : tagMap);

	const searchTerms = createSearchFilter<TermData>([(t) => t.name]);

	let filteredTerms = $derived(searchTerms(currentList, searchQuery));

	let selectedTerm = $derived(selectedName ? currentMap.get(selectedName) || null : null);

	// Pagination
	const itemsPerPage = 10;
	let itemPage = $state(0);
	let paginatedItems = $derived.by(() => {
		if (!selectedTerm) return [];
		return paginate(selectedTerm.items, itemPage, itemsPerPage);
	});

	$effect(() => {
		selectedName;
		itemPage = 0;
	});

	let detailSection: HTMLDivElement | undefined = $state();

	function selectTerm(name: string) {
		selectedName = name;
		// Push both name and view params in a single history entry
		const url = new URL(window.location.href);
		url.searchParams.set('name', name);
		url.searchParams.set('view', viewMode);
		history.pushState({}, '', url.toString());
		scrollToElement(detailSection);
	}

	function clearSelection() {
		selectedName = '';
		urlSelection.removeFromUrl();
		scrollToTop();
	}

	function switchView(mode: 'subjects' | 'tags') {
		viewMode = mode;
		selectedName = '';
		searchQuery = '';
		const url = new URL(window.location.href);
		url.searchParams.set('view', mode);
		url.searchParams.delete('name');
		history.pushState({}, '', url.toString());
	}

</script>

<div class="space-y-8 animate-slide-in-up">
	<div>
		<h1 class="page-title">Subjects & Tags</h1>
		<p class="page-subtitle">Browse research items by controlled subjects (LCSH) and free-form tags</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		<StatCard label="Subjects (LCSH)" value={subjectList.length} icon={BookOpen} />
		<StatCard label="Tags" value={tagList.length} icon={Tag} />
		<StatCard label="Total Items" value={$allCollections.length} icon={FileText} />
	</div>

	<!-- Word Cloud -->
	<ChartCard title="{viewMode === 'subjects' ? 'Subject' : 'Tag'} Cloud" subtitle="Click on a word to view its associated items" contentHeight="h-[350px]">
		{#if wordCloudData.length > 0}
			<WordCloud data={wordCloudData} onclick={(word) => selectTerm(word)} />
		{/if}
	</ChartCard>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Term List -->
		<Card class="lg:col-span-1 lg:sticky lg:top-20 lg:self-start overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle>
							{#snippet children()}
								<BackToList show={!!selectedName} onclick={clearSelection} />
								<span class="flex items-center justify-between">
									{viewMode === 'subjects' ? 'Subjects' : 'Tags'}
									<Badge variant="secondary">
										{#snippet children()}{filteredTerms.length}{/snippet}
									</Badge>
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="space-y-3">
							<!-- View mode toggle -->
							<div class="flex rounded-lg border border-input overflow-hidden">
								<button
									onclick={() => switchView('subjects')}
									class="flex-1 px-3 py-1.5 text-sm font-medium transition-colors {viewMode === 'subjects' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
								>
									Subjects
								</button>
								<button
									onclick={() => switchView('tags')}
									class="flex-1 px-3 py-1.5 text-sm font-medium transition-colors {viewMode === 'tags' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
								>
									Tags
								</button>
							</div>

							<Input placeholder="Search {viewMode}..." bind:value={searchQuery} />

							<div class="space-y-0.5 max-h-[55vh] overflow-y-auto">
								{#each filteredTerms as term}
									{@const isSelected = selectedName === term.name}
									<button
										onclick={() => selectTerm(term.name)}
										class="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors {isSelected ? 'bg-primary/10 text-primary font-medium' : ''}"
									>
										<span class="flex items-center justify-between gap-2">
											<span class="truncate">{term.name}</span>
											<Badge variant="secondary" class="text-[10px] px-1.5 py-0 shrink-0">
												{#snippet children()}{term.count}{/snippet}
											</Badge>
										</span>
									</button>
								{/each}
								{#if filteredTerms.length === 0}
									<p class="text-sm text-muted-foreground text-center py-4">No {viewMode} found</p>
								{/if}
							</div>
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>

		<!-- Term Detail -->
		<div bind:this={detailSection} class="lg:col-span-2 space-y-6 scroll-mt-20">
			{#if selectedTerm}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<div class="min-w-0">
									<div class="flex items-center gap-2">
										{#if viewMode === 'subjects'}
											<BookOpen class="h-6 w-6 text-primary shrink-0" />
										{:else}
											<Tag class="h-6 w-6 text-primary shrink-0" />
										{/if}
										<CardTitle class="break-words">
											{#snippet children()}{selectedTerm.name}{/snippet}
										</CardTitle>
									</div>
									<div class="flex flex-wrap gap-2 mt-3">
										<Badge>
											{#snippet children()}{viewMode === 'subjects' ? 'Subject' : 'Tag'}{/snippet}
										</Badge>
										<Badge variant="secondary">
											{#snippet children()}{selectedTerm.count} item{selectedTerm.count !== 1 ? 's' : ''}{/snippet}
										</Badge>
										{#if viewMode === 'subjects'}
											<WissKILink category="subjects" entityKey={selectedTerm.name} />
										{:else}
											<WissKILink category="tags" entityKey={selectedTerm.name} />
										{/if}
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
												{#snippet children()}{selectedTerm.items.length}{/snippet}
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
										<CollectionItemRow {item} showProject={true} />
									{/each}
								</ul>
								<Pagination
									currentPage={itemPage}
									totalItems={selectedTerm.items.length}
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
									{#if viewMode === 'subjects'}
										<BookOpen class="h-12 w-12 text-muted-foreground/50 mb-4" />
									{:else}
										<Tag class="h-12 w-12 text-muted-foreground/50 mb-4" />
									{/if}
									<p class="text-lg font-medium text-muted-foreground">Select a {viewMode === 'subjects' ? 'subject' : 'tag'}</p>
									<p class="text-sm text-muted-foreground/70 mt-1">
										Choose from the list to view associated research items
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
