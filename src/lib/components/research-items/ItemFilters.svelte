<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent, Badge, Input, Pagination, BackToList } from '$lib/components/ui';
	import type { CollectionItem } from '$lib/types';
	import { getItemTitle } from '$lib/utils/helpers';
	import { Tag, BookOpen, X, ChevronDown, ChevronUp } from '@lucide/svelte';

	interface SubjectOrTag {
		name: string;
		count: number;
	}

	interface Props {
		filteredItems: CollectionItem[];
		paginatedItems: CollectionItem[];
		resourceTypes: string[];
		allSubjectsWithCounts: SubjectOrTag[];
		allTagsWithCounts: SubjectOrTag[];
		selectedId: string;
		searchQuery: string;
		selectedType: string;
		selectedSubjects: string[];
		selectedTags: string[];
		listPage: number;
		listPerPage: number;
		onSelectItem: (item: CollectionItem) => void;
		onClearSelection: () => void;
		onSearchQueryChange: (value: string) => void;
		onSelectedTypeChange: (value: string) => void;
		onToggleSubject: (subject: string) => void;
		onClearSubjects: () => void;
		onToggleTag: (tag: string) => void;
		onClearTags: () => void;
		onPageChange: (page: number) => void;
	}

	let {
		filteredItems,
		paginatedItems,
		resourceTypes,
		allSubjectsWithCounts,
		allTagsWithCounts,
		selectedId,
		searchQuery,
		selectedType,
		selectedSubjects,
		selectedTags,
		listPage,
		listPerPage,
		onSelectItem,
		onClearSelection,
		onSearchQueryChange,
		onSelectedTypeChange,
		onToggleSubject,
		onClearSubjects,
		onToggleTag,
		onClearTags,
		onPageChange
	}: Props = $props();

	// Local UI state for expand/collapse and filter search
	let subjectsExpanded = $state(false);
	let tagsExpanded = $state(false);
	let subjectSearch = $state('');
	let tagSearch = $state('');

	let filteredSubjectOptions = $derived.by(() => {
		if (!subjectSearch.trim()) return allSubjectsWithCounts.slice(0, 30);
		const q = subjectSearch.toLowerCase();
		return allSubjectsWithCounts.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 30);
	});

	let filteredTagOptions = $derived.by(() => {
		if (!tagSearch.trim()) return allTagsWithCounts.slice(0, 30);
		const q = tagSearch.toLowerCase();
		return allTagsWithCounts.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 30);
	});

	// Expose expand state so parent can trigger it
	export function expandSubjects() {
		subjectsExpanded = true;
	}

	export function expandTags() {
		tagsExpanded = true;
	}
</script>

<Card class="lg:col-span-1 lg:sticky lg:top-20 lg:self-start overflow-hidden">
	{#snippet children()}
		<CardHeader>
			{#snippet children()}
				<CardTitle>
					{#snippet children()}
						<BackToList show={!!selectedId} onclick={onClearSelection} />
						<span class="flex items-center justify-between">
							Items
							<Badge variant="secondary">
								{#snippet children()}{filteredItems.length}{/snippet}
							</Badge>
						</span>
					{/snippet}
				</CardTitle>
			{/snippet}
		</CardHeader>
		<CardContent>
			{#snippet children()}
				<div class="space-y-3">
					<Input
						placeholder="Search items..."
						value={searchQuery}
						oninput={(e) => onSearchQueryChange((e.currentTarget as HTMLInputElement).value)}
					/>

					<!-- Type filter -->
					<select
						value={selectedType}
						onchange={(e) => onSelectedTypeChange(e.currentTarget.value)}
						class="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						{#each resourceTypes as type}
							<option value={type}>{type === 'all' ? 'All types' : type}</option>
						{/each}
					</select>

					<!-- Subjects filter (LCSH controlled vocabulary) -->
					<div class="border-t border-border pt-2">
						<button
							onclick={() => subjectsExpanded = !subjectsExpanded}
							class="flex items-center justify-between w-full text-xs font-medium text-muted-foreground"
						>
							<span class="flex items-center gap-1.5">
								<BookOpen class="h-3 w-3" />
								Subjects
								{#if selectedSubjects.length > 0}
									<Badge variant="secondary" class="text-[10px] px-1.5 py-0">
										{#snippet children()}{selectedSubjects.length}{/snippet}
									</Badge>
								{/if}
							</span>
							{#if subjectsExpanded}
								<ChevronUp class="h-3.5 w-3.5" />
							{:else}
								<ChevronDown class="h-3.5 w-3.5" />
							{/if}
						</button>

						{#if selectedSubjects.length > 0}
							<div class="flex flex-wrap gap-1.5 mt-2">
								{#each selectedSubjects as subject}
									<button
										onclick={() => onToggleSubject(subject)}
										class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25 transition-colors"
									>
										{subject}
										<X class="h-3 w-3" />
									</button>
								{/each}
								<button
									onclick={onClearSubjects}
									class="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
								>
									Clear
								</button>
							</div>
						{/if}

						{#if subjectsExpanded}
							<div class="mt-2 space-y-2">
								<Input
									placeholder="Search subjects..."
									bind:value={subjectSearch}
								/>
								<div class="space-y-0.5 max-h-32 overflow-y-auto">
									{#each filteredSubjectOptions as subject}
										{@const isActive = selectedSubjects.includes(subject.name)}
										<button
											onclick={() => onToggleSubject(subject.name)}
											class="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted transition-colors flex items-center justify-between gap-2 {isActive ? 'bg-primary/10 text-primary' : ''}"
										>
											<span class="truncate">{subject.name}</span>
											<span class="text-muted-foreground shrink-0">{subject.count}</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<!-- Tags filter (free-form keywords) -->
					<div class="border-t border-border pt-2">
						<button
							onclick={() => tagsExpanded = !tagsExpanded}
							class="flex items-center justify-between w-full text-xs font-medium text-muted-foreground"
						>
							<span class="flex items-center gap-1.5">
								<Tag class="h-3 w-3" />
								Tags
								{#if selectedTags.length > 0}
									<Badge variant="secondary" class="text-[10px] px-1.5 py-0">
										{#snippet children()}{selectedTags.length}{/snippet}
									</Badge>
								{/if}
							</span>
							{#if tagsExpanded}
								<ChevronUp class="h-3.5 w-3.5" />
							{:else}
								<ChevronDown class="h-3.5 w-3.5" />
							{/if}
						</button>

						{#if selectedTags.length > 0}
							<div class="flex flex-wrap gap-1.5 mt-2">
								{#each selectedTags as tag}
									<button
										onclick={() => onToggleTag(tag)}
										class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/30 text-accent-foreground text-xs font-medium hover:bg-accent/50 transition-colors"
									>
										{tag}
										<X class="h-3 w-3" />
									</button>
								{/each}
								<button
									onclick={onClearTags}
									class="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
								>
									Clear
								</button>
							</div>
						{/if}

						{#if tagsExpanded}
							<div class="mt-2 space-y-2">
								<Input
									placeholder="Search tags..."
									bind:value={tagSearch}
								/>
								<div class="space-y-0.5 max-h-32 overflow-y-auto">
									{#each filteredTagOptions as tag}
										{@const isActive = selectedTags.includes(tag.name)}
										<button
											onclick={() => onToggleTag(tag.name)}
											class="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted transition-colors flex items-center justify-between gap-2 {isActive ? 'bg-accent/20 text-accent-foreground' : ''}"
										>
											<span class="truncate">{tag.name}</span>
											<span class="text-muted-foreground shrink-0">{tag.count}</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<div class="space-y-0.5 max-h-[40vh] overflow-y-auto">
						{#each paginatedItems as item}
							{@const isSelected = selectedId === (item._id || item.dre_id)}
							<button
								onclick={() => onSelectItem(item)}
								class="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors {isSelected ? 'bg-primary/10 text-primary font-medium' : ''}"
							>
								<span class="line-clamp-2 break-words">{getItemTitle(item)}</span>
								{#if item.typeOfResource}
									<span class="text-xs text-muted-foreground block mt-0.5">{item.typeOfResource}</span>
								{/if}
							</button>
						{/each}
						{#if filteredItems.length === 0}
							<p class="text-sm text-muted-foreground text-center py-4">No items found</p>
						{/if}
					</div>

					<Pagination
						currentPage={listPage}
						totalItems={filteredItems.length}
						itemsPerPage={listPerPage}
						onPageChange={onPageChange}
					/>
				</div>
			{/snippet}
		</CardContent>
	{/snippet}
</Card>
