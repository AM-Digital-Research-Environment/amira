<script lang="ts">
	import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, Input, Pagination } from '$lib/components/ui';
	import { projects, allCollections, researchSections } from '$lib/stores/data';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { researchSectionsUrl, projectUrl, researchItemUrl } from '$lib/utils/urls';
	import type { Project, CollectionItem } from '$lib/types';
	import { Users, Briefcase, BookOpen, FileText, Search, X, ArrowLeft } from '@lucide/svelte';

	let searchQuery = $state('');
	let selectedName = $state('');

	// Sync from URL query param on navigation (e.g. coming from research sections page)
	$effect(() => {
		const urlName = $page.url.searchParams.get('name');
		if (urlName) selectedName = urlName;
	});

	// Build people index from projects
	interface PersonData {
		name: string;
		piOf: Project[];
		memberOf: Project[];
		sections: Set<string>;
		isSectionPI: boolean;
	}

	let peopleMap = $derived.by(() => {
		const map = new Map<string, PersonData>();

		const getOrCreate = (name: string): PersonData => {
			if (!map.has(name)) {
				map.set(name, { name, piOf: [], memberOf: [], sections: new Set(), isSectionPI: false });
			}
			return map.get(name)!;
		};

		// From projects
		$projects.forEach((p) => {
			(p.pi || []).forEach((name) => {
				if (typeof name !== 'string') return;
				const person = getOrCreate(name);
				person.piOf.push(p);
				p.researchSection?.forEach((s) => person.sections.add(s));
			});
			if (Array.isArray(p.members)) {
				p.members.forEach((name) => {
					if (typeof name !== 'string') return;
					const person = getOrCreate(name);
					person.memberOf.push(p);
					p.researchSection?.forEach((s) => person.sections.add(s));
				});
			}
		});

		// Mark research section PIs and members
		Object.entries($researchSections).forEach(([sectionName, info]) => {
			(info.principalInvestigators || []).forEach((name) => {
				const person = getOrCreate(name);
				person.isSectionPI = true;
				person.sections.add(sectionName);
			});
			(info.members || []).forEach((name) => {
				const person = getOrCreate(name);
				person.sections.add(sectionName);
			});
		});

		return map;
	});

	let people = $derived(
		Array.from(peopleMap.values()).sort((a, b) => a.name.localeCompare(b.name))
	);

	let filteredPeople = $derived.by(() => {
		if (!searchQuery.trim()) return people;
		const q = searchQuery.toLowerCase();
		return people.filter((p) => p.name.toLowerCase().includes(q));
	});

	// Selected person's data
	let selectedPerson = $derived(selectedName ? peopleMap.get(selectedName) || null : null);

	// Collection items for selected person
	let personCollectionItems = $derived.by((): CollectionItem[] => {
		if (!selectedPerson) return [];
		const name = selectedPerson.name;
		return $allCollections.filter((item) =>
			Array.isArray(item.name) && item.name.some((n) => n?.name?.label === name)
		);
	});

	// Pagination for collection items
	const collectionItemsPerPage = 10;
	let collectionPage = $state(0);
	let paginatedCollectionItems = $derived(
		personCollectionItems.slice(collectionPage * collectionItemsPerPage, (collectionPage + 1) * collectionItemsPerPage)
	);

	// Reset pagination when person changes
	$effect(() => {
		selectedName;
		collectionPage = 0;
	});

	function selectPerson(name: string) {
		selectedName = name;
		// Update URL without navigation for shareability
		const url = new URL(window.location.href);
		url.searchParams.set('name', name);
		history.pushState({}, '', url.toString());
	}

	function clearSelection() {
		selectedName = '';
		const url = new URL(window.location.href);
		url.searchParams.delete('name');
		history.pushState({}, '', url.toString());
	}

	function getProjectTitle(project: Project): string {
		return project.name || project.idShort || 'Untitled';
	}

	function getItemTitle(item: CollectionItem): string {
		return item.titleInfo?.[0]?.title || 'Untitled';
	}

	function formatDate(date: Date | null): string {
		if (!date) return '';
		const d = new Date(date);
		if (isNaN(d.getTime())) return '';
		return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
	}

	function getPersonRole(item: CollectionItem, personName: string): string {
		if (!Array.isArray(item.name)) return '';
		const entry = item.name.find((n) => n?.name?.label === personName);
		return entry?.role || '';
	}
</script>

<div class="space-y-8 animate-slide-in-up">
	<!-- Header -->
	<div>
		<h1 class="page-title">People</h1>
		<p class="page-subtitle">Browse researchers, principal investigators, and project members across the cluster</p>
	</div>

	<!-- Stats -->
	<div class="grid gap-4 sm:grid-cols-3">
		<StatCard label="Total People" value={people.length} icon={Users} />
		<StatCard
			label="Principal Investigators"
			value={people.filter((p) => p.piOf.length > 0).length}
			icon={Briefcase}
		/>
		<StatCard
			label="Section PIs"
			value={people.filter((p) => p.isSectionPI).length}
			icon={BookOpen}
		/>
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- People List -->
		<Card class="lg:col-span-1 lg:sticky lg:top-20 lg:self-start overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle>
							{#snippet children()}
								{#if selectedName}
									<button onclick={clearSelection} class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
										<ArrowLeft class="h-4 w-4" />
										Back to list
									</button>
								{/if}
								<span class="flex items-center justify-between">
									People
									<Badge variant="secondary">
										{#snippet children()}{filteredPeople.length}{/snippet}
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
								placeholder="Search people..."
								bind:value={searchQuery}
							/>
							<div class="space-y-0.5 max-h-[60vh] overflow-y-auto">
								{#each filteredPeople as person}
									{@const isSelected = selectedName === person.name}
									<button
										onclick={() => selectPerson(person.name)}
										class="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors flex items-center justify-between gap-2 {isSelected ? 'bg-primary/10 text-primary font-medium' : ''}"
									>
										<span class="truncate">{person.name}</span>
										<span class="flex items-center gap-1.5 shrink-0">
											{#if person.isSectionPI}
												<BookOpen class="h-3 w-3 text-primary" />
											{/if}
											{#if person.piOf.length > 0}
												<Badge variant="secondary" class="text-[10px] px-1.5 py-0">
													{#snippet children()}PI{/snippet}
												</Badge>
											{/if}
										</span>
									</button>
								{/each}
							</div>
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>

		<!-- Person Detail -->
		<div class="lg:col-span-2 space-y-6">
			{#if selectedPerson}
				<!-- Person Header -->
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<div class="flex items-start justify-between gap-3 min-w-0">
									<div class="min-w-0">
										<CardTitle class="break-words">
											{#snippet children()}{selectedPerson.name}{/snippet}
										</CardTitle>
										<div class="flex flex-wrap gap-2 mt-2">
											{#if selectedPerson.isSectionPI}
												<Badge>
													{#snippet children()}Section PI{/snippet}
												</Badge>
											{/if}
											{#if selectedPerson.piOf.length > 0}
												<Badge variant="secondary">
													{#snippet children()}PI of {selectedPerson.piOf.length} project{selectedPerson.piOf.length !== 1 ? 's' : ''}{/snippet}
												</Badge>
											{/if}
											{#if selectedPerson.memberOf.length > 0}
												<Badge variant="secondary">
													{#snippet children()}Member of {selectedPerson.memberOf.length} project{selectedPerson.memberOf.length !== 1 ? 's' : ''}{/snippet}
												</Badge>
											{/if}
											{#if personCollectionItems.length > 0}
												<Badge variant="outline">
													{#snippet children()}{personCollectionItems.length} collection item{personCollectionItems.length !== 1 ? 's' : ''}{/snippet}
												</Badge>
											{/if}
										</div>
									</div>
								</div>
							{/snippet}
						</CardHeader>
					{/snippet}
				</Card>

				<!-- Research Sections -->
				{#if selectedPerson.sections.size > 0}
					<Card class="overflow-hidden">
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-lg">
										{#snippet children()}
											<span class="flex items-center gap-2">
												<BookOpen class="h-5 w-5 text-primary" />
												Research Sections
											</span>
										{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<div class="flex flex-wrap gap-2">
										{#each [...selectedPerson.sections].sort() as section}
											<a
												href={researchSectionsUrl(section)}
												class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
											>
												{section}
											</a>
										{/each}
									</div>
								{/snippet}
							</CardContent>
						{/snippet}
					</Card>
				{/if}

				<!-- Projects as PI -->
				{#if selectedPerson.piOf.length > 0}
					<Card class="overflow-hidden">
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-lg">
										{#snippet children()}
											<span class="flex items-center gap-2">
												<Briefcase class="h-5 w-5 text-primary" />
												Projects as Principal Investigator
											</span>
										{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<ul class="space-y-3">
										{#each selectedPerson.piOf as project}
											<li class="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
												<Briefcase class="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
												<div class="min-w-0">
													<a
														href={projectUrl(project.id)}
														class="text-sm font-medium text-foreground hover:text-primary transition-colors break-words"
													>
														{getProjectTitle(project)}
													</a>
													<div class="flex flex-wrap items-center gap-2 mt-1">
														{#if project.idShort}
															<span class="text-xs text-muted-foreground font-mono">{project.idShort}</span>
														{/if}
														{#if project.date?.start || project.date?.end}
															<span class="text-xs text-muted-foreground">
																{formatDate(project.date.start)}{project.date.end ? ` – ${formatDate(project.date.end)}` : ''}
															</span>
														{/if}
													</div>
													{#if project.researchSection?.length}
														<div class="flex flex-wrap gap-1 mt-1.5">
															{#each project.researchSection as section}
																<a href={researchSectionsUrl(section)} class="hover:opacity-80 transition-opacity">
																	<Badge variant="outline" class="text-[10px] hover:bg-primary/10 transition-colors">
																		{#snippet children()}{section}{/snippet}
																	</Badge>
																</a>
															{/each}
														</div>
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

				<!-- Projects as Member -->
				{#if selectedPerson.memberOf.length > 0}
					<Card class="overflow-hidden">
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-lg">
										{#snippet children()}
											<span class="flex items-center gap-2">
												<Users class="h-5 w-5 text-muted-foreground" />
												Projects as Member
											</span>
										{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<ul class="space-y-3">
										{#each selectedPerson.memberOf as project}
											<li class="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
												<Briefcase class="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
												<div class="min-w-0">
													<a
														href={projectUrl(project.id)}
														class="text-sm font-medium text-foreground hover:text-primary transition-colors break-words"
													>
														{getProjectTitle(project)}
													</a>
													{#if project.idShort}
														<span class="text-xs text-muted-foreground font-mono block mt-0.5">{project.idShort}</span>
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

				<!-- Collection Items -->
				{#if personCollectionItems.length > 0}
					<Card class="overflow-hidden">
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-lg">
										{#snippet children()}
											<span class="flex items-center gap-2">
												<FileText class="h-5 w-5 text-muted-foreground" />
												Collection Items
											</span>
										{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<ul class="space-y-2">
										{#each paginatedCollectionItems as item}
											<li class="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
												<FileText class="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
												<div class="min-w-0">
													<a
													href={researchItemUrl(item._id || item.dre_id)}
													class="text-sm font-medium text-foreground hover:text-primary transition-colors break-words"
												>{getItemTitle(item)}</a>
													<div class="flex flex-wrap items-center gap-2 mt-1">
														{#if getPersonRole(item, selectedPerson.name)}
															<Badge variant="outline" class="text-[10px]">
																{#snippet children()}{getPersonRole(item, selectedPerson.name)}{/snippet}
															</Badge>
														{/if}
														{#if item.typeOfResource}
															<span class="text-xs text-muted-foreground">{item.typeOfResource}</span>
														{/if}
													</div>
												</div>
											</li>
										{/each}
									</ul>
									<Pagination
										currentPage={collectionPage}
										totalItems={personCollectionItems.length}
										itemsPerPage={collectionItemsPerPage}
										onPageChange={(p) => collectionPage = p}
									/>
								{/snippet}
							</CardContent>
						{/snippet}
					</Card>
				{/if}

			{:else}
				<!-- No person selected -->
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardContent>
							{#snippet children()}
								<div class="flex flex-col items-center justify-center py-16 text-center">
									<Users class="h-12 w-12 text-muted-foreground/50 mb-4" />
									<p class="text-lg font-medium text-muted-foreground">Select a person</p>
									<p class="text-sm text-muted-foreground/70 mt-1">
										Choose someone from the list to view their projects, research sections, and collection items
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
