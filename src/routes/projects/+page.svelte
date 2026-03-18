<script lang="ts">
	import { StatCard, ChartCard, EmptyState, Card, CardHeader, CardTitle, CardContent, Badge, Input, Pagination } from '$lib/components/ui';
	import { BarChart, Timeline } from '$lib/components/charts';
	import { projects } from '$lib/stores/data';
	import {
		groupProjectsByYear,
		extractResearchSections,
		extractInstitutions
	} from '$lib/utils/dataTransform';
	import { X, Briefcase, BookOpen, Building2, Calendar, Layers } from '@lucide/svelte';

	let searchQuery = $state('');

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
			// Text search
			const matchesSearch =
				searchQuery === '' ||
				p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
				p.locale.toLowerCase().includes(searchQuery.toLowerCase());

			// Research section filter
			const matchesSection =
				selectedResearchSections.length === 0 ||
				p.researchSection?.some((s) => selectedResearchSections.includes(s));

			// Institution filter
			const matchesInstitution =
				selectedInstitutions.length === 0 ||
				p.institutions?.some((i) => selectedInstitutions.includes(i));

			return matchesSearch && matchesSection && matchesInstitution;
		})
	);

	// Paginated projects
	let paginatedProjects = $derived(
		filteredProjects.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage)
	);

	// Reset page when filters change
	$effect(() => {
		searchQuery;
		selectedResearchSections;
		selectedInstitutions;
		currentPage = 0;
	});

	let timelineData = $derived(groupProjectsByYear($projects));
	let researchSectionsData = $derived(extractResearchSections($projects));
	let institutionsData = $derived(extractInstitutions($projects));

	function formatDate(date: Date | null): string {
		if (!date) return 'N/A';
		return new Date(date).toLocaleDateString();
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
		<p class="page-subtitle">
			Browse and explore research projects
		</p>
	</div>

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
							<!-- Search -->
							<div>
								<label class="text-sm font-medium mb-2 block">Search</label>
								<Input placeholder="Search projects..." bind:value={searchQuery} />
							</div>

							<!-- Research Section Facet -->
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

							<!-- Institution Facet -->
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
						<!-- Active filters display -->
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
											<h4 class="font-medium">{project.name}</h4>
											<p class="text-sm text-muted-foreground mt-1">
												{project.id} • {project.locale}
											</p>
											<div class="flex flex-wrap gap-2 mt-2">
												{#each project.researchSection || [] as section}
													<Badge variant="secondary">{section}</Badge>
												{/each}
											</div>
											{#if project.pi && project.pi.length > 0}
												<p class="text-sm text-muted-foreground mt-2">
													PI: {project.pi.join(', ')}
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
</div>
