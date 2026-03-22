<script lang="ts">
	import { StatCard, ChartCard, EmptyState, SEO } from '$lib/components/ui';
	import { StackedTimeline, BarChart, PieChart, WordCloud, HeatmapChart } from '$lib/components/charts';
	import { FilterPanel } from '$lib/components/layout';
	import {
		projects,
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
	import { FileText, Briefcase, Users, Building2, MapPin, Languages, Tag, Layers, Calendar, PieChart as PieChartIcon, BarChart3, Edit3, BookOpen, ExternalLink } from '@lucide/svelte';

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

	// Calculate unique institutions from filtered collection items
	let uniqueInstitutions = $derived.by(() => {
		const inst = new Set<string>();
		$filteredCollections.forEach((item) => {
			if (Array.isArray(item.name)) {
				item.name.forEach((entry) => {
					if (entry.name?.qualifier === 'institution' && entry.name?.label) inst.add(entry.name.label);
					if (Array.isArray(entry.affl)) entry.affl.forEach((a) => { if (a) inst.add(a); });
				});
			}
		});
		return inst.size;
	});

	// Calculate unique locations and countries from filtered collection items
	let locationStats = $derived.by(() => {
		const countries = new Set<string>();
		const locations = new Set<string>();
		$filteredCollections.forEach((item) => {
			item.location?.origin?.forEach((o) => {
				if (o.l1) countries.add(o.l1);
				const key = [o.l1, o.l2, o.l3].filter(Boolean).join('/');
				if (key) locations.add(key);
			});
		});
		return { locations: locations.size, countries: countries.size };
	});

	// Calculate unique languages from filtered collection items
	let uniqueLanguages = $derived.by(() => {
		const langs = new Set<string>();
		$filteredCollections.forEach((item) => {
			item.language?.forEach((l) => { if (l) langs.add(l); });
		});
		return langs.size;
	});

	// Calculate unique subjects & tags from filtered collection items
	let uniqueSubjectsAndTags = $derived.by(() => {
		const terms = new Set<string>();
		$filteredCollections.forEach((item) => {
			item.subject?.forEach((s) => {
				const label = s.authLabel || s.origLabel;
				if (label) terms.add(label);
			});
			item.tags?.forEach((t) => { if (t) terms.add(t); });
		});
		return terms.size;
	});

	// Calculate unique resource types from filtered collection items
	let uniqueResourceTypes = $derived.by(() => {
		const types = new Set<string>();
		$filteredCollections.forEach((item) => {
			if (item.typeOfResource) types.add(item.typeOfResource);
		});
		return types.size;
	});
</script>
<SEO title="Overview" description="Dashboard overview of research data from the Africa Multiple Cluster of Excellence" />

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

	<!-- Stats Cards -->
	<div class="grid gap-4 grid-cols-2 lg:grid-cols-4">
		<StatCard
			value={$filteredCollections.length}
			label="Research Items"
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
			animationDelay="125ms"
		/>
		<StatCard
			value={uniqueInstitutions}
			label="Institutions"
			icon={Building2}
			iconBgClass="bg-chart-2/10"
			animationDelay="150ms"
		/>
		<StatCard
			value={locationStats.locations}
			label="Locations"
			subtitle="in {locationStats.countries} countries"
			icon={MapPin}
			iconBgClass="bg-chart-3/10"
			animationDelay="175ms"
		/>
		<StatCard
			value={uniqueLanguages}
			label="Languages"
			icon={Languages}
			iconBgClass="bg-chart-4/10"
			animationDelay="200ms"
		/>
		<StatCard
			value={uniqueSubjectsAndTags}
			label="Subjects & Tags"
			icon={Tag}
			iconBgClass="bg-chart-5/10"
			animationDelay="225ms"
		/>
		<StatCard
			value={uniqueResourceTypes}
			label="Resource Types"
			icon={Layers}
			iconBgClass="bg-chart-1/10"
			animationDelay="250ms"
		/>
	</div>

	<!-- Research Sections (project-level, unfiltered) -->
	<div class="grid gap-6 lg:grid-cols-2">
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

	<!-- Separator -->
	<div class="divider-fade my-2"></div>
	<p class="text-sm text-muted-foreground text-center">Research items — use filters to refine</p>

	<!-- Filters -->
	<div class="animate-slide-in-up delay-300">
		<FilterPanel />
	</div>

	<!-- Filtered Charts Grid -->
	<div class="grid gap-6 lg:grid-cols-2">
		<ChartCard title="Research Items Timeline by Type" contentHeight="h-[400px]" class="col-span-full">
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
	</div>
</div>
