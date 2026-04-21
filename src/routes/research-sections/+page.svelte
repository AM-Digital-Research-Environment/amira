<script lang="ts">
	import {
		StatCard,
		ChartCard,
		EmptyState,
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		Badge,
		BackToList,
		SEO
	} from '$lib/components/ui';
	import { BarChart, GanttChart } from '$lib/components/charts';
	import { projects, researchSections } from '$lib/stores/data';
	import { page } from '$app/stores';
	import { extractResearchSections, buildProjectGantt } from '$lib/utils/dataTransform';
	import { personUrl, projectUrl } from '$lib/utils/urls';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import type { Project } from '$lib/types';
	import { formatDate, getProjectTitle, getSectionColor } from '$lib/utils/helpers';
	import { EXTERNAL_SECTION } from '$lib/utils/external';
	import {
		BookOpen,
		Briefcase,
		Layers,
		ExternalLink,
		Users,
		ArrowRight,
		GraduationCap
	} from '@lucide/svelte';
	import { WissKILink } from '$lib/components/ui';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	const EXTERNAL_SECTION_DESCRIPTION =
		'External collections contributed to the dashboard from outside the cluster’s six thematic research sections. These datasets extend the research environment with related archival and publication material.';

	const urlSelection = createUrlSelection('section');

	let selectedSection = $state('');

	// Sync from URL query param
	$effect(() => {
		const urlSection = $page.url.searchParams.get('section');
		if (urlSection) selectedSection = urlSection;
	});

	// Group projects by research section
	let projectsBySection = $derived.by(() => {
		const map = new SvelteMap<string, Project[]>();
		$projects.forEach((p) => {
			p.researchSection?.forEach((s) => {
				if (!map.has(s)) map.set(s, []);
				map.get(s)!.push(p);
			});
		});
		return map;
	});

	// Combined data: merge manual info with project associations. "External"
	// is a pseudo-section for projects that don't belong to the cluster's six
	// official research sections — sort it to the end to keep the thematic
	// sections visually grouped at the top.
	let sections = $derived.by(() => {
		const sectionNames = new SvelteSet<string>();
		Object.keys($researchSections).forEach((name) => sectionNames.add(name));
		$projects.forEach((p) => p.researchSection?.forEach((s) => sectionNames.add(s)));

		const thematic = [...sectionNames].filter((n) => n !== EXTERNAL_SECTION).sort();
		const ordered = sectionNames.has(EXTERNAL_SECTION) ? [...thematic, EXTERNAL_SECTION] : thematic;

		return ordered.map((name) => ({
			name,
			url: $researchSections[name]?.url || '',
			description:
				$researchSections[name]?.description ||
				(name === EXTERNAL_SECTION ? EXTERNAL_SECTION_DESCRIPTION : ''),
			objectives: $researchSections[name]?.objectives || '',
			workProgramme: $researchSections[name]?.workProgramme || '',
			principalInvestigators: $researchSections[name]?.principalInvestigators || [],
			members: $researchSections[name]?.members || [],
			projects: projectsBySection.get(name) || []
		}));
	});

	let selectedSectionData = $derived(
		selectedSection ? sections.find((s) => s.name === selectedSection) || null : null
	);

	// Gantt chart for selected section's projects
	let sectionGanttData = $derived.by(() => {
		if (!selectedSectionData) return [];
		return buildProjectGantt(selectedSectionData.projects);
	});

	let chartData = $derived(extractResearchSections($projects));
	let totalProjects = $derived(new Set($projects.flatMap((p) => p._id)).size);
	let avgPerSection = $derived(
		sections.length > 0 ? Math.round(totalProjects / sections.length) : 0
	);

	function selectSection(name: string) {
		selectedSection = name;
		urlSelection.pushToUrl(name);
		scrollToTop();
	}

	function clearSelection() {
		selectedSection = '';
		urlSelection.removeFromUrl();
	}
</script>

<SEO
	title="Research Sections"
	description="Explore the six thematic research sections of the cluster"
/>

<div class="space-y-8 animate-slide-in-up">
	<!-- Header -->
	<div>
		<h1 class="page-title">Research Sections</h1>
		<p class="page-subtitle">
			Six thematic fields providing a coherent structure to research projects across Bayreuth,
			Africa, and a global network
		</p>
	</div>

	{#if selectedSectionData}
		<!-- Detail mode -->
		<BackToList show={true} onclick={clearSelection} label="Back to all sections" />

		<!-- Section header -->
		<Card
			class="overflow-hidden"
			style="border-left: 3px solid {getSectionColor(selectedSectionData.name)}"
		>
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<div class="flex items-start justify-between gap-3 min-w-0">
							<CardTitle class="break-words">
								{#snippet children()}{selectedSectionData.name}{/snippet}
							</CardTitle>
							<div class="flex items-center gap-3 shrink-0">
								{#if selectedSectionData.url}
									<a
										href={selectedSectionData.url}
										target="_blank"
										rel="noopener noreferrer"
										class="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary-hover transition-colors whitespace-nowrap"
									>
										<ExternalLink class="h-3.5 w-3.5" />
										Website
									</a>
								{/if}
								<WissKILink category="researchSections" entityKey={selectedSectionData.name} />
								<Badge variant="secondary">
									{#snippet children()}{selectedSectionData.projects.length} project{selectedSectionData
											.projects.length !== 1
											? 's'
											: ''}{/snippet}
								</Badge>
							</div>
						</div>
					{/snippet}
				</CardHeader>
				{#if selectedSectionData.description}
					<CardContent>
						{#snippet children()}
							<div class="text-sm text-muted-foreground leading-relaxed break-words">
								{#each selectedSectionData.description.split('\n\n') as paragraph, i (i)}
									<p class="mb-2 last:mb-0">{paragraph}</p>
								{/each}
							</div>
						{/snippet}
					</CardContent>
				{/if}
			{/snippet}
		</Card>

		<!-- Principal Investigators — full-width inline -->
		{#if selectedSectionData.principalInvestigators.length > 0}
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
								{#each selectedSectionData.principalInvestigators as pi, i (pi)}
									{#if i > 0}<span class="text-muted-foreground"> · </span>{/if}
									<a href={personUrl(pi)} class="hover:text-primary transition-colors">{pi}</a>
								{/each}
							</p>
						{/snippet}
					</CardContent>
				{/snippet}
			</Card>
		{/if}

		<!-- Members — full-width, compact multi-column -->
		{#if selectedSectionData.members.length > 0}
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
											{#snippet children()}{selectedSectionData.members.length}{/snippet}
										</Badge>
									</span>
								{/snippet}
							</CardTitle>
						{/snippet}
					</CardHeader>
					<CardContent>
						{#snippet children()}
							<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5">
								{#each selectedSectionData.members as member (member)}
									<a
										href={personUrl(member)}
										class="text-sm text-foreground hover:text-primary transition-colors truncate"
										>{member}</a
									>
								{/each}
							</div>
						{/snippet}
					</CardContent>
				{/snippet}
			</Card>
		{/if}

		<!-- Objectives -->
		{#if selectedSectionData.objectives}
			<Card class="overflow-hidden">
				{#snippet children()}
					<CardHeader>
						{#snippet children()}
							<CardTitle class="text-lg">
								{#snippet children()}Objectives{/snippet}
							</CardTitle>
						{/snippet}
					</CardHeader>
					<CardContent>
						{#snippet children()}
							<div class="text-sm text-muted-foreground leading-relaxed break-words">
								{#each selectedSectionData.objectives.split('\n\n') as paragraph, i (i)}
									<p class="mb-2 last:mb-0">{paragraph}</p>
								{/each}
							</div>
						{/snippet}
					</CardContent>
				{/snippet}
			</Card>
		{/if}

		<!-- Work Programme -->
		{#if selectedSectionData.workProgramme}
			<Card class="overflow-hidden">
				{#snippet children()}
					<CardHeader>
						{#snippet children()}
							<CardTitle class="text-lg">
								{#snippet children()}Work Programme{/snippet}
							</CardTitle>
						{/snippet}
					</CardHeader>
					<CardContent>
						{#snippet children()}
							<div class="text-sm text-muted-foreground leading-relaxed break-words">
								{#each selectedSectionData.workProgramme.split('\n\n') as paragraph, i (i)}
									<p class="mb-2 last:mb-0">{paragraph}</p>
								{/each}
							</div>
						{/snippet}
					</CardContent>
				{/snippet}
			</Card>
		{/if}

		<!-- Project Timeline Gantt -->
		{#if sectionGanttData.length > 0}
			<ChartCard
				title="Project Timelines"
				subtitle="Duration of projects in this research section"
				contentHeight="h-chart-xl"
			>
				<GanttChart
					data={sectionGanttData}
					formatAsYear={true}
					onclick={(name) => {
						const project = selectedSectionData?.projects.find((p) =>
							p.name.startsWith(name.replace('...', ''))
						);
						if (project) window.location.href = projectUrl(project.id);
					}}
				/>
			</ChartCard>
		{/if}

		<!-- Associated Projects — full width -->
		{#if selectedSectionData.projects.length > 0}
			<Card class="overflow-hidden">
				{#snippet children()}
					<CardHeader>
						{#snippet children()}
							<CardTitle class="text-lg">
								{#snippet children()}
									<span class="flex items-center gap-2">
										<Briefcase class="h-5 w-5 text-primary" />
										Associated Projects
										<Badge variant="secondary">
											{#snippet children()}{selectedSectionData.projects.length}{/snippet}
										</Badge>
									</span>
								{/snippet}
							</CardTitle>
						{/snippet}
					</CardHeader>
					<CardContent>
						{#snippet children()}
							<ul class="space-y-2">
								{#each selectedSectionData.projects as project (project.id)}
									<li
										class="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
									>
										<Briefcase class="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
										<div class="min-w-0">
											<a
												href={projectUrl(project.id)}
												class="text-sm text-foreground hover:text-primary transition-colors block"
											>
												{getProjectTitle(project)}
											</a>
											{#if project.date?.start || project.date?.end}
												<span class="text-xs text-muted-foreground">
													{formatDate(project.date.start)}{project.date.end
														? ` – ${formatDate(project.date.end)}`
														: ''}
												</span>
											{/if}
											{#if project.pi?.length}
												<p class="text-xs text-muted-foreground mt-0.5">
													PI: {#each project.pi as pi, i (typeof pi === 'string' ? pi : i)}{#if i > 0},
														{/if}<a
															href={personUrl(typeof pi === 'string' ? pi : '')}
															class="hover:text-primary transition-colors">{pi}</a
														>{/each}
												</p>
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
	{:else}
		<!-- Overview mode -->
		<div class="grid gap-4 sm:grid-cols-3">
			<StatCard label="Research Sections" value={sections.length} icon={BookOpen} />
			<StatCard label="Total Projects" value={totalProjects} icon={Briefcase} />
			<StatCard label="Avg. Projects / Section" value={avgPerSection} icon={Layers} />
		</div>

		<!-- Chart -->
		<ChartCard
			title="Projects per Research Section"
			subtitle="Click a bar to view section details"
			contentHeight="h-chart-sm"
		>
			{#if chartData.length > 0}
				<BarChart data={chartData} onclick={(name) => selectSection(name)} />
			{:else}
				<EmptyState message="No data available" icon={BookOpen} />
			{/if}
		</ChartCard>

		<!-- Section Cards Grid -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each sections as section (section.name)}
				<button onclick={() => selectSection(section.name)} class="text-left">
					<Card
						class="overflow-hidden h-full hover:shadow-lg transition-shadow cursor-pointer group"
						style="border-left: 3px solid {getSectionColor(section.name)}"
					>
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-base group-hover:text-primary transition-colors">
										{#snippet children()}{section.name}{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<div class="space-y-3">
										{#if section.description}
											<p class="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
												{section.description}
											</p>
										{/if}
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-3">
												<Badge variant="secondary" class="text-xs">
													{#snippet children()}{section.projects.length} project{section.projects
															.length !== 1
															? 's'
															: ''}{/snippet}
												</Badge>
												{#if section.principalInvestigators.length > 0}
													<span class="text-xs text-muted-foreground">
														{section.principalInvestigators.length} PI{section
															.principalInvestigators.length !== 1
															? 's'
															: ''}
													</span>
												{/if}
											</div>
											<ArrowRight
												class="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors"
											/>
										</div>
									</div>
								{/snippet}
							</CardContent>
						{/snippet}
					</Card>
				</button>
			{/each}
		</div>
	{/if}
</div>
