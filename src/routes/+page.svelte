<script lang="ts">
	import { StatCard, ChartCard, EmptyState, SEO } from '$lib/components/ui';
	import { ensurePublications, publications } from '$lib/stores/data';
	import StackedTimeline from '$lib/components/charts/StackedTimeline.svelte';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import PieChart from '$lib/components/charts/PieChart.svelte';
	import WordCloud from '$lib/components/charts/WordCloud.svelte';
	import HeatmapChart from '$lib/components/charts/HeatmapChart.svelte';
	import MiniMap from '$lib/components/charts/MiniMap.svelte';
	import { FilterPanel } from '$lib/components/layout';
	import CollectionIndexCard from '$lib/components/collections/CollectionIndexCard.svelte';
	import { buildCollectionCards } from '$lib/utils/featuredCollectionLoader';
	import { projects, allCollections, ensureCollections } from '$lib/stores/data';
	import { filteredCollections } from '$lib/stores/filters';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import {
		groupByYearAndType,
		extractSubjects,
		extractResourceTypes,
		extractTags,
		extractResearchSections,
		buildResearchSectionUniversityHeatmap
	} from '$lib/utils/transforms';
	import {
		FileText,
		Briefcase,
		Users,
		Building2,
		MapPin,
		Languages,
		Tag,
		Layers,
		Calendar,
		PieChart as PieChartIcon,
		BarChart3,
		Edit3,
		BookOpen,
		ExternalLink,
		SlidersHorizontal,
		Images,
		ArrowRight,
		Library
	} from '@lucide/svelte';
	import { normalizeLanguageCode } from '$lib/utils/languages';
	import {
		buildClusterPartnerLocations,
		PARTNER_LEGEND_LABELS,
		PARTNER_COLORS,
		type PartnerCategory
	} from '$lib/utils/clusterPartners';
	import { SvelteSet } from 'svelte/reactivity';

	onMount(() => {
		void ensureCollections(base);
		void ensurePublications(base);
	});

	// Word cloud controls
	let wordCloudMaxWords = $state(120);

	// Cluster geography: AMRCs (logos), the privileged partner (UFBA's CEAO,
	// logo), plus cooperation partners and global partner Centers of African
	// Studies rendered as colour-coded dots. Data lives in clusterPartners.ts
	// so the marker set stays editable without touching this page.
	const clusterLocations = buildClusterPartnerLocations();

	// Per-category visibility, toggled by the legend below the map. The map's
	// initial fitBounds runs against the full set; subsequent toggles don't
	// re-fit (`fitOnUpdate={false}`) so the camera stays put.
	const visibleCategories = new SvelteSet<PartnerCategory>(['amrc', 'cooperation', 'global']);
	let visibleClusterLocations = $derived(
		clusterLocations.filter((p) => visibleCategories.has(p.category))
	);
	function toggleCategory(c: PartnerCategory) {
		if (visibleCategories.has(c)) visibleCategories.delete(c);
		else visibleCategories.add(c);
	}

	// Derived chart data
	let stackedTimelineData = $derived(groupByYearAndType($filteredCollections));
	let subjectsData = $derived(extractSubjects($filteredCollections));
	let resourceTypesData = $derived(extractResourceTypes($filteredCollections));
	let wordCloudData = $derived(extractTags($filteredCollections));
	let researchSectionsData = $derived(extractResearchSections($projects));
	let sectionUniversityHeatmap = $derived(
		buildResearchSectionUniversityHeatmap($projects, $allCollections)
	);

	// Sneak-peek of featured collections for the overview. Capped at 4 so
	// the compact grid fills on desktop without becoming a second /collections
	// page — the "See all" link takes users to the full index.
	let collectionCards = $derived(buildCollectionCards($allCollections, 3).slice(0, 4));

	// Calculate unique projects from filtered collections
	let uniqueProjects = $derived.by(() => {
		const projectIds = new SvelteSet<string>();
		$filteredCollections.forEach((item) => {
			if (item.project?.id) projectIds.add(item.project.id);
		});
		return projectIds.size;
	});

	// Calculate unique contributors
	let uniqueContributors = $derived.by(() => {
		const contributors = new SvelteSet<string>();
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
		const inst = new SvelteSet<string>();
		$filteredCollections.forEach((item) => {
			if (Array.isArray(item.name)) {
				item.name.forEach((entry) => {
					if (entry.name?.qualifier === 'institution' && entry.name?.label)
						inst.add(entry.name.label);
					if (Array.isArray(entry.affl))
						entry.affl.forEach((a) => {
							if (a) inst.add(a);
						});
				});
			}
		});
		return inst.size;
	});

	// Calculate unique locations and countries from filtered collection items
	let locationStats = $derived.by(() => {
		const countries = new SvelteSet<string>();
		const locations = new SvelteSet<string>();
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
		const langs = new SvelteSet<string>();
		$filteredCollections.forEach((item) => {
			item.language?.forEach((l) => {
				if (l) langs.add(normalizeLanguageCode(l));
			});
		});
		return langs.size;
	});

	// Calculate unique subjects & tags from filtered collection items
	let uniqueSubjectsAndTags = $derived.by(() => {
		const terms = new SvelteSet<string>();
		$filteredCollections.forEach((item) => {
			item.subject?.forEach((s) => {
				const label = s.authLabel || s.origLabel;
				if (label) terms.add(label);
			});
			item.tags?.forEach((t) => {
				if (t) terms.add(t);
			});
		});
		return terms.size;
	});

	// Calculate unique resource types from filtered collection items
	let uniqueResourceTypes = $derived.by(() => {
		const types = new SvelteSet<string>();
		$filteredCollections.forEach((item) => {
			if (item.typeOfResource) types.add(item.typeOfResource);
		});
		return types.size;
	});

	// Cluster publications count from the lazy-loaded ERef + EPub payload.
	// Falls back to 0 until the JSON resolves (typically <100 ms after onMount).
	let publicationCount = $derived($publications?.publications.length ?? 0);
</script>

<SEO
	title="Overview"
	description="Research data and publications from the Africa Multiple Cluster of Excellence and its Africa Multiple Research Centres (AMRCs) — an international research consortium at the University of Bayreuth linking partner centres across Africa, Brazil, and Germany. Browse projects, people, institutions, research items, cluster publications, and visualisations."
	keywords={[
		'overview',
		'research dashboard',
		'cluster of excellence',
		'African studies',
		'research projects',
		'cluster publications',
		'bibliography',
		'ERef Bayreuth',
		'EPub Bayreuth',
		'EXC 2052',
		'data visualization',
		'University of Bayreuth',
		'Africa Multiple Research Centres'
	]}
	structuredData={{
		'@context': 'https://schema.org',
		'@type': 'Dataset',
		name: 'Africa Multiple Interactive Research Atlas',
		description:
			'Aggregated research metadata and cluster publications from the Africa Multiple Cluster of Excellence and its partner research centres in Africa, Brazil, and Germany.',
		creator: {
			'@type': 'Organization',
			name: 'Africa Multiple Cluster of Excellence',
			url: 'https://www.africamultiple.uni-bayreuth.de/'
		},
		license: 'https://creativecommons.org/licenses/by/4.0/',
		isAccessibleForFree: true,
		spatialCoverage: ['Africa', 'Brazil', 'Germany']
	}}
/>

<div class="space-y-8">
	<!-- Page Header -->
	<div class="page-header animate-slide-in-up">
		<h1 class="page-title">Overview</h1>
		<p class="page-subtitle">
			The Africa Multiple Interactive Research Atlas (AMIRA) lets you browse and visualize research
			metadata and publications from the
			<a
				href="https://www.africamultiple.uni-bayreuth.de/en/index.html"
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-0.5 underline underline-offset-2 decoration-primary/40 hover:decoration-primary font-medium"
				>Africa Multiple Cluster of Excellence<ExternalLink class="inline size-3" /></a
			>
			and its
			<a
				href="https://www.africamultiple.uni-bayreuth.de/en/1_1-About-Us/african-cluster-centres/index.html"
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-0.5 underline underline-offset-2 decoration-primary/40 hover:decoration-primary font-medium"
				>Africa Multiple Research Centres (AMRCs)<ExternalLink class="inline size-3" /></a
			>
			— an international research consortium at the University of Bayreuth linking partner centres across
			Africa, Brazil, and Germany to reconfigure African Studies.
		</p>
	</div>

	<!-- Stats Cards. 9 cards: a 3-column grid on lg+ keeps the layout balanced
	     (3×3) without leaving an orphan card on a third row. -->
	<div class="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-3">
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
		<StatCard
			value={publicationCount}
			label="Cluster Publications"
			icon={Library}
			iconBgClass="bg-chart-2/10"
			animationDelay="275ms"
		/>
	</div>

	<!-- Cluster geography: University of Bayreuth (lead), four AMRCs, the
	     privileged partner (UFBA's CEAO), plus cooperation partners and
	     global partner Centers of African Studies. -->
	<ChartCard
		title="Africa Multiple Research Centres (AMRCs) and its partners"
		contentHeight="h-chart-xl"
	>
		<div class="flex h-full flex-col gap-3">
			<MiniMap
				markers={visibleClusterLocations}
				zoom={2}
				class="flex-1 min-h-0"
				fitOnUpdate={false}
			/>
			<div
				class="shrink-0 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground"
			>
				<button
					type="button"
					class="legend-toggle"
					class:legend-off={!visibleCategories.has('amrc')}
					aria-pressed={visibleCategories.has('amrc')}
					onclick={() => toggleCategory('amrc')}
				>
					<span class="inline-block w-3.5 h-3.5 rounded-full bg-background border border-border"
					></span>
					<span>AMRCs &amp; privileged partner (logos)</span>
				</button>
				<button
					type="button"
					class="legend-toggle"
					class:legend-off={!visibleCategories.has('cooperation')}
					aria-pressed={visibleCategories.has('cooperation')}
					onclick={() => toggleCategory('cooperation')}
				>
					<span
						class="inline-block w-3.5 h-3.5 rounded-full"
						style="background-color: {PARTNER_COLORS.cooperation};"
					></span>
					<span>{PARTNER_LEGEND_LABELS.cooperation}</span>
				</button>
				<button
					type="button"
					class="legend-toggle"
					class:legend-off={!visibleCategories.has('global')}
					aria-pressed={visibleCategories.has('global')}
					onclick={() => toggleCategory('global')}
				>
					<span
						class="inline-block w-3.5 h-3.5 rounded-full"
						style="background-color: {PARTNER_COLORS.global};"
					></span>
					<span>{PARTNER_LEGEND_LABELS.global}</span>
				</button>
			</div>
		</div>
	</ChartCard>

	<!-- Research Sections (project-level, unfiltered) -->
	<div class="grid gap-6 lg:grid-cols-2">
		<ChartCard title="Research Sections" class="col-span-full">
			{#if researchSectionsData.length > 0}
				<BarChart data={researchSectionsData} maxItems={10} />
			{:else}
				<EmptyState icon={BookOpen} />
			{/if}
		</ChartCard>

		<ChartCard
			title="Research Section × University"
			subtitle="Research items by research section and university"
			contentHeight="h-chart-md"
			class="col-span-full"
		>
			{#if sectionUniversityHeatmap.length > 0}
				<HeatmapChart data={sectionUniversityHeatmap} />
			{:else}
				<EmptyState message="Not enough data for heatmap" />
			{/if}
		</ChartCard>
	</div>

	{#if collectionCards.length > 0}
		<section class="pt-8 mt-4 border-t border-border/60 space-y-6">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div class="flex items-start gap-3 min-w-0">
					<div class="shrink-0 p-2 rounded-lg bg-primary/10 text-primary">
						<Images class="h-5 w-5" />
					</div>
					<div class="min-w-0">
						<h2 class="font-display text-2xl font-semibold tracking-tight text-foreground">
							Collections
						</h2>
						<p class="text-sm text-muted-foreground mt-0.5">
							Browse curated collections — photos, texts, audio and video — by masonry, map or
							timeline.
						</p>
					</div>
				</div>
				<a
					href="{base}/collections"
					class="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
				>
					See all <ArrowRight class="h-4 w-4" />
				</a>
			</div>

			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{#each collectionCards as card, index (card.meta.slug)}
					<CollectionIndexCard
						meta={card.meta}
						itemCount={card.itemCount}
						photoCount={card.photoCount}
						coverUrls={card.coverUrls}
						revealDelay={index * 80}
						compact
					/>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Section heading: shifts focus from cluster-level stats to the filterable
	     research-items explorer below. -->
	<div class="pt-8 mt-4 border-t border-border/60">
		<div class="flex items-start gap-3">
			<div class="shrink-0 p-2 rounded-lg bg-primary/10 text-primary">
				<SlidersHorizontal class="h-5 w-5" />
			</div>
			<div class="min-w-0">
				<h2 class="font-display text-2xl font-semibold tracking-tight text-foreground">
					Research Items Explorer
				</h2>
				<p class="text-sm text-muted-foreground mt-0.5">
					Apply filters to refine the charts and timelines below.
				</p>
			</div>
		</div>
	</div>

	<!-- Filters -->
	<div class="animate-slide-in-up delay-300">
		<FilterPanel />
	</div>

	<!-- Filtered Charts Grid -->
	<div class="grid gap-6 lg:grid-cols-2">
		<ChartCard
			title="Research Items Timeline by Type"
			contentHeight="h-chart-lg"
			class="col-span-full"
		>
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

		<ChartCard title="Tags & Subjects" contentHeight="h-chart-xl" class="col-span-full">
			{#snippet headerExtra()}
				<div class="flex items-center gap-4">
					<label
						for="home-wordcloud-slider"
						class="text-sm text-muted-foreground whitespace-nowrap"
					>
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

<style>
	.legend-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
		color: hsl(var(--muted-foreground));
		cursor: pointer;
		transition:
			opacity 150ms ease,
			color 150ms ease;
	}
	.legend-toggle:hover {
		color: hsl(var(--foreground));
	}
	.legend-toggle:focus-visible {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
	.legend-toggle.legend-off {
		opacity: 0.4;
	}
	.legend-toggle.legend-off span:last-child {
		text-decoration: line-through;
	}
</style>
