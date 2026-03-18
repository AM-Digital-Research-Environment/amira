<script lang="ts">
	import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, Input, Pagination } from '$lib/components/ui';
	import { allCollections } from '$lib/stores/data';
	import { page } from '$app/stores';
	import { personUrl } from '$lib/utils/urls';
	import type { CollectionItem } from '$lib/types';
	import { FileText, Users, Tag, Globe, Calendar, BookOpen, ArrowLeft, MapPin, Layers } from '@lucide/svelte';

	let searchQuery = $state('');
	let selectedType = $state('all');
	let selectedId = $state('');
	let listPage = $state(0);
	const listPerPage = 20;

	// Sync from URL query param
	$effect(() => {
		const urlId = $page.url.searchParams.get('id');
		if (urlId) selectedId = urlId;
	});

	// Unique resource types for filter
	let resourceTypes = $derived.by(() => {
		const types = new Set<string>();
		$allCollections.forEach((item) => {
			if (item.typeOfResource) types.add(item.typeOfResource);
		});
		return ['all', ...Array.from(types).sort()];
	});

	// Filtered items
	let filteredItems = $derived.by(() => {
		let items = $allCollections;
		if (selectedType !== 'all') {
			items = items.filter((item) => item.typeOfResource === selectedType);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			items = items.filter((item) => {
				const title = getItemTitle(item).toLowerCase();
				const contributors = getContributors(item).map((c) => c.name.toLowerCase()).join(' ');
				const subjects = getSubjects(item).join(' ').toLowerCase();
				return title.includes(q) || contributors.includes(q) || subjects.includes(q);
			});
		}
		return items;
	});

	// Paginated items
	let paginatedItems = $derived(
		filteredItems.slice(listPage * listPerPage, (listPage + 1) * listPerPage)
	);

	// Reset page on filter change
	$effect(() => {
		searchQuery;
		selectedType;
		listPage = 0;
	});

	// Selected item
	let selectedItem = $derived.by((): CollectionItem | null => {
		if (!selectedId) return null;
		return $allCollections.find((item) => item._id === selectedId || item.dre_id === selectedId) || null;
	});

	function selectItem(item: CollectionItem) {
		selectedId = item._id || item.dre_id;
		const url = new URL(window.location.href);
		url.searchParams.set('id', selectedId);
		history.pushState({}, '', url.toString());
	}

	function clearSelection() {
		selectedId = '';
		const url = new URL(window.location.href);
		url.searchParams.delete('id');
		history.pushState({}, '', url.toString());
	}

	function getItemTitle(item: CollectionItem): string {
		return item.titleInfo?.[0]?.title || 'Untitled';
	}

	function getContributors(item: CollectionItem): { name: string; role: string }[] {
		if (!Array.isArray(item.name)) return [];
		return item.name
			.filter((n) => n?.name?.label)
			.map((n) => ({ name: n.name.label, role: n.role || '' }));
	}

	function getSubjects(item: CollectionItem): string[] {
		if (!Array.isArray(item.subject)) return [];
		return item.subject.map((s) => s.authLabel || s.origLabel).filter(Boolean);
	}

	function getLanguages(item: CollectionItem): string[] {
		if (!Array.isArray(item.language)) return [];
		return item.language;
	}

	function getAbstract(item: CollectionItem): string {
		if (!item.abstract || typeof item.abstract !== 'string') return '';
		return item.abstract;
	}

	function getIdentifiers(item: CollectionItem): { type: string; value: string }[] {
		if (!Array.isArray(item.identifier)) return [];
		return item.identifier
			.filter((id) => id?.identifier && id?.identifier_type)
			.map((id) => ({ type: id.identifier_type, value: id.identifier }));
	}

	function getOrigins(item: CollectionItem): string[] {
		if (!item.location?.origin) return [];
		return item.location.origin.map((o) => [o.l3, o.l2, o.l1].filter(Boolean).join(', '));
	}

	function getTags(item: CollectionItem): string[] {
		if (!Array.isArray(item.tags)) return [];
		return item.tags.filter(Boolean);
	}

	function formatDateInfo(item: CollectionItem): string {
		if (!item.dateInfo) return '';
		const issue = item.dateInfo.issue;
		const creation = item.dateInfo.creation;
		const d = issue || creation;
		if (!d) return '';
		const fmt = (date: Date | null | undefined): string => {
			if (!date) return '';
			const parsed = new Date(date);
			if (isNaN(parsed.getTime())) return '';
			return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
		};
		const start = fmt(d.start);
		const end = fmt(d.end);
		if (start && end) return `${start} – ${end}`;
		return start || end;
	}
</script>

<div class="space-y-8 animate-slide-in-up">
	<!-- Header -->
	<div>
		<h1 class="page-title">Research Items</h1>
		<p class="page-subtitle">Browse and explore collection items across all universities and projects</p>
	</div>

	<!-- Stats -->
	<div class="grid gap-4 sm:grid-cols-3">
		<StatCard label="Total Items" value={$allCollections.length} icon={FileText} />
		<StatCard
			label="Resource Types"
			value={resourceTypes.length - 1}
			icon={Layers}
		/>
		<StatCard
			label="Filtered Results"
			value={filteredItems.length}
			icon={BookOpen}
		/>
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Item List -->
		<Card class="lg:col-span-1 lg:sticky lg:top-20 lg:self-start overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle>
							{#snippet children()}
								{#if selectedId}
									<button onclick={clearSelection} class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
										<ArrowLeft class="h-4 w-4" />
										Back to list
									</button>
								{/if}
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
								bind:value={searchQuery}
							/>

							<!-- Type filter -->
							<select
								bind:value={selectedType}
								class="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
							>
								{#each resourceTypes as type}
									<option value={type}>{type === 'all' ? 'All types' : type}</option>
								{/each}
							</select>

							<div class="space-y-0.5 max-h-[50vh] overflow-y-auto">
								{#each paginatedItems as item}
									{@const isSelected = selectedId === (item._id || item.dre_id)}
									<button
										onclick={() => selectItem(item)}
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
								onPageChange={(p) => listPage = p}
							/>
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>

		<!-- Item Detail -->
		<div class="lg:col-span-2 space-y-6">
			{#if selectedItem}
				<!-- Title & Type -->
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<div class="min-w-0">
									<CardTitle class="break-words">
										{#snippet children()}{getItemTitle(selectedItem)}{/snippet}
									</CardTitle>
									{#if selectedItem.titleInfo?.length > 1}
										{#each selectedItem.titleInfo.slice(1) as alt}
											<p class="text-sm text-muted-foreground mt-1 break-words">{alt.title} <span class="text-xs">({alt.title_type})</span></p>
										{/each}
									{/if}
									<div class="flex flex-wrap gap-2 mt-3">
										{#if selectedItem.typeOfResource}
											<Badge>
												{#snippet children()}{selectedItem.typeOfResource}{/snippet}
											</Badge>
										{/if}
										{#if selectedItem.project?.name}
											<Badge variant="secondary">
												{#snippet children()}{selectedItem.project.name}{/snippet}
											</Badge>
										{/if}
										{#if selectedItem.university}
											<Badge variant="outline">
												{#snippet children()}{selectedItem.university.toUpperCase()}{/snippet}
											</Badge>
										{/if}
										{#each getLanguages(selectedItem) as lang}
											<Badge variant="outline">
												{#snippet children()}{lang}{/snippet}
											</Badge>
										{/each}
									</div>
								</div>
							{/snippet}
						</CardHeader>
					{/snippet}
				</Card>

				<!-- Abstract -->
				{#if getAbstract(selectedItem)}
					<Card class="overflow-hidden">
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-lg">
										{#snippet children()}Abstract{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<p class="text-sm text-muted-foreground leading-relaxed break-words">{getAbstract(selectedItem)}</p>
								{/snippet}
							</CardContent>
						{/snippet}
					</Card>
				{/if}

				<!-- Contributors -->
				{#if getContributors(selectedItem).length > 0}
					<Card class="overflow-hidden">
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-lg">
										{#snippet children()}
											<span class="flex items-center gap-2">
												<Users class="h-5 w-5 text-primary" />
												Contributors
											</span>
										{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<ul class="space-y-2">
										{#each getContributors(selectedItem) as contributor}
											<li class="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30">
												<a
													href={personUrl(contributor.name)}
													class="text-sm font-medium text-foreground hover:text-primary transition-colors"
												>
													{contributor.name}
												</a>
												{#if contributor.role}
													<Badge variant="outline" class="text-[10px]">
														{#snippet children()}{contributor.role}{/snippet}
													</Badge>
												{/if}
											</li>
										{/each}
									</ul>
								{/snippet}
							</CardContent>
						{/snippet}
					</Card>
				{/if}

				<!-- Subjects -->
				{#if getSubjects(selectedItem).length > 0}
					<Card class="overflow-hidden">
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-lg">
										{#snippet children()}
											<span class="flex items-center gap-2">
												<Tag class="h-5 w-5 text-primary" />
												Subjects
											</span>
										{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<div class="flex flex-wrap gap-2">
										{#each getSubjects(selectedItem) as subject}
											<Badge variant="secondary">
												{#snippet children()}{subject}{/snippet}
											</Badge>
										{/each}
									</div>
								{/snippet}
							</CardContent>
						{/snippet}
					</Card>
				{/if}

				<!-- Location & Date -->
				{#if getOrigins(selectedItem).length > 0 || formatDateInfo(selectedItem) || getTags(selectedItem).length > 0}
					<Card class="overflow-hidden">
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-lg">
										{#snippet children()}Details{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<div class="space-y-4">
										{#if getOrigins(selectedItem).length > 0}
											<div class="flex items-start gap-3">
												<MapPin class="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
												<div>
													<p class="text-xs font-medium text-muted-foreground mb-1">Origin</p>
													{#each getOrigins(selectedItem) as origin}
														<p class="text-sm text-foreground">{origin}</p>
													{/each}
												</div>
											</div>
										{/if}
										{#if formatDateInfo(selectedItem)}
											<div class="flex items-start gap-3">
												<Calendar class="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
												<div>
													<p class="text-xs font-medium text-muted-foreground mb-1">Date</p>
													<p class="text-sm text-foreground">{formatDateInfo(selectedItem)}</p>
												</div>
											</div>
										{/if}
										{#if getTags(selectedItem).length > 0}
											<div class="flex items-start gap-3">
												<Tag class="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
												<div>
													<p class="text-xs font-medium text-muted-foreground mb-1">Tags</p>
													<div class="flex flex-wrap gap-1.5">
														{#each getTags(selectedItem) as tag}
															<Badge variant="outline" class="text-xs">
																{#snippet children()}{tag}{/snippet}
															</Badge>
														{/each}
													</div>
												</div>
											</div>
										{/if}
									</div>
								{/snippet}
							</CardContent>
						{/snippet}
					</Card>
				{/if}

				<!-- Identifiers -->
				{#if getIdentifiers(selectedItem).length > 0}
					<Card class="overflow-hidden">
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-lg">
										{#snippet children()}Identifiers{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<div class="space-y-2">
										{#each getIdentifiers(selectedItem) as id}
											<div class="flex items-start gap-3 text-sm">
												<span class="text-muted-foreground shrink-0 min-w-[120px]">{id.type}</span>
												<span class="text-foreground font-mono text-xs break-all">{id.value}</span>
											</div>
										{/each}
									</div>
								{/snippet}
							</CardContent>
						{/snippet}
					</Card>
				{/if}

			{:else}
				<!-- No item selected -->
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardContent>
							{#snippet children()}
								<div class="flex flex-col items-center justify-center py-16 text-center">
									<FileText class="h-12 w-12 text-muted-foreground/50 mb-4" />
									<p class="text-lg font-medium text-muted-foreground">Select an item</p>
									<p class="text-sm text-muted-foreground/70 mt-1">
										Choose an item from the list to view its full metadata, contributors, and subjects
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
