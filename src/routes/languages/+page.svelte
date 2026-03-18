<script lang="ts">
	import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, Input, Pagination, CollectionItemRow, BackToList } from '$lib/components/ui';
	import { allCollections } from '$lib/stores/data';
	import { page } from '$app/stores';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import { languageName } from '$lib/utils/languages';
	import type { CollectionItem } from '$lib/types';
	import { Languages, FileText } from '@lucide/svelte';

	const urlSelection = createUrlSelection('code');

	let searchQuery = $state('');
	let selectedCode = $state('');

	// Sync from URL query param
	$effect(() => {
		const urlCode = $page.url.searchParams.get('code');
		if (urlCode) selectedCode = urlCode;
	});

	// Build language index
	interface LanguageData {
		code: string;
		name: string;
		count: number;
		items: CollectionItem[];
	}

	let languageMap = $derived.by(() => {
		const map = new Map<string, LanguageData>();
		$allCollections.forEach((item) => {
			(item.language || []).forEach((code) => {
				if (!code) return;
				if (!map.has(code)) {
					map.set(code, { code, name: languageName(code), count: 0, items: [] });
				}
				const lang = map.get(code)!;
				lang.count++;
				lang.items.push(item);
			});
		});
		return map;
	});

	let languages = $derived(
		Array.from(languageMap.values()).sort((a, b) => b.count - a.count)
	);

	let filteredLanguages = $derived.by(() => {
		if (!searchQuery.trim()) return languages;
		const q = searchQuery.toLowerCase();
		return languages.filter((l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
	});

	let selectedLanguage = $derived(selectedCode ? languageMap.get(selectedCode) || null : null);

	// Pagination
	const itemsPerPage = 10;
	let itemPage = $state(0);
	let paginatedItems = $derived.by(() => {
		if (!selectedLanguage) return [];
		return selectedLanguage.items.slice(itemPage * itemsPerPage, (itemPage + 1) * itemsPerPage);
	});

	$effect(() => {
		selectedCode;
		itemPage = 0;
	});

	function selectLanguage(code: string) {
		selectedCode = code;
		urlSelection.pushToUrl(code);
		scrollToTop();
	}

	function clearSelection() {
		selectedCode = '';
		urlSelection.removeFromUrl();
		scrollToTop();
	}

</script>

<div class="space-y-8 animate-slide-in-up">
	<div>
		<h1 class="page-title">Languages</h1>
		<p class="page-subtitle">Browse collection items by language across all universities and projects</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		<StatCard label="Languages" value={languages.length} icon={Languages} />
		<StatCard label="Items with Language" value={$allCollections.filter((i) => i.language?.length > 0).length} icon={FileText} />
		<StatCard label="Most Common" value={languages[0]?.name || '—'} icon={Languages} />
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Language List -->
		<Card class="lg:col-span-1 lg:sticky lg:top-20 lg:self-start overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle>
							{#snippet children()}
								<BackToList show={!!selectedCode} onclick={clearSelection} />
								<span class="flex items-center justify-between">
									Languages
									<Badge variant="secondary">
										{#snippet children()}{filteredLanguages.length}{/snippet}
									</Badge>
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="space-y-3">
							<Input placeholder="Search languages..." bind:value={searchQuery} />
							<div class="space-y-0.5 max-h-[60vh] overflow-y-auto">
								{#each filteredLanguages as lang}
									{@const isSelected = selectedCode === lang.code}
									<button
										onclick={() => selectLanguage(lang.code)}
										class="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors {isSelected ? 'bg-primary/10 text-primary font-medium' : ''}"
									>
										<span class="flex items-center justify-between gap-2">
											<span>
												{lang.name}
												<span class="text-xs text-muted-foreground">({lang.code})</span>
											</span>
											<Badge variant="secondary" class="text-[10px] px-1.5 py-0 shrink-0">
												{#snippet children()}{lang.count}{/snippet}
											</Badge>
										</span>
									</button>
								{/each}
							</div>
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>

		<!-- Language Detail -->
		<div class="lg:col-span-2 space-y-6">
			{#if selectedLanguage}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<div class="min-w-0">
									<div class="flex items-center gap-2">
										<Languages class="h-6 w-6 text-primary shrink-0" />
										<CardTitle class="break-words">
											{#snippet children()}{selectedLanguage.name}{/snippet}
										</CardTitle>
									</div>
									<div class="flex flex-wrap gap-2 mt-3">
										<Badge variant="outline">
											{#snippet children()}Code: {selectedLanguage.code}{/snippet}
										</Badge>
										<Badge variant="secondary">
											{#snippet children()}{selectedLanguage.count} item{selectedLanguage.count !== 1 ? 's' : ''}{/snippet}
										</Badge>
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
											Collection Items
											<Badge variant="secondary">
												{#snippet children()}{selectedLanguage.items.length}{/snippet}
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
									totalItems={selectedLanguage.items.length}
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
									<Languages class="h-12 w-12 text-muted-foreground/50 mb-4" />
									<p class="text-lg font-medium text-muted-foreground">Select a language</p>
									<p class="text-sm text-muted-foreground/70 mt-1">
										Choose a language from the list to view its associated collection items
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
