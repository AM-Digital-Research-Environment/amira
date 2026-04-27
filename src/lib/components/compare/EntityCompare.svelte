<script lang="ts">
	/**
	 * Side-by-side compare of two entity selections (people, institutions,
	 * subjects, languages, genres). Driven by the precomputed JSON dumps
	 * under `static/data/entity_dashboards/<type>/<id>.json`; entity options
	 * come from `entity_dashboards/manifest.json`.
	 */
	import { onMount } from 'svelte';
	import { Card, CardHeader, CardTitle, CardContent, Combobox, SEO } from '$lib/components/ui';
	import { StackedTimeline, BarChart, PieChart } from '$lib/components/charts';
	import {
		CompareStatRow,
		CompareSharedSubjects,
		CompareProfileRadar,
		ComparePair,
		computeSubjectOverlap,
		type Profile,
		type NamedValue
	} from '$lib/components/compare';
	import {
		loadEntityDashboard,
		loadEntityDashboardManifest,
		type EntityDashboardManifest,
		type EntityDashboardManifestEntry
	} from '$lib/utils/loaders/entityDashboardLoader';
	import type { EntityDashboardData, EntityType } from '$lib/components/dashboards';
	import { Construction } from '@lucide/svelte';
	import { personUrl, institutionUrl, subjectUrl, languageUrl, genreUrl } from '$lib/utils/urls';
	import type { CompareType } from './compareTypes';

	interface Props {
		type: Exclude<CompareType, 'projects'>;
	}

	let { type }: Props = $props();

	// --------------------------------------------------------------------
	// Per-type configuration: maps compare type → manifest dir, entity-detail
	// URL helper, EntityType for loadEntityDashboard, and the UI strings.
	// --------------------------------------------------------------------
	type CompareConfig = {
		label: string;
		singular: string;
		manifestKey: keyof EntityDashboardManifest;
		entityType: EntityType;
		detailUrl: (id: string, name: string) => string;
		/** Whether the contributor pair makes sense (false for people). */
		showContributors: boolean;
		/** Title used for the subjects bar chart. */
		subjectsTitle: string;
	};

	const TYPE_CONFIG: Record<Exclude<CompareType, 'projects'>, CompareConfig> = {
		people: {
			label: 'People',
			singular: 'person',
			manifestKey: 'person',
			entityType: 'person',
			detailUrl: (_id, name) => personUrl(name),
			showContributors: false,
			subjectsTitle: 'Top subjects'
		},
		institutions: {
			label: 'Institutions',
			singular: 'institution',
			manifestKey: 'institution',
			entityType: 'institution',
			detailUrl: (_id, name) => institutionUrl(name),
			showContributors: true,
			subjectsTitle: 'Top subjects'
		},
		subjects: {
			label: 'Subjects',
			singular: 'subject',
			manifestKey: 'subject',
			entityType: 'subject',
			detailUrl: (_id, name) => subjectUrl(name),
			showContributors: true,
			subjectsTitle: 'Co-occurring subjects'
		},
		languages: {
			label: 'Languages',
			singular: 'language',
			manifestKey: 'language',
			entityType: 'language',
			detailUrl: (id) => languageUrl(id),
			showContributors: true,
			subjectsTitle: 'Top subjects'
		},
		genres: {
			label: 'Genres',
			singular: 'genre',
			manifestKey: 'genre',
			entityType: 'genre',
			detailUrl: (_id, name) => genreUrl(name),
			showContributors: true,
			subjectsTitle: 'Top subjects'
		}
	};

	const config = $derived(TYPE_CONFIG[type]);

	// --------------------------------------------------------------------
	// Manifest + per-side dashboard data.
	// --------------------------------------------------------------------
	let manifest = $state<EntityDashboardManifest | null>(null);
	let manifestLoading = $state(false);

	const entityOptions = $derived.by(() => {
		if (!manifest) return [];
		const entries = (manifest[config.manifestKey] ?? []) as EntityDashboardManifestEntry[];
		return entries.map((e) => ({
			value: e.id,
			label: `${e.name} (${e.count})`,
			title: e.name
		}));
	});

	let leftId = $state('');
	let rightId = $state('');
	let leftData = $state<EntityDashboardData | null>(null);
	let rightData = $state<EntityDashboardData | null>(null);
	let leftLoading = $state(false);
	let rightLoading = $state(false);

	$effect(() => {
		const requested = leftId;
		if (!requested) {
			leftData = null;
			return;
		}
		leftLoading = true;
		loadEntityDashboard(config.entityType, requested).then((d) => {
			if (requested === leftId) {
				leftData = d;
				leftLoading = false;
			}
		});
	});

	$effect(() => {
		const requested = rightId;
		if (!requested) {
			rightData = null;
			return;
		}
		rightLoading = true;
		loadEntityDashboard(config.entityType, requested).then((d) => {
			if (requested === rightId) {
				rightData = d;
				rightLoading = false;
			}
		});
	});

	// Reset selection when the type changes — IDs from one type are nonsense
	// in another.
	let prevType = $state<CompareType | undefined>(undefined);
	$effect(() => {
		if (prevType !== undefined && type !== prevType) {
			leftId = '';
			rightId = '';
			leftData = null;
			rightData = null;
		}
		prevType = type;
	});

	onMount(() => {
		manifestLoading = true;
		loadEntityDashboardManifest()
			.then((m) => {
				manifest = m;
			})
			.finally(() => {
				manifestLoading = false;
			});
	});

	// --------------------------------------------------------------------
	// Derived chart payloads. The precomputed JSON matches the shapes the
	// chart components expect, so we forward without transformation.
	// --------------------------------------------------------------------
	function asTypedArray<T>(v: unknown): T[] {
		return Array.isArray(v) ? (v as T[]) : [];
	}

	const leftStackedTimeline = $derived(
		asTypedArray<{ year: number; total: number; byType: Record<string, number> }>(
			leftData?.stackedTimeline
		)
	);
	const rightStackedTimeline = $derived(
		asTypedArray<{ year: number; total: number; byType: Record<string, number> }>(
			rightData?.stackedTimeline
		)
	);
	const leftTypes = $derived(asTypedArray<NamedValue>(leftData?.types));
	const rightTypes = $derived(asTypedArray<NamedValue>(rightData?.types));
	const leftLanguages = $derived(asTypedArray<NamedValue>(leftData?.languages));
	const rightLanguages = $derived(asTypedArray<NamedValue>(rightData?.languages));
	const leftSubjects = $derived(asTypedArray<NamedValue>(leftData?.subjects));
	const rightSubjects = $derived(asTypedArray<NamedValue>(rightData?.subjects));
	const leftContributors = $derived(asTypedArray<NamedValue>(leftData?.contributors));
	const rightContributors = $derived(asTypedArray<NamedValue>(rightData?.contributors));

	// --------------------------------------------------------------------
	// Profile metrics + radar overlay.
	// --------------------------------------------------------------------
	function profileFor(d: EntityDashboardData | null): Profile {
		const items = (d?.meta as { count?: number } | undefined)?.count ?? 0;
		const subjects = asTypedArray<NamedValue>(d?.subjects).length;
		const languages = asTypedArray<NamedValue>(d?.languages).length;
		const types = asTypedArray<NamedValue>(d?.types).length;
		const contributors = asTypedArray<NamedValue>(d?.contributors).length;
		const timeline = asTypedArray<{ year: number }>(d?.timeline);
		let yearSpan = 0;
		if (timeline.length > 0) {
			const years = timeline.map((t) => t.year).filter(Number.isFinite);
			if (years.length > 0) yearSpan = Math.max(...years) - Math.min(...years) + 1;
		}
		return { items, subjects, languages, types, contributors, yearSpan };
	}

	const leftProfile = $derived(profileFor(leftData));
	const rightProfile = $derived(profileFor(rightData));
	const overlap = $derived(computeSubjectOverlap(leftSubjects, rightSubjects, 12));

	function nameOf(d: EntityDashboardData | null, fallback: string): string {
		if (d?.meta && typeof (d.meta as { name?: string }).name === 'string') {
			return (d.meta as { name: string }).name;
		}
		return fallback;
	}

	const leftName = $derived(nameOf(leftData, 'Left'));
	const rightName = $derived(nameOf(rightData, 'Right'));

	const bothReady = $derived(!!leftData && !!rightData);
	const eitherSelected = $derived(!!leftId || !!rightId);

	// SEO meta — declared here so the route page doesn't have to repeat it.
	const seoTitle = $derived(`Compare ${config.label}`);
	const seoDescription = $derived(
		`Side-by-side comparison of two ${config.label.toLowerCase()}: items, subjects, languages, year span, and 6-axis profile radar.`
	);
</script>

<SEO title={seoTitle} description={seoDescription} />

<!-- Entity selectors. -->
<div class="grid gap-4 md:grid-cols-2">
	<Card>
		{#snippet children()}
			<CardHeader class="pb-3">
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}Left {config.singular}{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<Combobox
						options={entityOptions}
						bind:value={leftId}
						placeholder={manifestLoading ? 'Loading…' : `Search ${config.label.toLowerCase()}…`}
					/>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>

	<Card>
		{#snippet children()}
			<CardHeader class="pb-3">
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}Right {config.singular}{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<Combobox
						options={entityOptions}
						bind:value={rightId}
						placeholder={manifestLoading ? 'Loading…' : `Search ${config.label.toLowerCase()}…`}
					/>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
</div>

{#if !eitherSelected}
	<Card>
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="flex items-center gap-2">
						{#snippet children()}
							<Construction class="h-5 w-5 text-muted-foreground" />
							Pick two {config.label.toLowerCase()} to compare
						{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent class="space-y-3 text-sm text-muted-foreground">
				{#snippet children()}
					<p>
						Select a {config.singular} on each side. Stats, timelines, top subjects, languages, and a
						6-axis profile radar will appear once both sides are loaded.
					</p>
					{#if entityOptions.length > 0}
						<p>
							{entityOptions.length.toLocaleString()}
							{config.label.toLowerCase()} available — sorted by item count.
						</p>
					{/if}
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{:else if leftLoading || rightLoading}
	<Card>
		{#snippet children()}
			<CardContent class="py-12 text-center text-muted-foreground">
				{#snippet children()}
					Loading dashboard data…
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{:else if bothReady}
	<CompareStatRow
		{leftName}
		{rightName}
		leftItems={leftProfile.items}
		rightItems={rightProfile.items}
		middleLabel="Languages"
		leftMiddle={leftProfile.languages}
		rightMiddle={rightProfile.languages}
		middleCaption="unique"
		{overlap}
	/>

	<CompareProfileRadar
		title="{config.singular.charAt(0).toUpperCase() + config.singular.slice(1)} profile"
		{leftName}
		{leftProfile}
		{rightName}
		{rightProfile}
	/>

	<CompareSharedSubjects shared={overlap.shared} />

	<ComparePair
		leftTitle="{leftName} timeline"
		rightTitle="{rightName} timeline"
		leftData={leftStackedTimeline}
		rightData={rightStackedTimeline}
		emptyMessage="No timeline data"
	>
		{#snippet left(data)}
			<StackedTimeline {data} />
		{/snippet}
		{#snippet right(data)}
			<StackedTimeline {data} />
		{/snippet}
	</ComparePair>

	<ComparePair
		leftTitle="{leftName} resource types"
		rightTitle="{rightName} resource types"
		leftData={leftTypes}
		rightData={rightTypes}
	>
		{#snippet left(data)}
			<PieChart {data} />
		{/snippet}
		{#snippet right(data)}
			<PieChart {data} />
		{/snippet}
	</ComparePair>

	<ComparePair
		leftTitle="{leftName} {config.subjectsTitle.toLowerCase()}"
		rightTitle="{rightName} {config.subjectsTitle.toLowerCase()}"
		leftData={leftSubjects}
		rightData={rightSubjects}
	>
		{#snippet left(data)}
			<BarChart {data} maxItems={10} />
		{/snippet}
		{#snippet right(data)}
			<BarChart {data} maxItems={10} />
		{/snippet}
	</ComparePair>

	<ComparePair
		leftTitle="{leftName} languages"
		rightTitle="{rightName} languages"
		leftData={leftLanguages}
		rightData={rightLanguages}
		contentHeight="h-chart-sm"
	>
		{#snippet left(data)}
			<BarChart {data} maxItems={8} />
		{/snippet}
		{#snippet right(data)}
			<BarChart {data} maxItems={8} />
		{/snippet}
	</ComparePair>

	{#if config.showContributors}
		<ComparePair
			leftTitle="{leftName} contributors"
			rightTitle="{rightName} contributors"
			leftData={leftContributors}
			rightData={rightContributors}
		>
			{#snippet left(data)}
				<BarChart {data} maxItems={10} />
			{/snippet}
			{#snippet right(data)}
				<BarChart {data} maxItems={10} />
			{/snippet}
		</ComparePair>
	{/if}
{:else}
	<!-- Single side selected — coach the user to pick the other. -->
	<Card>
		{#snippet children()}
			<CardContent class="py-12 text-center text-muted-foreground">
				{#snippet children()}
					Pick a {config.singular} on the {leftId ? 'right' : 'left'} to start the comparison.
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}
