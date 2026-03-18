<script lang="ts">
	import { StatCard, ChartCard, EmptyState, Card, CardHeader, CardTitle, CardContent, Badge } from '$lib/components/ui';
	import { BarChart } from '$lib/components/charts';
	import { projects, researchSections } from '$lib/stores/data';
	import { extractResearchSections } from '$lib/utils/dataTransform';
	import { base } from '$app/paths';
	import { personUrl, projectUrl } from '$lib/utils/urls';
	import type { Project } from '$lib/types';
	import { BookOpen, Briefcase, Layers, ExternalLink, ChevronDown, ChevronUp, Users } from '@lucide/svelte';

	// Group projects by research section
	let projectsBySection = $derived.by(() => {
		const map = new Map<string, Project[]>();
		$projects.forEach((p) => {
			p.researchSection?.forEach((s) => {
				if (!map.has(s)) map.set(s, []);
				map.get(s)!.push(p);
			});
		});
		return map;
	});

	// Combined data: merge manual info with project associations
	let sections = $derived.by(() => {
		const sectionNames = new Set<string>();

		// Gather all section names from both sources
		Object.keys($researchSections).forEach((name) => sectionNames.add(name));
		$projects.forEach((p) => p.researchSection?.forEach((s) => sectionNames.add(s)));

		return Array.from(sectionNames)
			.sort()
			.map((name) => ({
				name,
				url: $researchSections[name]?.url || '',
				description: $researchSections[name]?.description || '',
				objectives: $researchSections[name]?.objectives || '',
				workProgramme: $researchSections[name]?.workProgramme || '',
				principalInvestigators: $researchSections[name]?.principalInvestigators || [],
				members: $researchSections[name]?.members || [],
				projects: projectsBySection.get(name) || []
			}));
	});

	let chartData = $derived(extractResearchSections($projects));
	let totalProjects = $derived(new Set($projects.flatMap((p) => p._id)).size);
	let avgPerSection = $derived(sections.length > 0 ? Math.round(totalProjects / sections.length) : 0);

	// Track which sections are expanded (keyed by "sectionName:field")
	let expandedSections = $state(new Set<string>());

	function toggleSection(key: string) {
		const next = new Set(expandedSections);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		expandedSections = next;
	}

	function sectionSlug(name: string): string {
		return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
	}

	function truncate(text: string, maxLen: number): string {
		if (text.length <= maxLen) return text;
		return text.substring(0, maxLen).replace(/\s+\S*$/, '') + '...';
	}

	function getProjectTitle(project: Project): string {
		return project.name || project.idShort || 'Untitled';
	}

	function formatDate(date: Date | null): string {
		if (!date) return '';
		const d = new Date(date);
		if (isNaN(d.getTime())) return '';
		return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
	}
</script>

<div class="space-y-8 animate-slide-in-up">
	<!-- Header -->
	<div>
		<h1 class="page-title">Research Sections</h1>
		<p class="page-subtitle">Six thematic fields, organized into Research Sections, provide a coherent structure to our research projects. Most projects pursue an inter- and/or transdisciplinary agenda and involve close cooperation between researchers from Bayreuth, Africa, and our global network. Explore each section's objectives, work programme, and associated projects below.</p>
	</div>

	<!-- Stats -->
	<div class="grid gap-4 sm:grid-cols-3">
		<StatCard label="Research Sections" value={sections.length} icon={BookOpen} />
		<StatCard label="Total Projects" value={totalProjects} icon={Briefcase} />
		<StatCard label="Avg. Projects / Section" value={avgPerSection} icon={Layers} />
	</div>

	<!-- Chart -->
	<ChartCard title="Projects per Research Section" contentHeight="h-[300px]">
		{#if chartData.length > 0}
			<BarChart data={chartData} />
		{:else}
			<EmptyState message="No data available" icon={BookOpen} />
		{/if}
	</ChartCard>

	<!-- Section Cards -->
	<div class="grid gap-6">
		{#each sections as section}
			<Card class="overflow-hidden scroll-mt-24" id={sectionSlug(section.name)}>
				{#snippet children()}
					<CardHeader>
						{#snippet children()}
							<div class="flex items-start justify-between gap-3 min-w-0">
								<CardTitle class="min-w-0 truncate">
									{#snippet children()}{section.name}{/snippet}
								</CardTitle>
								<div class="flex items-center gap-3 shrink-0">
									{#if section.url}
										<a
											href={section.url}
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary-hover transition-colors whitespace-nowrap"
										>
											<ExternalLink class="h-3.5 w-3.5" />
											Website
										</a>
									{/if}
									<Badge variant="secondary">
										{#snippet children()}{section.projects.length} project{section.projects.length !== 1 ? 's' : ''}{/snippet}
									</Badge>
								</div>
							</div>
						{/snippet}
					</CardHeader>
					<CardContent>
						{#snippet children()}
							<div class="space-y-4">
								<!-- Description (intro) -->
								{#if section.description}
									<div class="text-sm text-muted-foreground leading-relaxed break-words">
										{#each section.description.split('\n\n') as paragraph}
											<p class="mb-2 last:mb-0">{paragraph}</p>
										{/each}
									</div>
								{:else}
									<p class="text-sm text-muted-foreground italic">No description available yet.</p>
								{/if}

								<!-- Principal Investigators -->
								{#if section.principalInvestigators.length > 0}
									<div class="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
										<Users class="h-4 w-4 text-primary mt-0.5 shrink-0" />
										<div>
											<p class="text-xs font-medium text-muted-foreground mb-1.5">Principal Investigators</p>
											<p class="text-sm text-foreground">
												{#each section.principalInvestigators as pi, i}
													{#if i > 0}<span class="text-muted-foreground"> · </span>{/if}
													<a
														href={personUrl(pi)}
														class="hover:text-primary transition-colors"
													>{pi}</a>
												{/each}
											</p>
										</div>
									</div>
								{/if}

								<!-- Members -->
								{#if section.members.length > 0}
									<div class="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
										<Users class="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
										<div>
											<p class="text-xs font-medium text-muted-foreground mb-1.5">Members</p>
											<p class="text-sm text-foreground">
												{#each section.members as member, i}
													{#if i > 0}<span class="text-muted-foreground"> · </span>{/if}
													<a
														href={personUrl(member)}
														class="hover:text-primary transition-colors"
													>{member}</a>
												{/each}
											</p>
										</div>
									</div>
								{/if}

								<!-- Objectives (expandable) -->
								{#if section.objectives}
									<div class="border-t border-border pt-3">
										<button
											onclick={() => toggleSection(`${section.name}:objectives`)}
											class="flex items-center justify-between w-full text-sm font-semibold text-foreground"
										>
											<span>Objectives</span>
											{#if expandedSections.has(`${section.name}:objectives`)}
												<ChevronUp class="h-4 w-4 text-muted-foreground" />
											{:else}
												<ChevronDown class="h-4 w-4 text-muted-foreground" />
											{/if}
										</button>
										{#if expandedSections.has(`${section.name}:objectives`)}
											<div class="mt-3 text-sm text-muted-foreground leading-relaxed break-words">
												{#each section.objectives.split('\n\n') as paragraph}
													<p class="mb-2 last:mb-0">{paragraph}</p>
												{/each}
											</div>
										{/if}
									</div>
								{/if}

								<!-- Work Programme (expandable) -->
								{#if section.workProgramme}
									<div class="border-t border-border pt-3">
										<button
											onclick={() => toggleSection(`${section.name}:workProgramme`)}
											class="flex items-center justify-between w-full text-sm font-semibold text-foreground"
										>
											<span>Work Programme</span>
											{#if expandedSections.has(`${section.name}:workProgramme`)}
												<ChevronUp class="h-4 w-4 text-muted-foreground" />
											{:else}
												<ChevronDown class="h-4 w-4 text-muted-foreground" />
											{/if}
										</button>
										{#if expandedSections.has(`${section.name}:workProgramme`)}
											<div class="mt-3 text-sm text-muted-foreground leading-relaxed break-words">
												{#each section.workProgramme.split('\n\n') as paragraph}
													<p class="mb-2 last:mb-0">{paragraph}</p>
												{/each}
											</div>
										{/if}
									</div>
								{/if}

								<!-- Associated Projects (expandable) -->
								<div class="border-t border-border pt-3">
									<button
										onclick={() => toggleSection(`${section.name}:projects`)}
										class="flex items-center justify-between w-full text-sm font-semibold text-foreground"
									>
										<span>Associated Projects</span>
										{#if expandedSections.has(`${section.name}:projects`)}
											<ChevronUp class="h-4 w-4 text-muted-foreground" />
										{:else}
											<ChevronDown class="h-4 w-4 text-muted-foreground" />
										{/if}
									</button>
									{#if expandedSections.has(`${section.name}:projects`)}
										<ul class="mt-3 space-y-2">
											{#each section.projects as project}
												<li class="flex items-start gap-2 text-sm">
													<Briefcase class="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
													<div class="min-w-0">
														<a
															href={projectUrl(project.id)}
															class="text-foreground hover:text-primary transition-colors truncate block"
														>
															{getProjectTitle(project)}
														</a>
														{#if project.date?.start || project.date?.end}
															<span class="text-xs text-muted-foreground">
																{formatDate(project.date.start)}{project.date.end ? ` - ${formatDate(project.date.end)}` : ''}
															</span>
														{/if}
													</div>
												</li>
											{/each}
										</ul>
									{/if}
								</div>
							</div>
						{/snippet}
					</CardContent>
				{/snippet}
			</Card>
		{/each}
	</div>
</div>
