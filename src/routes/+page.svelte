<script lang="ts">
	import { StatCard, ChartCard, EmptyState } from '$lib/components/ui';
	import { StackedTimeline, BarChart, PieChart, WordCloud, HeatmapChart } from '$lib/components/charts';
	import { FilterPanel } from '$lib/components/layout';
	import {
		projects,
		universitiesData,
		allCollections
	} from '$lib/stores/data';
	import { filteredCollections } from '$lib/stores/filters';
	import {
		groupByYearAndType,
		extractSubjects,
		extractResourceTypes,
		extractTags,
		extractResearchSections,
		buildResearchSectionUniversityHeatmap
	} from '$lib/utils/dataTransform';
	import { universities } from '$lib/types';
	import { base } from '$app/paths';
	import { FileText, Briefcase, Users, Building2, Calendar, PieChart as PieChartIcon, BarChart3, Edit3, BookOpen, ExternalLink } from '@lucide/svelte';

	// Word cloud controls
	let wordCloudMaxWords = $state(50);

	// Derived chart data
	let stackedTimelineData = $derived(groupByYearAndType($filteredCollections));
	let subjectsData = $derived(extractSubjects($filteredCollections));
	let resourceTypesData = $derived(extractResourceTypes($filteredCollections));
	let wordCloudData = $derived(extractTags($filteredCollections));
	let researchSectionsData = $derived(extractResearchSections($projects));
	let sectionUniversityHeatmap = $derived(buildResearchSectionUniversityHeatmap($projects, $allCollections));

	// Calculate unique projects from filtered collections
	let uniqueProjects = $derived.by(() => {
		const projectIds = new Set<string>();
		$filteredCollections.forEach((item) => {
			if (item.project?.id) projectIds.add(item.project.id);
		});
		return projectIds.size;
	});

	// Calculate unique contributors
	let uniqueContributors = $derived.by(() => {
		const contributors = new Set<string>();
		$filteredCollections.forEach((item) => {
			if (Array.isArray(item.name)) {
				item.name.forEach((entry) => {
					if (entry.name?.label) contributors.add(entry.name.label);
				});
			}
		});
		return contributors.size;
	});
</script>

<div class="space-y-8">
	<!-- Page Header -->
	<div class="page-header animate-slide-in-up">
		<h1 class="page-title">Dashboard Overview</h1>
		<p class="page-subtitle max-w-3xl">
			Browse and visualize research data from
			<a href="https://wiss-ki.eu/" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-0.5 underline underline-offset-2 decoration-primary/40 hover:decoration-primary font-medium">WissKI<ExternalLink class="inline size-3" /></a>
			(<em>Wissenschaftliche Kommunikations-Infrastruktur</em>), the research data management system of the
			<a href="https://www.africamultiple.uni-bayreuth.de/en/index.html" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-0.5 underline underline-offset-2 decoration-primary/40 hover:decoration-primary font-medium">Africa Multiple Cluster of Excellence<ExternalLink class="inline size-3" /></a>
			at the University of Bayreuth. The Cluster is an international research consortium funded by the <a href="https://www.dfg.de/en" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-0.5 underline underline-offset-2 decoration-primary/40 hover:decoration-primary font-medium">German Research Foundation (DFG)<ExternalLink class="inline size-3" /></a> that connects five centres in Africa, Brazil, and Germany to reconfigure African Studies and address global inequalities in knowledge production.
			<a href="https://www.wisski.uni-bayreuth.de/" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-0.5 underline underline-offset-2 decoration-primary/40 hover:decoration-primary font-medium">WissKI@UBT<ExternalLink class="inline size-3" /></a>
			enables researchers to search and explore research data across affiliated institutions, facilitating the discovery of collaboration opportunities.
		</p>
	</div>

	<!-- Overall Stats Cards -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		<StatCard
			value={$filteredCollections.length}
			label="Total Documents"
			icon={FileText}
			iconBgClass="bg-primary/10"
			animationDelay="75ms"
		/>
		<StatCard
			value={uniqueProjects}
			label="Projects"
			icon={Briefcase}
			iconBgClass="bg-accent/80"
			animationDelay="100ms"
		/>
		<StatCard
			value={uniqueContributors}
			label="Contributors"
			icon={Users}
			iconBgClass="bg-chart-1/10"
			animationDelay="150ms"
		/>
		<StatCard
			value={universities.length}
			label="Universities"
			icon={Building2}
			iconBgClass="bg-chart-2/10"
			animationDelay="200ms"
		/>
	</div>

	<!-- University Breakdown Cards -->
	<div class="grid gap-4 grid-cols-2 lg:grid-cols-4">
		{#each $universitiesData as uniData, index}
			<div class="stat-card animate-slide-in-up" style="animation-delay: {250 + index * 50}ms">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-muted-foreground">{uniData.university.code}</p>
						<p class="stat-value mt-2">{uniData.count}</p>
						<p class="stat-label truncate" title={uniData.university.name}>{uniData.university.name}</p>
					</div>
					<div class="size-9 sm:size-10 rounded-lg bg-white flex items-center justify-center p-1.5 shadow-sm flex-shrink-0">
						<img
							src="{base}/{uniData.university.logo}"
							alt="{uniData.university.name} logo"
							class="h-full w-full object-contain"
						/>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Filters -->
	<div class="animate-slide-in-up delay-300">
		<FilterPanel />
	</div>

	<!-- Charts Grid -->
	<div class="grid gap-6 lg:grid-cols-2">
		<ChartCard title="Documents Timeline by Type" contentHeight="h-[400px]" class="col-span-full">
			{#if stackedTimelineData.length > 0}
				<StackedTimeline data={stackedTimelineData} />
			{:else}
				<EmptyState message="No timeline data available" icon={Calendar} />
			{/if}
		</ChartCard>

		<ChartCard title="Resource Types">
			{#if resourceTypesData.length > 0}
				<PieChart data={resourceTypesData} />
			{:else}
				<EmptyState icon={PieChartIcon} />
			{/if}
		</ChartCard>

		<ChartCard title="Top Subjects">
			{#if subjectsData.length > 0}
				<BarChart data={subjectsData} maxItems={8} />
			{:else}
				<EmptyState icon={BarChart3} />
			{/if}
		</ChartCard>

		<ChartCard title="Tags & Subjects" contentHeight="h-[450px]" class="col-span-full">
			{#snippet headerExtra()}
				<div class="flex items-center gap-4">
					<label for="home-wordcloud-slider" class="text-sm text-muted-foreground whitespace-nowrap">
						Words: <span class="font-medium text-foreground">{wordCloudMaxWords}</span>
					</label>
					<input
						id="home-wordcloud-slider"
						type="range"
						min="20"
						max="200"
						step="10"
						bind:value={wordCloudMaxWords}
						class="w-32 sm:w-48 h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
					/>
				</div>
			{/snippet}
			{#if wordCloudData.length > 0}
				<WordCloud data={wordCloudData} maxWords={wordCloudMaxWords} />
			{:else}
				<EmptyState icon={Edit3} />
			{/if}
		</ChartCard>

		<ChartCard title="Research Sections">
			{#if researchSectionsData.length > 0}
				<BarChart data={researchSectionsData} maxItems={6} />
			{:else}
				<EmptyState icon={BookOpen} />
			{/if}
		</ChartCard>

		<ChartCard
			title="Research Section × University"
			subtitle="Research items by research section and university"
			contentHeight="h-[400px]"
			class="col-span-full"
		>
			{#if sectionUniversityHeatmap.length > 0}
				<HeatmapChart data={sectionUniversityHeatmap} />
			{:else}
				<EmptyState message="Not enough data for heatmap" />
			{/if}
		</ChartCard>
	</div>
</div>
