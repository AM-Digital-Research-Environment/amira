<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import {
		StatCard,
		ChartCard,
		EmptyState,
		Pagination,
		Input,
		Combobox,
		Button,
		SEO
	} from '$lib/components/ui';
	import { StackedTimeline, PieChart, WordCloud } from '$lib/components/charts';
	import type { StackedTimelineDataPoint } from '$lib/utils/transforms';
	import { languageName } from '$lib/utils/languages';
	import { publications, ensurePublications } from '$lib/stores/data';
	import {
		PublicationCard,
		applyPublicationFilters,
		buildFacetOptions,
		downloadBibtexBulk,
		downloadRisBulk,
		hasActiveFilters,
		publicationTypeLabel
	} from '$lib/components/publications';
	import { paginate } from '$lib/utils/pagination';
	import {
		Library,
		Layers,
		Languages as LanguagesIcon,
		Users,
		Download,
		Search,
		ExternalLink,
		Inbox
	} from '@lucide/svelte';
	import type { Publication, PieChartDataPoint, WordCloudDataPoint } from '$lib/types';
	import { SvelteMap } from 'svelte/reactivity';

	onMount(() => {
		void ensurePublications(base);
	});

	let searchQuery = $state('');
	let selectedType = $state('all');
	let selectedYear = $state('all');
	let selectedLanguage = $state('all');
	let selectedKeyword = $state('');
	let listPage = $state(0);
	const listPerPage = 15;

	let payload = $derived($publications);
	let allPubs = $derived<Publication[]>(payload?.publications ?? []);

	let typeOptions = $derived([
		{ value: 'all', label: `All types (${allPubs.length})` },
		...buildFacetOptions(allPubs, {
			getKey: (p) => p.type,
			formatLabel: (type, count) => `${publicationTypeLabel(type)} (${count})`
		})
	]);

	let yearOptions = $derived([
		{ value: 'all', label: 'All years' },
		...buildFacetOptions(allPubs, {
			getKey: (p) => p.year,
			formatLabel: (year, count) => `${year} (${count})`,
			sort: 'key-desc'
		})
	]);

	// Language facet — sourced from the EP3 ``<language>`` field. Codes are
	// ISO 639-2/B; ``languageName`` resolves them (and the B/T variants)
	// to the English name. Records without a language tag fall outside
	// every selectable choice and stay visible only under "All languages".
	let languageOptions = $derived([
		{ value: 'all', label: 'All languages' },
		...buildFacetOptions(allPubs, {
			getKey: (p) => p.language,
			formatLabel: (code, count) => `${languageName(code)} (${count})`
		})
	]);

	let languageChartData = $derived.by<PieChartDataPoint[]>(() => {
		const counts = new SvelteMap<string, number>();
		for (const p of allPubs) {
			if (p.language) counts.set(p.language, (counts.get(p.language) ?? 0) + 1);
		}
		return Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([code, count]) => ({ name: languageName(code), value: count }));
	});

	// Stacked breakdown of publications per year by type. Bar order (bottom →
	// top) follows overall frequency so the dominant types anchor the stack
	// and minor categories sit on top, mirroring the legend ordering.
	let yearTypeOrder = $derived.by<string[]>(() => {
		const totals = new SvelteMap<string, number>();
		for (const p of allPubs) totals.set(p.type, (totals.get(p.type) ?? 0) + 1);
		return Array.from(totals.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([type]) => type);
	});

	let yearChartData = $derived.by<StackedTimelineDataPoint[]>(() => {
		const buckets = new SvelteMap<number, Record<string, number>>();
		for (const p of allPubs) {
			if (!p.year) continue;
			let bucket = buckets.get(p.year);
			if (!bucket) {
				bucket = {};
				buckets.set(p.year, bucket);
			}
			bucket[p.type] = (bucket[p.type] ?? 0) + 1;
		}
		return Array.from(buckets.entries())
			.sort((a, b) => a[0] - b[0])
			.map(([year, byType]) => ({
				year,
				total: Object.values(byType).reduce((s, n) => s + n, 0),
				byType
			}));
	});

	// Aggregate keyword frequencies across the full dataset for the
	// wordcloud. We lowercase to merge case variants ("African studies" vs
	// "African Studies") and surface a "raw" map so click-to-filter can
	// recover the original casing.
	let keywordRaw = $derived.by(() => {
		const counts = new SvelteMap<string, number>();
		const display = new SvelteMap<string, string>();
		for (const p of allPubs) {
			for (const kw of p.keywords ?? []) {
				const key = kw.toLowerCase();
				counts.set(key, (counts.get(key) ?? 0) + 1);
				if (!display.has(key)) display.set(key, kw);
			}
		}
		return { counts, display };
	});

	let keywordCloudData = $derived.by<WordCloudDataPoint[]>(() => {
		return Array.from(keywordRaw.counts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 150)
			.map(([key, count]) => ({ name: keywordRaw.display.get(key) ?? key, value: count }));
	});

	let activeFilters = $derived({
		type: selectedType,
		year: selectedYear,
		language: selectedLanguage,
		keyword: selectedKeyword,
		searchQuery
	});
	let filtered = $derived(applyPublicationFilters(allPubs, activeFilters));

	let paginated = $derived(paginate(filtered, listPage, listPerPage));

	$effect(() => {
		searchQuery;
		selectedType;
		selectedYear;
		selectedLanguage;
		selectedKeyword;
		listPage = 0;
	});

	let matchedContributors = $derived(payload?.stats.matched_contributors ?? 0);
	let totalContributors = $derived(payload?.stats.total_contributors ?? 0);

	let hasFilters = $derived(hasActiveFilters(activeFilters));

	function clearFilters() {
		searchQuery = '';
		selectedType = 'all';
		selectedYear = 'all';
		selectedLanguage = 'all';
		selectedKeyword = '';
	}

	function selectKeyword(name: string) {
		// Toggle: if clicked twice, clear; otherwise set as the active filter.
		selectedKeyword = selectedKeyword.toLowerCase() === name.toLowerCase() ? '' : name;
	}

	let publicationTypeCount = $derived(new Set(allPubs.map((p) => p.type)).size);
	let languageCount = $derived(
		new Set(allPubs.map((p) => p.language).filter((l): l is string => Boolean(l))).size
	);
</script>

<SEO
	title="Publications"
	description="Cluster publications fetched from ERef Bayreuth — articles, books, chapters, and conference papers from the Africa Multiple Cluster of Excellence (EXC 2052)."
	keywords={[
		'publications',
		'ERef',
		'Bayreuth',
		'Africa Multiple',
		'EXC 2052',
		'bibliography',
		'BibTeX',
		'Zotero'
	]}
/>

<div class="space-y-8 animate-slide-in-up">
	<!-- Header -->
	<div>
		<h1 class="page-title">Publications</h1>
		<p class="page-subtitle">
			Cluster publications synced from
			<a
				href="https://eref.uni-bayreuth.de/view/projekt/EXC_2052=3A_Africa_Multiple=3A_Reconfiguring_African_Studies.html"
				target="_blank"
				rel="noopener"
				class="underline-offset-4 hover:underline">ERef Bayreuth</a
			>
			and
			<a
				href="https://epub.uni-bayreuth.de/view/divisions/340050.html"
				target="_blank"
				rel="noopener"
				class="underline-offset-4 hover:underline">EPub Bayreuth</a
			>
			(EXC 2052 / Africa Multiple), deduplicated across the two repositories.
		</p>
	</div>

	{#if !payload}
		<EmptyState
			message="Publications dataset not available. Run scripts/fetch_publications.py to generate it."
			icon={Inbox}
			class="h-64"
		/>
	{:else if allPubs.length === 0}
		<EmptyState message="No publications found in the dataset." icon={Inbox} class="h-64" />
	{:else}
		<!-- Stats -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<StatCard label="Total Publications" value={allPubs.length} icon={Library} />
			<StatCard
				label="Publication Types"
				value={publicationTypeCount}
				icon={Layers}
				subtitle="distinct categories"
			/>
			<StatCard
				label="Languages"
				value={languageCount}
				icon={LanguagesIcon}
				subtitle="distinct languages"
			/>
			<StatCard
				label="Matched Authors"
				value={`${matchedContributors}/${totalContributors}`}
				icon={Users}
				subtitle="linked to person profiles"
			/>
		</div>

		<!-- Charts row 1: per-year bar + language pie. -->
		<div class="grid gap-6 lg:grid-cols-2">
			{#if yearChartData.length > 1}
				<ChartCard
					title="Publications per year"
					subtitle="Stacked by publication type"
					contentHeight="h-chart-md"
				>
					<StackedTimeline
						data={yearChartData}
						typeOrder={yearTypeOrder}
						typeLabel={publicationTypeLabel}
					/>
				</ChartCard>
			{/if}
			{#if languageChartData.length > 0}
				<ChartCard title="Publications by language" contentHeight="h-chart-md">
					<PieChart data={languageChartData} />
				</ChartCard>
			{/if}
		</div>

		<!-- Charts row 2: keyword cloud, full width so the long tail of
		     terms gets the room it needs to breathe. -->
		{#if keywordCloudData.length > 0}
			<ChartCard
				title="Keyword cloud"
				subtitle="Click a keyword to filter the list"
				contentHeight="h-chart-lg"
			>
				<WordCloud data={keywordCloudData} maxWords={200} onclick={selectKeyword} />
			</ChartCard>
		{/if}

		<!-- Filters + bulk export -->
		<div
			class="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4 p-4 rounded-xl border border-border bg-card/50"
		>
			<div class="relative flex-1 min-w-0">
				<Search
					class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
				/>
				<Input
					bind:value={searchQuery}
					placeholder="Search title, author, journal, DOI, keyword…"
					class="pl-9"
					aria-label="Search publications"
				/>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<Combobox
					bind:value={selectedType}
					options={typeOptions}
					placeholder="Type"
					class="w-44"
					aria-label="Filter by publication type"
				/>
				<Combobox
					bind:value={selectedYear}
					options={yearOptions}
					placeholder="Year"
					class="w-32"
					aria-label="Filter by year"
				/>
				<Combobox
					bind:value={selectedLanguage}
					options={languageOptions}
					placeholder="Language"
					class="w-44"
					aria-label="Filter by language"
				/>
				{#if selectedKeyword}
					<button
						type="button"
						onclick={() => (selectedKeyword = '')}
						class="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs px-2.5 py-1 hover:bg-primary/15 transition-colors"
						title="Remove keyword filter"
					>
						<span>#{selectedKeyword}</span>
						<span aria-hidden="true">×</span>
					</button>
				{/if}
				{#if hasFilters}
					<Button variant="ghost" size="sm" onclick={clearFilters}>Clear</Button>
				{/if}
			</div>
		</div>

		<!-- Bulk export controls -->
		<div class="flex flex-wrap items-center gap-2 text-sm">
			<span class="text-muted-foreground">
				{filtered.length} of {allPubs.length} publications
				{#if hasFilters}match your filters{/if}
			</span>
			<span class="ml-auto inline-flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={() => downloadBibtexBulk(filtered)}
					disabled={filtered.length === 0}
				>
					<Download class="h-3.5 w-3.5" />
					BibTeX ({filtered.length})
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={() => downloadRisBulk(filtered)}
					disabled={filtered.length === 0}
				>
					<Download class="h-3.5 w-3.5" />
					RIS ({filtered.length})
				</Button>
				{#each payload.sources as src (src.name)}
					<a
						href={src.bibtex_url}
						target="_blank"
						rel="noopener"
						class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
						title="Open the upstream BibTeX export at {src.label}"
					>
						<ExternalLink class="h-3 w-3" />
						{src.label}
					</a>
				{/each}
			</span>
		</div>

		<!-- List -->
		{#if filtered.length === 0}
			<EmptyState
				message="No publications match these filters."
				icon={Inbox}
				class="h-48 rounded-xl border border-border bg-card/50"
			/>
		{:else}
			<div class="grid gap-4">
				{#each paginated as pub (pub.id)}
					<PublicationCard publication={pub} onKeywordClick={selectKeyword} />
				{/each}
			</div>
			<Pagination
				currentPage={listPage}
				totalItems={filtered.length}
				itemsPerPage={listPerPage}
				onPageChange={(p) => (listPage = p)}
			/>
		{/if}
	{/if}
</div>
