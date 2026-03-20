<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { researchItemUrl, languageUrl } from '$lib/utils/urls';
	import { languageName } from '$lib/utils/languages';
	import { StatCard, ChartCard, EmptyState, Badge, Combobox, SEO } from '$lib/components/ui';
	import { StackedTimeline, BarChart, PieChart, WordCloud, LocationMap, SankeyChart, SunburstChart, ChordDiagram, HeatmapChart } from '$lib/components/charts';
	import { allCollections } from '$lib/stores/data';
	import {
		groupByYearAndType,
		extractSubjects,
		extractResourceTypes,
		extractTags,
		extractLocations,
		extractLanguages,
		countOccurrences,
		buildSankeyData,
		buildSunburstData,
		buildSubjectCoOccurrence,
		buildHeatmapData
	} from '$lib/utils/dataTransform';
	import { loadEnrichedLocations, UNIVERSITY_COLLECTIONS } from '$lib/utils/dataLoader';
	import { universities } from '$lib/types';
	import type { CollectionItem, EnrichedLocationsData } from '$lib/types';
	import { FileText, Layers, Users, MapPin, Calendar, BarChart3 } from '@lucide/svelte';

	// Enriched location data for the map
	let enrichedLocations = $state<EnrichedLocationsData | null>(null);

	onMount(async () => {
		enrichedLocations = await loadEnrichedLocations(base);
	});

	// Build a map of project IDs to full project names from the data
	let projectNameMap = $derived(
		$allCollections.reduce((acc, item) => {
			if (item.project?.id && item.project?.name) {
				acc[item.project.id] = item.project.name;
			}
			return acc;
		}, {} as Record<string, string>)
	);

	// Format collection ID to readable label
	function formatCollectionLabel(name: string): string {
		return name
			.replace(/^(UBT|ULG|UJKZ|UFB)_/, '')
			.replace(/(\d{4})$/, ' $1');
	}

	function trimLabel(text: string, max = 60): string {
		return text.length > max ? text.slice(0, max - 1) + '\u2026' : text;
	}

	// Build grouped and sorted collection options
	let collectionGroups = $derived(
		universities.map(uni => ({
			label: uni.name,
			options: (UNIVERSITY_COLLECTIONS[uni.id] || [])
				.map(name => {
					const fullName = projectNameMap[name] || formatCollectionLabel(name);
					return {
						value: name,
						label: trimLabel(fullName),
						title: fullName
					};
				})
				.sort((a, b) => a.label.localeCompare(b.label))
		})).filter(group => group.options.length > 0)
	);

	let selectedCollection = $state('all');
	let wordCloudMaxWords = $state(50);

	// Get current collection based on selection
	function getFilteredCollection(id: string): CollectionItem[] {
		if (id === 'all') return $allCollections;
		return $allCollections.filter(item => item.project?.id === id);
	}

	let currentCollection = $derived<CollectionItem[]>(getFilteredCollection(selectedCollection));

	// Derived chart data
	let timelineData = $derived(groupByYearAndType(currentCollection));
	let subjectsData = $derived(extractSubjects(currentCollection));
	let resourceTypesData = $derived(extractResourceTypes(currentCollection));
	let wordCloudData = $derived(extractTags(currentCollection));
	let locationsData = $derived(extractLocations(currentCollection));
	let languagesData = $derived(extractLanguages(currentCollection));

	// Convert locations to bar chart format (grouped by country)
	let locationsByCountry = $derived.by(() => {
		const countryMap = new Map<string, number>();
		locationsData.forEach((d) => {
			if (d.country) {
				countryMap.set(d.country, (countryMap.get(d.country) || 0) + d.count);
			}
		});
		return Array.from(countryMap.entries())
			.map(([name, value]) => ({ name, value }))
			.sort((a, b) => b.value - a.value);
	});

	// Extract contributors
	let contributorsData = $derived(
		countOccurrences(currentCollection, (item) => {
			if (!item.name || !Array.isArray(item.name)) return null;
			return item.name.map((n) => n.name?.label).filter(Boolean);
		})
	);

	// Sankey, Sunburst, and Chord diagram data
	let sankeyData = $derived(buildSankeyData(currentCollection));
	let sunburstData = $derived(buildSunburstData(currentCollection));
	let subjectCoOccurrence = $derived(buildSubjectCoOccurrence(currentCollection, 2, 20));

	// Heatmap: Resource Type × Language (resolve language codes to names)
	let resourceLanguageHeatmap = $derived.by(() => {
		const raw = buildHeatmapData(
			currentCollection,
			(item) => item.typeOfResource,
			(item) => item.language?.map((l) => languageName(l)),
			12,
			10
		);
		return raw;
	});
</script>
<SEO title="Collections" description="Explore research collections across partner universities" />

<div class="space-y-6">
	<!-- Page Header with Collection Selector -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-slide-in-up">
		<div class="flex-1 min-w-0">
			<h1 class="page-title">Collections</h1>
			{#if selectedCollection !== 'all' && projectNameMap[selectedCollection]}
				<p class="page-subtitle mt-1 line-clamp-2">
					{projectNameMap[selectedCollection]}
				</p>
			{:else}
				<p class="page-subtitle mt-1">
					Browse collection metadata and visualizations
				</p>
			{/if}
		</div>
		<div class="w-full sm:w-80 flex-shrink-0">
			<Combobox
				options={[{ value: 'all', label: 'All Collections' }]}
				groups={collectionGroups}
				bind:value={selectedCollection}
				placeholder="Search collections..."
			/>
		</div>
	</div>

	<!-- Stats Cards -->
	<div class="grid gap-4 md:grid-cols-4">
		<StatCard value={currentCollection.length} label="Total Items" icon={FileText} animationDelay="75ms" />
		<StatCard value={resourceTypesData.length} label="Resource Types" icon={Layers} iconBgClass="bg-chart-2/10" animationDelay="100ms" />
		<StatCard value={contributorsData.length} label="Contributors" icon={Users} iconBgClass="bg-chart-1/10" animationDelay="150ms" />
		<StatCard value={locationsData.length} label="Locations" icon={MapPin} iconBgClass="bg-chart-3/10" animationDelay="200ms" />
	</div>

	<!-- Charts Grid -->
	<div class="grid gap-6 lg:grid-cols-2">
		<ChartCard title="Items by Year" contentHeight="h-[420px]" class="col-span-full">
			{#if timelineData.length > 0}
				<StackedTimeline data={timelineData} />
			{:else}
				<EmptyState message="No timeline data available" icon={Calendar} />
			{/if}
		</ChartCard>

		<ChartCard title="Resource Types">
			{#if resourceTypesData.length > 0}
				<PieChart data={resourceTypesData} />
			{:else}
				<EmptyState />
			{/if}
		</ChartCard>

		<ChartCard title="Subject Word Cloud" contentHeight="h-[450px]" class="col-span-full">
			{#snippet headerExtra()}
				<div class="flex items-center gap-4">
					<label for="wordcloud-slider" class="text-sm text-muted-foreground whitespace-nowrap">
						Words: {wordCloudMaxWords}
					</label>
					<input
						id="wordcloud-slider"
						type="range"
						min="20"
						max="200"
						step="10"
						bind:value={wordCloudMaxWords}
						class="w-32 sm:w-48 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
					/>
				</div>
			{/snippet}
			{#if wordCloudData.length > 0}
				<WordCloud data={wordCloudData} maxWords={wordCloudMaxWords} />
			{:else}
				<EmptyState />
			{/if}
		</ChartCard>

		<ChartCard title="Geographic Origins (Map)" contentHeight="h-[650px]" class="col-span-full overflow-visible">
			<LocationMap data={locationsData} items={currentCollection} {enrichedLocations} />
		</ChartCard>

		<ChartCard title="Geographic Origins (Chart)">
			{#if locationsByCountry.length > 0}
				<BarChart data={locationsByCountry} maxItems={10} />
			{:else}
				<EmptyState />
			{/if}
		</ChartCard>

		<ChartCard title="Languages">
			{#if languagesData.length > 0}
				<BarChart data={languagesData} maxItems={10} />
			{:else}
				<EmptyState />
			{/if}
		</ChartCard>

		<ChartCard title="Top Contributors">
			{#if contributorsData.length > 0}
				<BarChart data={contributorsData} maxItems={10} />
			{:else}
				<EmptyState />
			{/if}
		</ChartCard>

		<ChartCard
			title="Resource Type × Language"
			subtitle="Cross-tabulation showing which resource types exist in which languages"
			contentHeight="h-[450px]"
			class="col-span-full"
		>
			{#if resourceLanguageHeatmap.length > 0}
				<HeatmapChart data={resourceLanguageHeatmap} />
			{:else}
				<EmptyState message="Not enough data for heatmap" />
			{/if}
		</ChartCard>

		<ChartCard title="Top Subjects" contentHeight="h-[300px]" class="col-span-full">
			{#if subjectsData.length > 0}
				<BarChart data={subjectsData} maxItems={15} horizontal={false} />
			{:else}
				<EmptyState icon={BarChart3} />
			{/if}
		</ChartCard>

		<ChartCard
			title="Subject Co-occurrence"
			subtitle="Shows which subjects frequently appear together"
			contentHeight="h-[550px]"
			class="col-span-full"
		>
			{#if subjectCoOccurrence.names.length > 0}
				<ChordDiagram data={subjectCoOccurrence} />
			{:else}
				<EmptyState message="Not enough subject data for co-occurrence analysis" />
			{/if}
		</ChartCard>

		<ChartCard title="Contributor &rarr; Project &rarr; Resource Type Flow" contentHeight="h-[450px]" class="col-span-full">
			{#if sankeyData.links.length > 0}
				<SankeyChart nodes={sankeyData.nodes} links={sankeyData.links} />
			{:else}
				<EmptyState message="No flow data available" />
			{/if}
		</ChartCard>

		<ChartCard title="Resource Type &rarr; Language &rarr; Subject Hierarchy" contentHeight="h-[500px]" class="col-span-full">
			{#if sunburstData.length > 0}
				<SunburstChart data={sunburstData} />
			{:else}
				<EmptyState message="No hierarchy data available" />
			{/if}
		</ChartCard>
	</div>

	<!-- Recent Items -->
	<ChartCard title="Recent Items" contentHeight="">
		<div class="space-y-4">
			{#each currentCollection.slice(0, 10) as item}
				<a href={researchItemUrl(item._id || item.dre_id)} class="flex items-start gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
					<div class="flex-1 min-w-0">
						<h4 class="font-medium truncate">
							{item.titleInfo?.[0]?.title || 'Untitled'}
						</h4>
						<p class="text-sm text-muted-foreground truncate">
							{item.project?.name || 'No project'}
						</p>
						<div class="flex flex-wrap gap-1 mt-2">
							<Badge variant="secondary">{item.typeOfResource || 'Unknown'}</Badge>
							{#each item.language?.slice(0, 2) || [] as lang}
								<a href={languageUrl(lang)}><Badge variant="outline" class="hover:bg-primary/10 transition-colors">{languageName(lang)}</Badge></a>
							{/each}
						</div>
					</div>
				</a>
			{/each}
		</div>
	</ChartCard>
</div>
