<script lang="ts">
	import { StatCard, ChartCard, EmptyState, Card, CardHeader, CardTitle, CardContent, Badge, Input, Pagination, SEO } from '$lib/components/ui';
	import { BarChart, Timeline, BeeswarmChart, GanttChart } from '$lib/components/charts';
	import { projects, allCollections } from '$lib/stores/data';
	import {
		groupProjectsByYear,
		extractResearchSections,
		extractInstitutions,
		buildProjectBeeswarm,
		buildProjectGantt
	} from '$lib/utils/dataTransform';
	import { page } from '$app/stores';
	import { personUrl, researchSectionsUrl, researchItemUrl, institutionUrl } from '$lib/utils/urls';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import type { Project, CollectionItem } from '$lib/types';
	import { formatDate, getItemTitle } from '$lib/utils/helpers';
	import { paginate } from '$lib/utils/pagination';
	import { X, Briefcase, BookOpen, Building2, Calendar, Users, FileText, ArrowLeft, Hash, GraduationCap, ExternalLink } from '@lucide/svelte';
	import { WissKILink } from '$lib/components/ui';
	import { base } from '$app/paths';

	const urlSelection = createUrlSelection('id');

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

	let paginatedProjects = $derived(paginate(filteredProjects, currentPage, itemsPerPage));

	$effect(() => {
		searchQuery;
		selectedResearchSections;
		selectedInstitutions;
		currentPage = 0;
	});

	let timelineData = $derived(groupProjectsByYear($projects));
	let researchSectionsData = $derived(extractResearchSections($projects));
	let institutionsData = $derived(extractInstitutions($projects));
	let beeswarmData = $derived(buildProjectBeeswarm($projects, $allCollections));
	let ganttData = $derived(buildProjectGantt($projects));

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
	let paginatedCollectionItems = $derived(paginate(projectCollectionItems, collectionPage, collectionPerPage));

	$effect(() => {
		selectedId;
		collectionPage = 0;
	});

	function selectProject(project: Project) {
		selectedId = project.id;
		urlSelection.pushToUrl(project.id);
		scrollToTop();
	}

	function clearSelection() {
		selectedId = '';
		urlSelection.removeFromUrl();
		scrollToTop();
	}

	function getDescription(project: Project): string {
		if (!project.description || typeof project.description !== 'string') return '';
		return project.description;
	}

	function getMembers(project: Project): string[] {
		if (!Array.isArray(project.members)) return [];
		return project.members.filter((m): m is string => typeof m === 'string');
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

	// External project links
	interface ProjectLink {
		id: string;
		url: string;
	}

	let projectLinksMap = $state<Map<string, string>>(new Map());

	$effect(() => {
		fetch(`${base}/data/manual/projectLinks.json`)
			.then((r) => r.ok ? r.json() : [])
			.then((links: ProjectLink[]) => {
				const map = new Map<string, string>();
				links.forEach((l) => map.set(l.id, l.url));
				projectLinksMap = map;
			})
			.catch(() => {});
	});

	function getProjectLink(projectId: string): string | undefined {
		return projectLinksMap.get(projectId);
	}
</script>
<SEO title="Projects" description="Browse and explore research projects from the Africa Multiple Cluster of Excellence" />

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
							</div>
						{/snippet}
					</CardHeader>
					<CardContent>
						{#snippet children()}
							<div class="grid gap-3 text-sm sm:grid-cols-2">
								<div class="flex items-center gap-2">
									<Hash class="h-4 w-4 text-muted-foreground shrink-0" />
									<span class="text-muted-foreground shrink-0">Identifier</span>
									<span class="text-foreground font-mono">{selectedProject.id}</span>
								</div>
								{#if selectedProject.researchSection?.length > 0}
									<div class="flex items-center gap-2">
										<BookOpen class="h-4 w-4 text-muted-foreground shrink-0" />
										<span class="text-muted-foreground shrink-0">Research Section</span>
										<span class="text-foreground">
											{#each selectedProject.researchSection as section, i}
												<a href={researchSectionsUrl(section)} class="hover:text-primary transition-colors">{section}</a>{#if i < selectedProject.researchSection.length - 1},&nbsp;{/if}
											{/each}
										</span>
									</div>
								{/if}
								{#if selectedProject.date?.start || selectedProject.date?.end}
									<div class="flex items-center gap-2">
										<Calendar class="h-4 w-4 text-muted-foreground shrink-0" />
										<span class="text-muted-foreground shrink-0">Duration</span>
										<span class="text-foreground">{formatDate(selectedProject.date?.start)} – {formatDate(selectedProject.date?.end)}</span>
									</div>
								{/if}
								<div class="flex items-center gap-2">
									<WissKILink category="projects" entityKey={selectedProject.id} />
								</div>
								{#if getProjectLink(selectedProject.id)}
									<div class="flex items-center gap-2">
										<a
											href={getProjectLink(selectedProject.id)}
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
										>
											<ExternalLink class="h-3 w-3" />
											Project page
										</a>
									</div>
								{/if}
							</div>
						{/snippet}
					</CardContent>
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

			<!-- Principal Investigators — inline -->
			{#if selectedProject.pi?.length > 0}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}
										<span class="flex items-center gap-2">
											<GraduationCap class="h-5 w-5 text-primary" />
											Principal Investigators
										</span>
									{/snippet}
								</CardTitle>
							{/snippet}
						</CardHeader>
						<CardContent>
							{#snippet children()}
								<p class="text-sm text-foreground">
									{#each selectedProject.pi as pi, i}
										{#if i > 0}<span class="text-muted-foreground"> · </span>{/if}
										<a href={personUrl(pi)} class="hover:text-primary transition-colors">{pi}</a>
									{/each}
								</p>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}

			<!-- Members — multi-column grid -->
			{#if getMembers(selectedProject).length > 0}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}
										<span class="flex items-center gap-2">
											<Users class="h-5 w-5 text-primary" />
											Members
											<Badge variant="secondary">
												{#snippet children()}{getMembers(selectedProject).length}{/snippet}
											</Badge>
										</span>
									{/snippet}
								</CardTitle>
							{/snippet}
						</CardHeader>
						<CardContent>
							{#snippet children()}
								<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5">
									{#each getMembers(selectedProject) as member}
										<a
											href={personUrl(member)}
											class="text-sm text-foreground hover:text-primary transition-colors truncate"
										>{member}</a>
									{/each}
								</div>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}

			<!-- Institutions -->
			{#if selectedProject.institutions?.length > 0}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}
										<span class="flex items-center gap-2">
											<Building2 class="h-5 w-5 text-primary" />
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
										<a href={institutionUrl(institution)} class="hover:opacity-80 transition-opacity">
											<Badge variant="outline" class="hover:bg-primary/10 transition-colors">
												{#snippet children()}{institution}{/snippet}
											</Badge>
										</a>
									{/each}
								</div>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}

			<!-- Research Items -->
			{#if projectCollectionItems.length > 0}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}
										<span class="flex items-center gap-2">
											<FileText class="h-5 w-5 text-primary" />
											Research Items
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

			<ChartCard
				title="Project Timeline (Gantt)"
				subtitle="Project lifespans grouped by research section"
				contentHeight="h-[500px]"
				class="lg:col-span-2"
			>
				{#if ganttData.length > 0}
					<GanttChart
						data={ganttData}
						formatAsYear={true}
						onclick={(name) => {
							const project = $projects.find((p) => p.name.startsWith(name.replace('...', '')));
							if (project) selectProject(project);
						}}
					/>
				{:else}
					<EmptyState message="No project date data available" icon={Calendar} />
				{/if}
			</ChartCard>

			<ChartCard
				title="Projects by Research Section &amp; Year"
				subtitle="Each dot is a project — size indicates research items"
				contentHeight="h-[400px]"
				class="lg:col-span-2"
			>
				{#if beeswarmData.length > 0}
					<BeeswarmChart
						data={beeswarmData}
						valueAxisLabel="Start Year"
						onclick={(label) => {
							const project = $projects.find((p) => p.name === label);
							if (project) selectProject(project);
						}}
					/>
				{:else}
					<EmptyState message="No project date data available" icon={Calendar} />
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
												<div class="flex items-start gap-2">
													<button onclick={() => selectProject(project)} class="font-medium text-left hover:text-primary transition-colors">
														{project.name}
													</button>
													{#if getProjectLink(project.id)}
														<a
															href={getProjectLink(project.id)}
															target="_blank"
															rel="noopener noreferrer"
															class="shrink-0 mt-0.5 text-muted-foreground hover:text-primary transition-colors"
															title="View project page"
														>
															<ExternalLink class="h-3.5 w-3.5" />
														</a>
													{/if}
												</div>
												<p class="text-sm text-muted-foreground mt-1">
													{project.id} • {project.locale}
												</p>
												<div class="flex flex-wrap gap-2 mt-2">
													{#each project.researchSection || [] as section}
														<a href={researchSectionsUrl(section)} class="hover:opacity-80 transition-opacity">
															<Badge variant="secondary">{section}</Badge>
														</a>
													{/each}
												</div>
												{#if project.pi && project.pi.length > 0}
													<p class="text-sm text-muted-foreground mt-2">
														PI: {#each project.pi as pi, i}{#if i > 0},&nbsp;{/if}<a href={personUrl(pi)} class="hover:text-primary transition-colors">{pi}</a>{/each}
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
