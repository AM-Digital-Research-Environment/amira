<script lang="ts">
	import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, Input, Pagination, CollectionItemRow, BackToList } from '$lib/components/ui';
	import { projects, allCollections, persons } from '$lib/stores/data';
	import { page } from '$app/stores';
	import { personUrl, projectUrl, researchSectionsUrl } from '$lib/utils/urls';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import type { Project, CollectionItem } from '$lib/types';
	import { formatDate, getProjectTitle } from '$lib/utils/helpers';
	import { Building2, Briefcase, Users, FileText } from '@lucide/svelte';

	const urlSelection = createUrlSelection('name');

	let searchQuery = $state('');
	let selectedName = $state('');

	// Sync from URL query param
	$effect(() => {
		const urlName = $page.url.searchParams.get('name');
		if (urlName) selectedName = urlName;
	});

	// Build institution index from projects + persons + collection item affiliations
	interface InstitutionData {
		name: string;
		projects: Project[];
		people: Set<string>;
		collectionItemCount: number;
		isPartner: boolean;
	}

	let institutionMap = $derived.by(() => {
		const map = new Map<string, InstitutionData>();

		const getOrCreate = (name: string): InstitutionData => {
			if (!map.has(name)) {
				map.set(name, { name, projects: [], people: new Set(), collectionItemCount: 0, isPartner: false });
			}
			return map.get(name)!;
		};

		// From projects (partner institutions)
		$projects.forEach((p) => {
			(p.institutions || []).forEach((instName) => {
				const inst = getOrCreate(instName);
				inst.isPartner = true;
				inst.projects.push(p);
				(p.pi || []).forEach((pi) => { if (typeof pi === 'string') inst.people.add(pi); });
				if (Array.isArray(p.members)) {
					p.members.forEach((m) => { if (typeof m === 'string') inst.people.add(m); });
				}
			});
		});

		// From person affiliations
		$persons.forEach((p) => {
			(p.affiliation || []).forEach((aff) => {
				if (aff && map.has(aff)) {
					map.get(aff)!.people.add(p.name);
				}
			});
		});

		// From collection item contributors (institutions and groups)
		$allCollections.forEach((item) => {
			if (!Array.isArray(item.name)) return;
			item.name.forEach((n) => {
				if (n?.name?.label && (n?.name?.qualifier === 'institution' || n?.name?.qualifier === 'group')) {
					const inst = getOrCreate(n.name.label);
					inst.collectionItemCount++;
				}
			});
		});

		// Also count collection items per project-level institution
		const projectInstitutions = new Map<string, string[]>();
		$projects.forEach((p) => {
			projectInstitutions.set(p.id, p.institutions || []);
		});
		$allCollections.forEach((item) => {
			const instNames = projectInstitutions.get(item.project?.id || '');
			if (instNames) {
				instNames.forEach((instName) => {
					if (map.has(instName)) map.get(instName)!.collectionItemCount++;
				});
			}
		});

		return map;
	});

	let partnerInstitutions = $derived(
		Array.from(institutionMap.values())
			.filter((i) => i.isPartner)
			.sort((a, b) => b.projects.length - a.projects.length)
	);

	let contributorInstitutions = $derived(
		Array.from(institutionMap.values())
			.filter((i) => !i.isPartner)
			.sort((a, b) => b.collectionItemCount - a.collectionItemCount)
	);

	let institutions = $derived([...partnerInstitutions, ...contributorInstitutions]);

	let filteredPartner = $derived.by(() => {
		if (!searchQuery.trim()) return partnerInstitutions;
		const q = searchQuery.toLowerCase();
		return partnerInstitutions.filter((inst) => inst.name.toLowerCase().includes(q));
	});

	let filteredContributor = $derived.by(() => {
		if (!searchQuery.trim()) return contributorInstitutions;
		const q = searchQuery.toLowerCase();
		return contributorInstitutions.filter((inst) => inst.name.toLowerCase().includes(q));
	});

	let selectedInstitution = $derived(selectedName ? institutionMap.get(selectedName) || null : null);

	// Collection items for selected institution (via project association OR contributor name)
	let institutionCollectionItems = $derived.by((): CollectionItem[] => {
		if (!selectedInstitution) return [];
		const name = selectedInstitution.name;
		const projectIds = new Set(selectedInstitution.projects.map((p) => p.id));
		const seen = new Set<string>();
		const results: CollectionItem[] = [];
		$allCollections.forEach((item) => {
			const id = item._id || item.dre_id;
			if (seen.has(id)) return;
			const byProject = projectIds.has(item.project?.id || '');
			const byContributor = Array.isArray(item.name) && item.name.some(
				(n) => n?.name?.label === name && (n?.name?.qualifier === 'institution' || n?.name?.qualifier === 'group')
			);
			if (byProject || byContributor) {
				seen.add(id);
				results.push(item);
			}
		});
		return results;
	});

	const collectionPerPage = 10;
	let collectionPage = $state(0);
	let paginatedCollectionItems = $derived(
		institutionCollectionItems.slice(collectionPage * collectionPerPage, (collectionPage + 1) * collectionPerPage)
	);

	$effect(() => {
		selectedName;
		collectionPage = 0;
	});

	function selectInstitution(name: string) {
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

<div class="space-y-8 animate-slide-in-up">
	<div>
		<h1 class="page-title">Institutions</h1>
		<p class="page-subtitle">Browse partner institutions and their associated projects, researchers, and collection items</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		<StatCard label="Partner Institutions" value={partnerInstitutions.length} icon={Building2} />
		<StatCard label="Contributor Orgs" value={contributorInstitutions.length} icon={Building2} />
		<StatCard label="Total People" value={new Set(institutions.flatMap((i) => [...i.people])).size} icon={Users} />
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Institution List -->
		<Card class="lg:col-span-1 lg:sticky lg:top-20 lg:self-start overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle>
							{#snippet children()}
								<BackToList show={!!selectedName} onclick={clearSelection} />
								<span class="flex items-center justify-between">
									Institutions
									<Badge variant="secondary">
										{#snippet children()}{filteredPartner.length + filteredContributor.length}{/snippet}
									</Badge>
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="space-y-3">
							<Input placeholder="Search institutions..." bind:value={searchQuery} />
							<div class="space-y-1 max-h-[60vh] overflow-y-auto">
								{#if filteredPartner.length > 0}
									<p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-1 pb-1">Partner Institutions</p>
									{#each filteredPartner as inst}
										{@const isSelected = selectedName === inst.name}
										<button
											onclick={() => selectInstitution(inst.name)}
											class="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors {isSelected ? 'bg-primary/10 text-primary font-medium' : ''}"
										>
											<span class="break-words">{inst.name}</span>
											<span class="flex items-center gap-2 mt-0.5">
												<span class="text-xs text-muted-foreground">{inst.projects.length} project{inst.projects.length !== 1 ? 's' : ''}</span>
												<span class="text-xs text-muted-foreground">· {inst.people.size} people</span>
											</span>
										</button>
									{/each}
								{/if}

								{#if filteredContributor.length > 0}
									<p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-3 pb-1 border-t border-border mt-2">Contributor Organizations</p>
									{#each filteredContributor as inst}
										{@const isSelected = selectedName === inst.name}
										<button
											onclick={() => selectInstitution(inst.name)}
											class="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors {isSelected ? 'bg-primary/10 text-primary font-medium' : ''}"
										>
											<span class="break-words">{inst.name}</span>
											<span class="text-xs text-muted-foreground mt-0.5 block">
												{inst.collectionItemCount} item{inst.collectionItemCount !== 1 ? 's' : ''}
											</span>
										</button>
									{/each}
								{/if}
							</div>
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>

		<!-- Institution Detail -->
		<div class="lg:col-span-2 space-y-6">
			{#if selectedInstitution}
				<!-- Header -->
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<div class="min-w-0">
									<CardTitle class="break-words">
										{#snippet children()}{selectedInstitution.name}{/snippet}
									</CardTitle>
									<div class="flex flex-wrap gap-2 mt-3">
										<Badge variant="secondary">
											{#snippet children()}{selectedInstitution.projects.length} project{selectedInstitution.projects.length !== 1 ? 's' : ''}{/snippet}
										</Badge>
										<Badge variant="secondary">
											{#snippet children()}{selectedInstitution.people.size} people{/snippet}
										</Badge>
										{#if selectedInstitution.collectionItemCount > 0}
											<Badge variant="outline">
												{#snippet children()}{selectedInstitution.collectionItemCount} collection item{selectedInstitution.collectionItemCount !== 1 ? 's' : ''}{/snippet}
											</Badge>
										{/if}
									</div>
								</div>
							{/snippet}
						</CardHeader>
					{/snippet}
				</Card>

				<!-- Projects -->
				{#if selectedInstitution.projects.length > 0}
					<Card class="overflow-hidden">
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-lg">
										{#snippet children()}
											<span class="flex items-center gap-2">
												<Briefcase class="h-5 w-5 text-primary" />
												Projects
											</span>
										{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<ul class="space-y-3">
										{#each selectedInstitution.projects as project}
											<li class="p-3 rounded-lg bg-muted/30">
												<a
													href={projectUrl(project.id)}
													class="text-sm font-medium text-foreground hover:text-primary transition-colors break-words"
												>
													{getProjectTitle(project)}
												</a>
												<div class="flex flex-wrap items-center gap-2 mt-1">
													{#if project.idShort}
														<span class="text-xs text-muted-foreground font-mono">{project.id}</span>
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
												{#if project.pi?.length}
													<p class="text-xs text-muted-foreground mt-1.5">
														PI: {#each project.pi as pi, i}{#if i > 0},&nbsp;{/if}<a href={personUrl(pi)} class="hover:text-primary transition-colors">{pi}</a>{/each}
													</p>
												{/if}
											</li>
										{/each}
									</ul>
								{/snippet}
							</CardContent>
						{/snippet}
					</Card>
				{/if}

				<!-- People -->
				{#if selectedInstitution.people.size > 0}
					<Card class="overflow-hidden">
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-lg">
										{#snippet children()}
											<span class="flex items-center gap-2">
												<Users class="h-5 w-5 text-muted-foreground" />
												People
												<Badge variant="secondary">
													{#snippet children()}{selectedInstitution.people.size}{/snippet}
												</Badge>
											</span>
										{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<div class="flex flex-wrap gap-2">
										{#each [...selectedInstitution.people].sort() as person}
											<a
												href={personUrl(person)}
												class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-sm text-foreground hover:text-primary hover:bg-muted transition-colors"
											>
												{person}
											</a>
										{/each}
									</div>
								{/snippet}
							</CardContent>
						{/snippet}
					</Card>
				{/if}

				<!-- Collection Items -->
				{#if institutionCollectionItems.length > 0}
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
													{#snippet children()}{institutionCollectionItems.length}{/snippet}
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
										totalItems={institutionCollectionItems.length}
										itemsPerPage={collectionPerPage}
										onPageChange={(p) => collectionPage = p}
									/>
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
									<Building2 class="h-12 w-12 text-muted-foreground/50 mb-4" />
									<p class="text-lg font-medium text-muted-foreground">Select an institution</p>
									<p class="text-sm text-muted-foreground/70 mt-1">
										Choose an institution from the list to view its projects, people, and collection items
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
