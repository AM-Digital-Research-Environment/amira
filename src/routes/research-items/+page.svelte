<script lang="ts">
	import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, Input, Pagination } from '$lib/components/ui';
	import { allCollections, enrichedLocations } from '$lib/stores/data';
	import { MiniMap } from '$lib/components/charts';
	import { page } from '$app/stores';
	import { personUrl, locationUrl, institutionUrl, projectUrl, languageUrl, subjectUrl, tagUrl, resourceTypeUrl } from '$lib/utils/urls';
	import { languageName } from '$lib/utils/languages';
	import type { CollectionItem } from '$lib/types';
	import { universities } from '$lib/types';
	import { FileText, Users, Tag, Globe, Calendar, BookOpen, ArrowLeft, MapPin, Layers, X, ChevronDown, ChevronUp, Building2, Briefcase, Languages } from '@lucide/svelte';

	let searchQuery = $state('');
	let selectedType = $state('all');
	let selectedSubjects = $state<string[]>([]);
	let selectedTags = $state<string[]>([]);
	let subjectSearch = $state('');
	let tagSearch = $state('');
	let selectedId = $state('');
	let subjectsExpanded = $state(false);
	let tagsExpanded = $state(false);
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

	// Subjects (LCSH controlled vocabulary) with counts
	let allSubjectsWithCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		$allCollections.forEach((item) => {
			if (!Array.isArray(item.subject)) return;
			item.subject.forEach((s) => {
				const label = s.authLabel || s.origLabel;
				if (label) counts.set(label, (counts.get(label) || 0) + 1);
			});
		});
		return Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => ({ name, count }));
	});

	// Tags (free-form keywords) with counts
	let allTagsWithCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		$allCollections.forEach((item) => {
			if (!Array.isArray(item.tags)) return;
			item.tags.forEach((t) => {
				if (t) counts.set(t, (counts.get(t) || 0) + 1);
			});
		});
		return Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => ({ name, count }));
	});

	// Filtered options for searches
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

	function toggleSubject(subject: string) {
		if (selectedSubjects.includes(subject)) {
			selectedSubjects = selectedSubjects.filter((s) => s !== subject);
		} else {
			selectedSubjects = [...selectedSubjects, subject];
		}
	}

	function toggleTag(tag: string) {
		if (selectedTags.includes(tag)) {
			selectedTags = selectedTags.filter((t) => t !== tag);
		} else {
			selectedTags = [...selectedTags, tag];
		}
	}

	// Filtered items
	let filteredItems = $derived.by(() => {
		let items = $allCollections;
		if (selectedType !== 'all') {
			items = items.filter((item) => item.typeOfResource === selectedType);
		}
		if (selectedSubjects.length > 0) {
			items = items.filter((item) => {
				if (!Array.isArray(item.subject)) return false;
				const labels = item.subject.map((s) => s.authLabel || s.origLabel).filter(Boolean);
				return selectedSubjects.every((s) => labels.includes(s));
			});
		}
		if (selectedTags.length > 0) {
			items = items.filter((item) => {
				if (!Array.isArray(item.tags)) return false;
				return selectedTags.every((t) => item.tags.includes(t));
			});
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
		selectedSubjects;
		selectedTags;
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
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function clearSelection() {
		selectedId = '';
		const url = new URL(window.location.href);
		url.searchParams.delete('id');
		history.pushState({}, '', url.toString());
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function getItemTitle(item: CollectionItem): string {
		return item.titleInfo?.[0]?.title || 'Untitled';
	}

	function getContributors(item: CollectionItem): { name: string; role: string; qualifier: string }[] {
		if (!Array.isArray(item.name)) return [];
		return item.name
			.filter((n) => n?.name?.label)
			.map((n) => ({ name: n.name.label, role: n.role || '', qualifier: n.name.qualifier || 'person' }));
	}

	function contributorUrl(contributor: { name: string; qualifier: string }): string {
		if (contributor.qualifier === 'institution' || contributor.qualifier === 'group') {
			return institutionUrl(contributor.name);
		}
		return personUrl(contributor.name);
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

	function getOrigins(item: CollectionItem): { city?: string; region?: string; country?: string }[] {
		if (!item.location?.origin) return [];
		return item.location.origin.map((o) => ({ city: o.l3 || undefined, region: o.l2 || undefined, country: o.l1 || undefined }));
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

	// Map markers for selected item
	let itemMapMarkers = $derived.by(() => {
		if (!selectedItem || !$enrichedLocations) return [];
		const origins = selectedItem.location?.origin || [];
		const markers: { latitude: number; longitude: number; label: string }[] = [];
		origins.forEach((o) => {
			// Try city first, then region, then country
			if (o.l3 && o.l1) {
				const key = `${o.l3}|${o.l1}`;
				const loc = $enrichedLocations!.cities[key];
				if (loc?.latitude && loc?.longitude) {
					markers.push({ latitude: loc.latitude, longitude: loc.longitude, label: o.l3 });
					return;
				}
			}
			if (o.l2 && o.l1) {
				const key = `${o.l2}|${o.l1}`;
				const loc = $enrichedLocations!.regions[key];
				if (loc?.latitude && loc?.longitude) {
					markers.push({ latitude: loc.latitude, longitude: loc.longitude, label: o.l2 });
					return;
				}
			}
			if (o.l1) {
				const loc = $enrichedLocations!.countries[o.l1];
				if (loc?.latitude && loc?.longitude) {
					markers.push({ latitude: loc.latitude, longitude: loc.longitude, label: o.l1 });
				}
			}
		});
		return markers;
	});
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
												onclick={() => toggleSubject(subject)}
												class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25 transition-colors"
											>
												{subject}
												<X class="h-3 w-3" />
											</button>
										{/each}
										<button
											onclick={() => selectedSubjects = []}
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
													onclick={() => toggleSubject(subject.name)}
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
												onclick={() => toggleTag(tag)}
												class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/30 text-accent-foreground text-xs font-medium hover:bg-accent/50 transition-colors"
											>
												{tag}
												<X class="h-3 w-3" />
											</button>
										{/each}
										<button
											onclick={() => selectedTags = []}
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
													onclick={() => toggleTag(tag.name)}
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
											<a href={resourceTypeUrl(selectedItem.typeOfResource)} class="hover:opacity-80 transition-opacity">
												<Badge class="hover:bg-primary/80 transition-colors">
													{#snippet children()}
														<FileText class="h-3 w-3 mr-1 inline" />{selectedItem.typeOfResource}
													{/snippet}
												</Badge>
											</a>
										{/if}
										{#if selectedItem.project?.name}
											<a href={projectUrl(selectedItem.project.id)} class="hover:opacity-80 transition-opacity">
												<Badge variant="secondary" class="hover:bg-primary/20 transition-colors">
													{#snippet children()}
														<Briefcase class="h-3 w-3 mr-1 inline" />{selectedItem.project.name}
													{/snippet}
												</Badge>
											</a>
										{/if}
										{#if selectedItem.university}
											{@const uni = universities.find((u) => u.id === selectedItem.university)}
											{#if uni}
												<a href={institutionUrl(uni.name)} class="hover:opacity-80 transition-opacity">
													<Badge variant="outline" class="hover:bg-primary/10 transition-colors">
														{#snippet children()}
															<Building2 class="h-3 w-3 mr-1 inline" />{uni.name}
														{/snippet}
													</Badge>
												</a>
											{/if}
										{/if}
										{#each getLanguages(selectedItem) as lang}
											<a href={languageUrl(lang)} class="hover:opacity-80 transition-opacity">
												<Badge variant="outline" class="hover:bg-primary/10 transition-colors">
													{#snippet children()}
														<Languages class="h-3 w-3 mr-1 inline" />{languageName(lang)}
													{/snippet}
												</Badge>
											</a>
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
													href={contributorUrl(contributor)}
													class="text-sm font-medium text-foreground hover:text-primary transition-colors"
												>
													{contributor.name}
												</a>
												<div class="flex items-center gap-1.5 shrink-0">
													{#if contributor.qualifier !== 'person'}
														<Badge variant="secondary" class="text-[10px]">
															{#snippet children()}{contributor.qualifier}{/snippet}
														</Badge>
													{/if}
													{#if contributor.role}
														<Badge variant="outline" class="text-[10px]">
															{#snippet children()}{contributor.role}{/snippet}
														</Badge>
													{/if}
												</div>
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
											<button onclick={() => { if (!selectedSubjects.includes(subject)) { selectedSubjects = [...selectedSubjects, subject]; subjectsExpanded = true; } }}>
												<Badge variant="secondary" class="hover:bg-primary/20 transition-colors">
													{#snippet children()}{subject}{/snippet}
												</Badge>
											</button>
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
														<p class="text-sm text-foreground">
															{#if origin.city}<a href={locationUrl(origin.city)} class="hover:text-primary transition-colors">{origin.city}</a>{/if}{#if origin.city && (origin.region || origin.country)},&nbsp;{/if}{#if origin.region}<a href={locationUrl(origin.region)} class="hover:text-primary transition-colors">{origin.region}</a>{/if}{#if origin.region && origin.country},&nbsp;{/if}{#if origin.country}<a href={locationUrl(origin.country)} class="hover:text-primary transition-colors">{origin.country}</a>{/if}
														</p>
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
															<button onclick={() => { if (!selectedTags.includes(tag)) { selectedTags = [...selectedTags, tag]; tagsExpanded = true; } }}>
																<Badge variant="outline" class="text-xs hover:bg-accent/20 transition-colors">
																	{#snippet children()}{tag}{/snippet}
																</Badge>
															</button>
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

				<!-- Map -->
				{#if itemMapMarkers.length > 0}
					<Card class="overflow-hidden">
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-lg">
										{#snippet children()}
											<span class="flex items-center gap-2">
												<MapPin class="h-5 w-5 text-primary" />
												Location
											</span>
										{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<MiniMap markers={itemMapMarkers} />
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
