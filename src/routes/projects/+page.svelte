<script lang="ts">
	import { StatCard, ChartCard, EmptyState, Card, CardHeader, CardTitle, CardContent, Badge, Input, Pagination } from '$lib/components/ui';
	import { BarChart, Timeline } from '$lib/components/charts';
	import { projects, allCollections } from '$lib/stores/data';
	import {
		groupProjectsByYear,
		extractResearchSections,
		extractInstitutions
	} from '$lib/utils/dataTransform';
	import { page } from '$app/stores';
	import { personUrl, researchSectionsUrl, researchItemUrl } from '$lib/utils/urls';
	import type { Project, CollectionItem } from '$lib/types';
	import { X, Briefcase, BookOpen, Building2, Calendar, Layers, Users, FileText, MapPin, ArrowLeft } from '@lucide/svelte';

	let searchQuery = $state('');
	let selectedId = $state('');

	// Sync from URL query param
	$effect(() => {
		const urlId = $page.url.searchParams.get('id');
		if (urlId) selectedId = urlId;
	});

	// Facet filters
	let selectedResearchSections = $state<string[]>([]);
	let selectedInstitutions = $state<string[]>([]);

	// Pagination
	let currentPage = $state(0);
	const itemsPerPage = 10;

	// Get unique values for facets
	let allResearchSections = $derived.by(() => {
		const sections = new Set<string>();
		$projects.forEach((p) => p.researchSection?.forEach((s) => sections.add(s)));
		return Array.from(sections).sort();
	});

	let allInstitutions = $derived.by(() => {
		const institutions = new Set<string>();
		$projects.forEach((p) => p.institutions?.forEach((i) => institutions.add(i)));
		return Array.from(institutions).sort();
	});

	let filteredProjects = $derived(
		$projects.filter((p) => {
			const matchesSearch =
				searchQuery === '' ||
				p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
				p.locale.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesSection =
				selectedResearchSections.length === 0 ||
				p.researchSection?.some((s) => selectedResearchSections.includes(s));

			const matchesInstitution =
				selectedInstitutions.length === 0 ||
				p.institutions?.some((i) => selectedInstitutions.includes(i));

			return matchesSearch && matchesSection && matchesInstitution;
		})
	);

	let paginatedProjects = $derived(
		filteredProjects.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage)
	);

	$effect(() => {
		searchQuery;
		selectedResearchSections;
		selectedInstitutions;
		currentPage = 0;
	});

	let timelineData = $derived(groupProjectsByYear($projects));
	let researchSectionsData = $derived(extractResearchSections($projects));
	let institutionsData = $derived(extractInstitutions($projects));

	// Selected project
	let selectedProject = $derived.by((): Project | null => {
		if (!selectedId) return null;
		return $projects.find((p) => p.id === selectedId || p._id === selectedId || p.idShort === selectedId) || null;
	});

	// Collection items for selected project
	let projectCollectionItems = $derived.by((): CollectionItem[] => {
		if (!selectedProject) return [];
		return $allCollections.filter((item) => item.project?.id === selectedProject.id);
	});

	// Pagination for collection items
	const collectionPerPage = 10;
	let collectionPage = $state(0);
	let paginatedCollectionItems = $derived(
		projectCollectionItems.slice(collectionPage * collectionPerPage, (collectionPage + 1) * collectionPerPage)
	);

	$effect(() => {
		selectedId;
		collectionPage = 0;
	});

	function selectProject(project: Project) {
		selectedId = project.id;
		const url = new URL(window.location.href);
		url.searchParams.set('id', project.id);
		history.pushState({}, '', url.toString());
	}

	function clearSelection() {
		selectedId = '';
		const url = new URL(window.location.href);
		url.searchParams.delete('id');
		history.pushState({}, '', url.toString());
	}

	function formatDate(date: Date | null): string {
		if (!date) return 'N/A';
		return new Date(date).toLocaleDateString();
	}

	function getDescription(project: Project): string {
		if (!project.description || typeof project.description !== 'string') return '';
		return project.description;
	}

	function getMembers(project: Project): string[] {
		if (!Array.isArray(project.members)) return [];
		return project.members.filter((m): m is string => typeof m === 'string');
	}

	function getItemTitle(item: CollectionItem): string {
		return item.titleInfo?.[0]?.title || 'Untitled';
	}

	function toggleResearchSection(section: string) {
		if (selectedResearchSections.includes(section)) {
			selectedResearchSections = selectedResearchSections.filter((s) => s !== section);
		} else {
			selectedResearchSections = [...selectedResearchSections, section];
		}
	}

	function toggleInstitution(institution: string) {
		if (selectedInstitutions.includes(institution)) {
			selectedInstitutions = selectedInstitutions.filter((i) => i !== institution);
		} else {
			selectedInstitutions = [...selectedInstitutions, institution];
		}
	}

	function clearAllFilters() {
		searchQuery = '';
		selectedResearchSections = [];
		selectedInstitutions = [];
	}

	let hasActiveFilters = $derived(
		searchQuery !== '' || selectedResearchSections.length > 0 || selectedInstitutions.length > 0
	);
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="animate-slide-in-up">
		<h1 class="page-title">Projects</h1>
		<p class="page-subtitle">Browse and explore research projects</p>
	</div>

	{#if selectedProject}
		<!-- Project Detail View -->
		<div class="space-y-6 animate-slide-in-up">
			<button onclick={clearSelection} class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
				<ArrowLeft class="h-4 w-4" />
				Back to projects
			</button>

			<!-- Project Header -->
			<Card class="overflow-hidden">
				{#snippet children()}
					<CardHeader>
						{#snippet children()}
							<div class="min-w-0">
								<CardTitle class="break-words">
									{#snippet children()}{selectedProject.name}{/snippet}
								</CardTitle>
								<div class="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
									<span class="font-mono">{selectedProject.id}</span>
									{#if selectedProject.locale}
										<span>•</span>
										<span class="flex items-center gap-1"><MapPin class="h-3.5 w-3.5" />{selectedProject.locale}</span>
									{/if}
								</div>
								<div class="flex flex-wrap gap-2 mt-3">
									{#each selectedProject.researchSection || [] as section}
										<a href={researchSectionsUrl()}>
											<Badge variant="secondary" class="hover:bg-primary/20 transition-colors">
												{#snippet children()}{section}{/snippet}
											</Badge>
										</a>
									{/each}
									{#if selectedProject.date?.start || selectedProject.date?.end}
										<Badge variant="outline">
											{#snippet children()}{formatDate(selectedProject.date?.start)} – {formatDate(selectedProject.date?.end)}{/snippet}
										</Badge>
									{/if}
								</div>
							</div>
						{/snippet}
					</CardHeader>
				{/snippet}
			</Card>

			<!-- Description -->
			{#if getDescription(selectedProject)}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}Description{/snippet}
								</CardTitle>
							{/snippet}
						</CardHeader>
						<CardContent>
							{#snippet children()}
								<div class="text-sm text-muted-foreground leading-relaxed break-words">
									{#each getDescription(selectedProject).split('\n\n') as paragraph}
										<p class="mb-3 last:mb-0">{paragraph}</p>
									{/each}
								</div>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}

			<!-- PIs & Members -->
			<div class="grid gap-6 md:grid-cols-2">
				{#if selectedProject.pi?.length > 0}
					<Card class="overflow-hidden">
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-lg">
										{#snippet children()}
											<span class="flex items-center gap-2">
												<Briefcase class="h-5 w-5 text-primary" />
												Principal Investigators
											</span>
										{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<ul class="space-y-2">
										{#each selectedProject.pi as pi}
											<li>
												<a
													href={personUrl(pi)}
													class="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-sm font-medium text-foreground hover:text-primary transition-colors"
												>
													<Users class="h-4 w-4 text-muted-foreground shrink-0" />
													{pi}
												</a>
											</li>
										{/each}
									</ul>
								{/snippet}
							</CardContent>
						{/snippet}
					</Card>
				{/if}

				{#if getMembers(selectedProject).length > 0}
					<Card class="overflow-hidden">
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-lg">
										{#snippet children()}
											<span class="flex items-center gap-2">
												<Users class="h-5 w-5 text-muted-foreground" />
												Members
											</span>
										{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<ul class="space-y-2">
										{#each getMembers(selectedProject) as member}
											<li>
												<a
													href={personUrl(member)}
													class="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-sm text-foreground hover:text-primary transition-colors"
												>
													<Users class="h-4 w-4 text-muted-foreground shrink-0" />
													{member}
												</a>
											</li>
										{/each}
									</ul>
								{/snippet}
							</CardContent>
						{/snippet}
					</Card>
				{/if}
			</div>

			<!-- Institutions -->
			{#if selectedProject.institutions?.length > 0}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}
										<span class="flex items-center gap-2">
											<Building2 class="h-5 w-5 text-muted-foreground" />
											Institutions
										</span>
									{/snippet}
								</CardTitle>
							{/snippet}
						</CardHeader>
						<CardContent>
							{#snippet children()}
								<div class="flex flex-wrap gap-2">
									{#each selectedProject.institutions as institution}
										<Badge variant="outline">
											{#snippet children()}{institution}{/snippet}
										</Badge>
									{/each}
								</div>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}

			<!-- Collection Items -->
			{#if projectCollectionItems.length > 0}
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
												{#snippet children()}{projectCollectionItems.length}{/snippet}
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
										<li class="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
											<FileText class="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
											<div class="min-w-0">
												<a
													href={researchItemUrl(item._id || item.dre_id)}
													class="text-sm font-medium text-foreground hover:text-primary transition-colors break-words"
												>
													{getItemTitle(item)}
												</a>
												{#if item.typeOfResource}
													<span class="text-xs text-muted-foreground block mt-0.5">{item.typeOfResource}</span>
												{/if}
											</div>
										</li>
									{/each}
								</ul>
								<Pagination
									currentPage={collectionPage}
									totalItems={projectCollectionItems.length}
									itemsPerPage={collectionPerPage}
									onPageChange={(p) => collectionPage = p}
								/>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}
		</div>
	{:else}
		<!-- Stats -->
		<div class="grid gap-4 md:grid-cols-3">
			<StatCard
				value={$projects.length}
				label="Total Projects"
				icon={Briefcase}
				iconBgClass="bg-primary/10"
				animationDelay="75ms"
			/>
			<StatCard
				value={researchSectionsData.length}
				label="Research Sections"
				icon={BookOpen}
				iconBgClass="bg-primary/10"
				animationDelay="150ms"
			/>
			<StatCard
				value={institutionsData.length}
				label="Institutions"
				icon={Building2}
				iconBgClass="bg-primary/10"
				animationDelay="225ms"
			/>
		</div>

		<!-- Charts -->
		<div class="grid gap-6 lg:grid-cols-2">
			<ChartCard title="Projects by Year" contentHeight="h-[300px]">
				{#if timelineData.length > 0}
					<Timeline data={timelineData} />
				{:else}
					<EmptyState message="No data available" icon={Calendar} />
				{/if}
			</ChartCard>

			<ChartCard title="Research Sections" contentHeight="h-[300px]">
				{#if researchSectionsData.length > 0}
					<BarChart data={researchSectionsData} maxItems={6} />
				{:else}
					<EmptyState message="No data available" icon={BookOpen} />
				{/if}
			</ChartCard>

			<ChartCard title="Top Institutions" contentHeight="h-[300px]" class="lg:col-span-2">
				{#if institutionsData.length > 0}
					<BarChart data={institutionsData} maxItems={10} />
				{:else}
					<EmptyState message="No data available" icon={Building2} />
				{/if}
			</ChartCard>
		</div>

		<!-- Projects List with Facets -->
		<div class="grid gap-6 lg:grid-cols-4">
			<!-- Facets Sidebar -->
			<Card class="lg:col-span-1 lg:sticky lg:top-20 lg:self-start">
				{#snippet children()}
					<CardHeader>
						{#snippet children()}
							<div class="flex items-center justify-between">
								<CardTitle>
									{#snippet children()}Filters{/snippet}
								</CardTitle>
								{#if hasActiveFilters}
									<button
										onclick={clearAllFilters}
										class="text-xs text-muted-foreground hover:text-foreground transition-colors"
									>
										Clear all
									</button>
								{/if}
							</div>
						{/snippet}
					</CardHeader>
					<CardContent>
						{#snippet children()}
							<div class="space-y-6">
								<div>
									<label class="text-sm font-medium mb-2 block">Search</label>
									<Input placeholder="Search projects..." bind:value={searchQuery} />
								</div>

								<div>
									<label class="text-sm font-medium mb-2 block">Research Section</label>
									<div class="space-y-1">
										{#each allResearchSections as section}
										{@const isSelected = selectedResearchSections.includes(section)}
											<button
												onclick={() => toggleResearchSection(section)}
												class="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors flex items-center justify-between gap-2 {isSelected ? 'bg-primary/10 text-primary' : ''}"
											>
												<span class="truncate">{section}</span>
												{#if isSelected}
													<X class="h-3 w-3 flex-shrink-0" />
												{/if}
											</button>
										{/each}
									</div>
								</div>

								<div>
									<label class="text-sm font-medium mb-2 block">Institution</label>
									<div class="space-y-1">
										{#each allInstitutions as institution}
										{@const isSelected = selectedInstitutions.includes(institution)}
											<button
												onclick={() => toggleInstitution(institution)}
												class="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors flex items-center justify-between gap-2 {isSelected ? 'bg-primary/10 text-primary' : ''}"
											>
												<span class="truncate">{institution}</span>
												{#if isSelected}
													<X class="h-3 w-3 flex-shrink-0" />
												{/if}
											</button>
										{/each}
									</div>
								</div>
							</div>
						{/snippet}
					</CardContent>
				{/snippet}
			</Card>

			<!-- Projects List -->
			<Card class="lg:col-span-3">
				{#snippet children()}
					<CardHeader>
						{#snippet children()}
							<div class="flex items-center justify-between">
								<CardTitle>
									{#snippet children()}
										Projects
										<span class="text-muted-foreground font-normal text-base ml-2">
											({filteredProjects.length} results)
										</span>
									{/snippet}
								</CardTitle>
							</div>
						{/snippet}
					</CardHeader>
					<CardContent>
						{#snippet children()}
							{#if hasActiveFilters}
								<div class="flex flex-wrap gap-2 mb-4">
									{#each selectedResearchSections as section}
										<Badge variant="secondary" class="gap-1">
											{section}
											<button onclick={() => toggleResearchSection(section)} class="hover:text-destructive">
												<X class="h-3 w-3" />
											</button>
										</Badge>
									{/each}
									{#each selectedInstitutions as institution}
										<Badge variant="outline" class="gap-1">
											{institution}
											<button onclick={() => toggleInstitution(institution)} class="hover:text-destructive">
												<X class="h-3 w-3" />
											</button>
										</Badge>
									{/each}
								</div>
							{/if}

							<div class="space-y-4">
								{#each paginatedProjects as project}
									<div class="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
										<div class="flex items-start justify-between gap-4">
											<div class="flex-1 min-w-0">
												<button onclick={() => selectProject(project)} class="font-medium text-left hover:text-primary transition-colors">
													{project.name}
												</button>
												<p class="text-sm text-muted-foreground mt-1">
													{project.id} • {project.locale}
												</p>
												<div class="flex flex-wrap gap-2 mt-2">
													{#each project.researchSection || [] as section}
														<a href={researchSectionsUrl()} class="hover:opacity-80 transition-opacity">
															<Badge variant="secondary">{section}</Badge>
														</a>
													{/each}
												</div>
												{#if project.pi && project.pi.length > 0}
													<p class="text-sm text-muted-foreground mt-2">
														PI: {#each project.pi as pi, i}{#if i > 0}, {/if}<a href={personUrl(pi)} class="hover:text-primary transition-colors">{pi}</a>{/each}
													</p>
												{/if}
											</div>
											<div class="text-right text-sm text-muted-foreground">
												<p>{formatDate(project.date?.start)} - {formatDate(project.date?.end)}</p>
											</div>
										</div>
									</div>
								{/each}
								{#if filteredProjects.length === 0}
									<div class="text-center py-8 text-muted-foreground">
										No projects found matching your filters
									</div>
								{/if}
							</div>

							<Pagination
								{currentPage}
								totalItems={filteredProjects.length}
								{itemsPerPage}
								onPageChange={(p) => currentPage = p}
							/>
						{/snippet}
					</CardContent>
				{/snippet}
			</Card>
		</div>
	{/if}
</div>
