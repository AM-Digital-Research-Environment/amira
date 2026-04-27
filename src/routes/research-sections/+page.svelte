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
	import { EntityDashboardSection } from '$lib/components/dashboards';
	import { SearchableItemsCard } from '$lib/components/entity-browse';
	import { projects, researchSections, allCollections, ensureCollections } from '$lib/stores/data';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { extractResearchSections, buildProjectGantt } from '$lib/utils/dataTransform';
	import { personUrl, projectUrl } from '$lib/utils/urls';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import { createEntityDetailState } from '$lib/utils/loaders';
	import type { Project, CollectionItem } from '$lib/types';
	import {
		formatDate,
		getProjectTitle,
		getSectionColor,
		getSectionColorResolved
	} from '$lib/utils/helpers';
	import { EXTERNAL_SECTION } from '$lib/utils/external';
	import {
		BookOpen,
		Briefcase,
		Layers,
		ExternalLink,
		Users,
		ArrowRight,
		GraduationCap,
		UserCheck
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

	// Combined data: merge manual info with project associations. The cluster
	// has exactly six thematic research sections; "External" is a pseudo-section
	// for datasets that don't belong to them (BayGlo2025, ILAM). We keep the
	// two groups separate below so the overview never implies External is one
	// of the cluster's sections.
	let sections = $derived.by(() => {
		const sectionNames = new SvelteSet<string>();
		Object.keys($researchSections).forEach((name) => sectionNames.add(name));
		$projects.forEach((p) => p.researchSection?.forEach((s) => sectionNames.add(s)));

		const thematic = [...sectionNames].filter((n) => n !== EXTERNAL_SECTION).sort();
		const ordered = sectionNames.has(EXTERNAL_SECTION) ? [...thematic, EXTERNAL_SECTION] : thematic;

		return ordered.map((name) => {
			const info = $researchSections[name];
			const startYear = info?.date?.start ? new Date(info.date.start).getUTCFullYear() : null;
			// Phase 2 (Africa Multiple 2.0) sections begin in 2026; everything
			// earlier is Phase 1. External is not tied to a phase.
			const phase = name === EXTERNAL_SECTION ? null : startYear && startYear >= 2026 ? 2 : 1;
			return {
				name,
				url: info?.url || '',
				description:
					info?.description || (name === EXTERNAL_SECTION ? EXTERNAL_SECTION_DESCRIPTION : ''),
				objectives: info?.objectives || '',
				workProgramme: info?.workProgramme || '',
				principalInvestigators: info?.principalInvestigators || [],
				members: info?.members || [],
				spokesperson: info?.spokesperson || '',
				date: info?.date,
				phase,
				projects: projectsBySection.get(name) || [],
				isExternal: name === EXTERNAL_SECTION
			};
		});
	});

	let thematicSections = $derived(sections.filter((s) => !s.isExternal));
	let phase1Sections = $derived(thematicSections.filter((s) => s.phase === 1));
	let phase2Sections = $derived(thematicSections.filter((s) => s.phase === 2));
	let externalSections = $derived(sections.filter((s) => s.isExternal));

	let selectedSectionData = $derived(
		selectedSection ? sections.find((s) => s.name === selectedSection) || null : null
	);

	// Gantt chart for selected section's projects. Multi-section projects
	// are legitimate members of every section they list, so we override the
	// category to the section currently being viewed — otherwise such
	// projects would appear in an unrelated section's colour and read as
	// "from another section".
	let sectionGanttData = $derived.by(() => {
		if (!selectedSectionData) return [];
		const sectionName = selectedSectionData.name;
		return buildProjectGantt(selectedSectionData.projects).map((d) => ({
			...d,
			category: sectionName
		}));
	});

	let sectionCategoryColors = $derived.by(() => {
		if (!selectedSectionData) return undefined;
		return { [selectedSectionData.name]: getSectionColorResolved(selectedSectionData.name) };
	});

	let chartData = $derived(extractResearchSections($projects));
	let totalProjects = $derived(new Set($projects.flatMap((p) => p._id)).size);
	// Stats reflect only the cluster's thematic sections -- counting External
	// against "avg. projects per section" would misrepresent the cluster's
	// actual structure. Phase 2 sections have no projects yet (they begin in
	// June 2026), so they're excluded from the average to avoid halving it.
	let phase1ProjectCount = $derived(phase1Sections.reduce((sum, s) => sum + s.projects.length, 0));
	let avgPerSection = $derived(
		phase1Sections.length > 0 ? Math.round(phase1ProjectCount / phase1Sections.length) : 0
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

	// Per-section JSON (items + aggregates). Skips the 13 MB collections
	// dump on direct-detail-URL hits.
	const detail = createEntityDetailState('research-section', () => selectedSection);

	onMount(() => {
		if (!selectedSection) void ensureCollections(base);
	});

	$effect(() => {
		if (!selectedSection) void ensureCollections(base);
	});

	// Research items scoped to the selected section. Prefer the precomputed
	// JSON's slim items; fall back to deriving from $allCollections when the
	// live dump is present (Back-to-list, overview charts, etc).
	let sectionItems = $derived.by((): CollectionItem[] => {
		if (!selectedSectionData) return [];
		if (detail.items.length > 0) return detail.items;
		const projectIds = new Set(selectedSectionData.projects.map((p) => p.id));
		return $allCollections.filter((item) => projectIds.has(item.project?.id || ''));
	});
</script>

{#if selectedSectionData}
	{@const seoDesc =
		selectedSectionData.description?.split('\n').slice(0, 2).join(' ').trim() ||
		`${selectedSectionData.name} — research section of the Africa Multiple Cluster of Excellence with ${selectedSectionData.projects.length} associated project${selectedSectionData.projects.length === 1 ? '' : 's'}.`}
	<SEO
		title={selectedSectionData.name}
		description={seoDesc.slice(0, 280)}
		type="article"
		keywords={[
			selectedSectionData.name,
			'research section',
			'thematic research',
			...(selectedSectionData.principalInvestigators || []).slice(0, 4)
		]}
	/>
{:else}
	<SEO
		title="Research Sections"
		description="Explore the six thematic research sections of the Africa Multiple Cluster of Excellence: Affiliations, Arts &amp; Aesthetics, Knowledges, Learning, Mobilities, and Moralities."
		keywords={[
			'research sections',
			'thematic research',
			'Affiliations',
			'Arts and Aesthetics',
			'Knowledges',
			'Learning',
			'Mobilities',
			'Moralities'
		]}
	/>
{/if}

<div class="space-y-8 animate-slide-in-up">
	<!-- Header -->
	<div>
		<h1 class="page-title">Research Sections</h1>
		<p class="page-subtitle">
			The Cluster's research is organised into Research Sections, providing a coherent structure for
			inter- and transdisciplinary collaboration between researchers from Bayreuth, Africa, and a
			global network. Africa Multiple 1.0 ran six Sections from 2019 to 2025; Africa Multiple 2.0
			pursues research in six new Sections starting in June 2026.
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

		<!-- Spokesperson (Phase 2 sections) -->
		{#if selectedSectionData.spokesperson}
			<Card class="overflow-hidden">
				{#snippet children()}
					<CardHeader>
						{#snippet children()}
							<CardTitle class="text-lg">
								{#snippet children()}
									<span class="flex items-center gap-2">
										<UserCheck class="h-5 w-5 text-primary" />
										Spokesperson
									</span>
								{/snippet}
							</CardTitle>
						{/snippet}
					</CardHeader>
					<CardContent>
						{#snippet children()}
							<a
								href={personUrl(selectedSectionData.spokesperson)}
								class="text-sm text-foreground hover:text-primary transition-colors"
							>
								{selectedSectionData.spokesperson}
							</a>
						{/snippet}
					</CardContent>
				{/snippet}
			</Card>
		{/if}

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
							<ul class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground">
								{#each selectedSectionData.principalInvestigators as pi (pi)}
									<li>
										<a href={personUrl(pi)} class="hover:text-primary transition-colors">
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

		<!--
			Project Timeline Gantt -- hidden for External because the pseudo
			section's projects have unreliable/sparse dates that make the axis
			blow out (e.g. ILAM's 1013 founding date stretching the timeline
			back a millennium). Thematic sections render it normally.
		-->
		{#if sectionGanttData.length > 0 && !selectedSectionData.isExternal}
			<ChartCard
				title="Project Timelines"
				subtitle="Duration of projects in this research section"
				contentHeight="h-chart-xl"
			>
				<GanttChart
					data={sectionGanttData}
					formatAsYear={true}
					categoryColors={sectionCategoryColors}
					showLegend={false}
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

		<!-- Research Items — primary content list. Comes before the
		     aggregate-chart dashboard so users see what's actually in
		     the section first. -->
		{#if sectionItems.length > 0}
			<SearchableItemsCard items={sectionItems} />
		{/if}

		<!-- Precomputed section dashboard (timelines, heatmap, top subjects
		     and contributors, geographic origins). -->
		<EntityDashboardSection
			entityType="research-section"
			entityId={selectedSectionData.name}
			items={sectionItems}
			data={detail.data}
		/>
	{:else}
		<!-- Overview mode -->
		<div class="grid gap-4 sm:grid-cols-3">
			<StatCard label="Research Sections" value={thematicSections.length} icon={BookOpen} />
			<StatCard label="Total Projects" value={totalProjects} icon={Briefcase} />
			<StatCard label="Avg. Projects / Section" value={avgPerSection} icon={Layers} />
		</div>

		<!-- Chart (Phase 1 sections only — Phase 2 starts June 2026) -->
		<ChartCard
			title="Projects per Research Section"
			subtitle="Phase 1 sections · click a bar to view details"
			contentHeight="h-chart-sm"
		>
			{#if chartData.length > 0}
				<BarChart data={chartData} onclick={(name) => selectSection(name)} />
			{:else}
				<EmptyState message="No data available" icon={BookOpen} />
			{/if}
		</ChartCard>

		<!-- Phase 1: Africa Multiple 1.0 (2019–2025) -->
		{#if phase1Sections.length > 0}
			<div>
				<div class="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
					<h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
						Africa Multiple 1.0 — Phase 1
					</h2>
					<span class="text-xs text-muted-foreground">2019 – 2025</span>
				</div>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each phase1Sections as section (section.name)}
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
													<div class="flex items-center gap-3 flex-wrap">
														<Badge variant="secondary" class="text-xs">
															{#snippet children()}{section.projects.length} project{section
																	.projects.length !== 1
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
														{#if section.members.length > 0}
															<span class="text-xs text-muted-foreground">
																{section.members.length} member{section.members.length !== 1
																	? 's'
																	: ''}
															</span>
														{/if}
													</div>
													<ArrowRight
														class="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0"
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
			</div>
		{/if}

		<!-- Phase 2: Africa Multiple 2.0 (from June 2026) -->
		{#if phase2Sections.length > 0}
			<div>
				<div class="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
					<h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
						Africa Multiple 2.0 — Phase 2
					</h2>
					<span class="text-xs text-muted-foreground">from June 2026</span>
				</div>
				<p class="text-sm text-muted-foreground mb-4 leading-relaxed">
					Africa Multiple 2.0 pursues research in six new Research Sections: Accumulation,
					Digitalities, Ecologies, In/securities, Re:membering, and Translating. Led by Principal
					Investigators and Key Researchers, these Sections are the organisational framework within
					which Cluster members will conduct joint research projects across academic disciplines and
					Cluster locations. The six Sections are the fruit of collaborative work involving over 80
					scholars from all five Cluster locations. The new projects will start in June 2026.
				</p>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each phase2Sections as section (section.name)}
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
													<div class="flex items-center gap-3 flex-wrap">
														{#if section.spokesperson}
															<span class="text-xs text-muted-foreground truncate">
																Spokesperson: <span class="text-foreground"
																	>{section.spokesperson}</span
																>
															</span>
														{/if}
														{#if section.members.length > 0}
															<span class="text-xs text-muted-foreground">
																{section.members.length} member{section.members.length !== 1
																	? 's'
																	: ''}
															</span>
														{/if}
													</div>
													<ArrowRight
														class="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0"
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
			</div>
		{/if}

		<!--
			External collections -- rendered separately with a dashed outline and
			muted styling so they never read as one of the cluster's research
			sections. The heading + distinct card treatment carry the signal;
			we don't need badges or extra explanatory copy.
		-->
		{#if externalSections.length > 0}
			<div class="pt-2">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
					Outside the cluster's research sections
				</h2>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each externalSections as section (section.name)}
						<button onclick={() => selectSection(section.name)} class="text-left">
							<Card
								class="overflow-hidden h-full hover:shadow-md transition-shadow cursor-pointer group border-dashed bg-muted/30"
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
													<Badge variant="secondary" class="text-xs">
														{#snippet children()}{section.projects.length} project{section.projects
																.length !== 1
																? 's'
																: ''}{/snippet}
													</Badge>
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
			</div>
		{/if}
	{/if}
</div>
