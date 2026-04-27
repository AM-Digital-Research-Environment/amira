<script lang="ts">
	import {
		ChartCard,
		EmptyState,
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		Select,
		Combobox,
		Badge,
		SEO
	} from '$lib/components/ui';
	import { StackedTimeline, BarChart, PieChart, RadarChart } from '$lib/components/charts';
	import { extractItemYear } from '$lib/utils/transforms/dates';
	import { allCollections, ensureCollections } from '$lib/stores/data';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import {
		groupByYearAndType,
		extractSubjects,
		extractResourceTypes,
		extractLanguages
	} from '$lib/utils/dataTransform';
	import {
		UNIVERSITY_COLLECTIONS,
		getUniversities,
		EXTERNAL_SOURCE_ID
	} from '$lib/utils/dataLoader';
	import { EXTERNAL_PROJECTS } from '$lib/utils/external';
	import type { CollectionItem } from '$lib/types';
	import { universityOptions } from '$lib/types';
	import { FileQuestion } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';

	const compareUniversityOptions = [
		...universityOptions,
		{ value: EXTERNAL_SOURCE_ID, label: 'External' }
	];

	// Get all universities
	const allUniversities = getUniversities();

	// Build a lookup of project ID → full project name from collection items.
	// Seed with the virtual external projects so selectors label them
	// correctly even before any items have been loaded.
	let projectNameMap = $derived.by(() => {
		const map = new SvelteMap<string, string>();
		EXTERNAL_PROJECTS.forEach((p) => map.set(p.id, p.name));
		$allCollections.forEach((item) => {
			if (item.project?.id && item.project?.name && !map.has(item.project.id)) {
				map.set(item.project.id, item.project.name);
			}
		});
		return map;
	});

	function trimLabel(text: string, max = 60): string {
		return text.length > max ? text.slice(0, max - 1) + '\u2026' : text;
	}

	// Build project options for a given university. The `value` encodes
	// `<universityId>:<projectId>` so downstream filtering can match on the
	// exact project id rather than a fragile substring.
	function getProjectOptions(universityId: string, nameMap: Map<string, string>) {
		const buildOption = (uniId: string, proj: string) => {
			const fullName = nameMap.get(proj) || proj;
			return {
				value: `${uniId}:${proj}`,
				label: trimLabel(fullName),
				title: fullName
			};
		};

		let projectList: { value: string; label: string; title?: string }[];

		if (universityId === 'all') {
			projectList = [
				...allUniversities.flatMap((uni) =>
					(UNIVERSITY_COLLECTIONS[uni.id] || []).map((proj) => buildOption(uni.id, proj))
				),
				...EXTERNAL_PROJECTS.map((p) => buildOption(EXTERNAL_SOURCE_ID, p.id))
			];
		} else if (universityId === EXTERNAL_SOURCE_ID) {
			projectList = EXTERNAL_PROJECTS.map((p) => buildOption(EXTERNAL_SOURCE_ID, p.id));
		} else {
			projectList = (UNIVERSITY_COLLECTIONS[universityId] || []).map((proj) =>
				buildOption(universityId, proj)
			);
		}

		projectList.sort((a, b) => a.label.localeCompare(b.label));

		return [{ value: 'all', label: 'All Projects' }, ...projectList];
	}

	// Left side selection
	let leftUniversity = $state('all');
	let leftProject = $state('all');
	let leftProjectOptions = $derived(getProjectOptions(leftUniversity, projectNameMap));

	// Right side selection
	let rightUniversity = $state(allUniversities[0]?.id || 'all');
	let rightProject = $state('all');
	let rightProjectOptions = $derived(getProjectOptions(rightUniversity, projectNameMap));

	// Track previous values to reset project when university changes
	let prevLeftUniversity = $state('all');
	let prevRightUniversity = $state(allUniversities[0]?.id || 'all');

	$effect(() => {
		if (leftUniversity !== prevLeftUniversity) {
			prevLeftUniversity = leftUniversity;
			leftProject = 'all';
		}
	});

	$effect(() => {
		if (rightUniversity !== prevRightUniversity) {
			prevRightUniversity = rightUniversity;
			rightProject = 'all';
		}
	});

	// Get collections based on selection
	function getCollection(universityId: string, projectId: string): CollectionItem[] {
		let result = $allCollections;

		// Filter by university if not "all"
		if (universityId !== 'all') {
			result = result.filter((item) => item.university === universityId);
		}

		// Filter by project if not "all". The encoded value is
		// "<universityId>:<projectId>" — match exactly on project.id so the
		// Ext_* projects don't false-match other collections.
		if (projectId !== 'all') {
			const [, projKey] = projectId.split(':');
			if (projKey) {
				result = result.filter((item) => item.project?.id === projKey);
			}
		}

		return result;
	}

	let leftData = $derived(getCollection(leftUniversity, leftProject));
	let rightData = $derived(getCollection(rightUniversity, rightProject));

	// Derived chart data for left
	let leftTimeline = $derived(groupByYearAndType(leftData));
	let leftSubjects = $derived(extractSubjects(leftData));
	let leftResourceTypes = $derived(extractResourceTypes(leftData));
	let leftLanguages = $derived(extractLanguages(leftData));

	// Derived chart data for right
	let rightTimeline = $derived(groupByYearAndType(rightData));
	let rightSubjects = $derived(extractSubjects(rightData));
	let rightResourceTypes = $derived(extractResourceTypes(rightData));
	let rightLanguages = $derived(extractLanguages(rightData));

	// Profile metrics for the radar overlay. Each side becomes a 6-axis
	// polygon: items, unique subjects, unique languages, unique resource
	// types, year span, unique contributors. Year span is `max - min + 1`
	// so a one-year project still registers as 1 (not 0).
	function profileFor(items: CollectionItem[]) {
		// Sets are rebuilt fresh on every $derived recompute, never mutated
		// in place — no need for SvelteSet here.
		/* eslint-disable svelte/prefer-svelte-reactivity */
		const subjects = new Set<string>();
		const languages = new Set<string>();
		const types = new Set<string>();
		const contributors = new Set<string>();
		/* eslint-enable svelte/prefer-svelte-reactivity */
		let minYear = Infinity;
		let maxYear = -Infinity;

		for (const item of items) {
			(item.subject || []).forEach((s) => {
				const label = s?.authLabel || s?.origLabel;
				if (label) subjects.add(label);
			});
			(item.language || []).forEach((code) => {
				if (code) languages.add(code);
			});
			if (item.typeOfResource) types.add(item.typeOfResource);
			(item.name || []).forEach((entry) => {
				const lbl = entry?.name?.label;
				if (lbl) contributors.add(lbl);
			});
			const y = extractItemYear(item);
			if (y != null) {
				if (y < minYear) minYear = y;
				if (y > maxYear) maxYear = y;
			}
		}

		const yearSpan = isFinite(minYear) && isFinite(maxYear) ? maxYear - minYear + 1 : 0;
		return {
			items: items.length,
			subjects: subjects.size,
			languages: languages.size,
			types: types.size,
			yearSpan,
			contributors: contributors.size
		};
	}

	let leftProfile = $derived(profileFor(leftData));
	let rightProfile = $derived(profileFor(rightData));

	// Take the per-axis max across both sides so the polygon scales honestly
	// — otherwise a side with the smaller value would always look the same
	// shape regardless of magnitude.
	let radarIndicator = $derived([
		{ name: 'Items', max: Math.max(leftProfile.items, rightProfile.items, 1) },
		{ name: 'Subjects', max: Math.max(leftProfile.subjects, rightProfile.subjects, 1) },
		{ name: 'Languages', max: Math.max(leftProfile.languages, rightProfile.languages, 1) },
		{ name: 'Types', max: Math.max(leftProfile.types, rightProfile.types, 1) },
		{ name: 'Year span', max: Math.max(leftProfile.yearSpan, rightProfile.yearSpan, 1) },
		{ name: 'Contributors', max: Math.max(leftProfile.contributors, rightProfile.contributors, 1) }
	]);

	let radarSeries = $derived([
		{
			name: getSelectionName(leftUniversity, leftProject),
			values: [
				leftProfile.items,
				leftProfile.subjects,
				leftProfile.languages,
				leftProfile.types,
				leftProfile.yearSpan,
				leftProfile.contributors
			]
		},
		{
			name: getSelectionName(rightUniversity, rightProject),
			values: [
				rightProfile.items,
				rightProfile.subjects,
				rightProfile.languages,
				rightProfile.types,
				rightProfile.yearSpan,
				rightProfile.contributors
			]
		}
	]);

	// Calculate subject overlap
	let subjectOverlap = $derived.by(() => {
		const leftSet = new Set(leftSubjects.map((s) => s.name));
		const rightSet = new Set(rightSubjects.map((s) => s.name));
		const intersection = new Set([...leftSet].filter((x) => rightSet.has(x)));
		const union = new Set([...leftSet, ...rightSet]);
		return {
			overlap: intersection.size,
			total: union.size,
			percentage: union.size > 0 ? Math.round((intersection.size / union.size) * 100) : 0,
			shared: Array.from(intersection).slice(0, 10)
		};
	});

	function getSelectionName(universityId: string, projectId: string): string {
		if (universityId === 'all' && projectId === 'all') {
			return 'All Projects';
		}

		const uni = allUniversities.find((u) => u.id === universityId);
		const uniName = uni?.name ?? (universityId === EXTERNAL_SOURCE_ID ? 'External' : 'All');

		if (projectId === 'all') {
			return uniName;
		}

		const [, projKey] = projectId.split(':');
		const fullName = projKey ? projectNameMap.get(projKey) : null;
		const externalMatch = projKey ? EXTERNAL_PROJECTS.find((p) => p.id === projKey) : null;
		return fullName || externalMatch?.name || projKey || projectId;
	}

	onMount(() => {
		void ensureCollections(base);
	});
</script>

<SEO
	title="Compare Projects"
	description="Side-by-side comparison of research metadata across universities and projects"
/>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="animate-slide-in-up">
		<h1 class="page-title">Compare Projects</h1>
		<p class="page-subtitle">
			Side-by-side comparison of research metadata across universities and projects
		</p>
	</div>

	<!-- Collection Selectors -->
	<div class="grid gap-4 md:grid-cols-2">
		<Card>
			{#snippet children()}
				<CardHeader class="pb-3">
					{#snippet children()}
						<CardTitle class="text-lg">
							{#snippet children()}Left Selection{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="space-y-3">
							<div>
								<span class="text-sm text-muted-foreground mb-1 block">University</span>
								<Select
									options={compareUniversityOptions}
									bind:value={leftUniversity}
									placeholder="Select university"
								/>
							</div>
							<div>
								<span class="text-sm text-muted-foreground mb-1 block">Project</span>
								<Combobox
									options={leftProjectOptions}
									bind:value={leftProject}
									placeholder="Search projects..."
								/>
							</div>
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>

		<Card>
			{#snippet children()}
				<CardHeader class="pb-3">
					{#snippet children()}
						<CardTitle class="text-lg">
							{#snippet children()}Right Selection{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="space-y-3">
							<div>
								<span class="text-sm text-muted-foreground mb-1 block">University</span>
								<Select
									options={compareUniversityOptions}
									bind:value={rightUniversity}
									placeholder="Select university"
								/>
							</div>
							<div>
								<span class="text-sm text-muted-foreground mb-1 block">Project</span>
								<Combobox
									options={rightProjectOptions}
									bind:value={rightProject}
									placeholder="Search projects..."
								/>
							</div>
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>
	</div>

	<!-- Stats Comparison -->
	<div class="grid gap-4 md:grid-cols-3">
		<Card>
			{#snippet children()}
				<CardContent class="pt-6">
					{#snippet children()}
						<div class="text-center">
							<p class="text-sm text-muted-foreground mb-2">Total Items</p>
							<div class="flex items-center justify-center gap-4">
								<div>
									<div class="text-2xl font-bold text-chart-1">{leftData.length}</div>
									<p class="text-xs text-muted-foreground max-w-[120px] truncate">
										{getSelectionName(leftUniversity, leftProject)}
									</p>
								</div>
								<span class="text-muted-foreground">vs</span>
								<div>
									<div class="text-2xl font-bold text-chart-2">{rightData.length}</div>
									<p class="text-xs text-muted-foreground max-w-[120px] truncate">
										{getSelectionName(rightUniversity, rightProject)}
									</p>
								</div>
							</div>
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>

		<Card>
			{#snippet children()}
				<CardContent class="pt-6">
					{#snippet children()}
						<div class="text-center">
							<p class="text-sm text-muted-foreground mb-2">Resource Types</p>
							<div class="flex items-center justify-center gap-4">
								<div>
									<div class="text-2xl font-bold text-chart-1">{leftResourceTypes.length}</div>
									<p class="text-xs text-muted-foreground max-w-[120px] truncate">
										{getSelectionName(leftUniversity, leftProject)}
									</p>
								</div>
								<span class="text-muted-foreground">vs</span>
								<div>
									<div class="text-2xl font-bold text-chart-2">{rightResourceTypes.length}</div>
									<p class="text-xs text-muted-foreground max-w-[120px] truncate">
										{getSelectionName(rightUniversity, rightProject)}
									</p>
								</div>
							</div>
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>

		<Card>
			{#snippet children()}
				<CardContent class="pt-6">
					{#snippet children()}
						<div class="text-center">
							<p class="text-sm text-muted-foreground mb-2">Subject Overlap</p>
							<div class="text-3xl font-bold text-primary">{subjectOverlap.percentage}%</div>
							<p class="text-xs text-muted-foreground">
								{subjectOverlap.overlap} shared of {subjectOverlap.total} total
							</p>
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>
	</div>

	<!-- Profile radar — overlays both selections on a 6-axis polygon
		 (items, subjects, languages, resource types, year span, contributors).
		 Per-axis max is the larger of the two so shapes are comparable. -->
	{#if leftData.length > 0 || rightData.length > 0}
		<ChartCard
			title="Project profile"
			subtitle="Six-axis comparison: items, subjects, languages, types, year span, contributors"
			contentHeight="h-chart-xl"
		>
			<RadarChart indicator={radarIndicator} series={radarSeries} class="h-full w-full" />
		</ChartCard>
	{/if}

	<!-- Shared Subjects -->
	{#if subjectOverlap.shared.length > 0}
		<Card>
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle>
							{#snippet children()}Shared Subjects{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="flex flex-wrap gap-2">
							{#each subjectOverlap.shared as subject (subject)}
								<Badge variant="secondary">{subject}</Badge>
							{/each}
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>
	{/if}

	<!-- Timeline Comparison -->
	<div class="grid gap-6 lg:grid-cols-2">
		<ChartCard
			title="{getSelectionName(leftUniversity, leftProject)} Timeline"
			contentHeight="h-chart-md"
		>
			{#if leftTimeline.length > 0}
				<StackedTimeline data={leftTimeline} />
			{:else}
				<EmptyState message="No timeline data" icon={FileQuestion} />
			{/if}
		</ChartCard>

		<ChartCard
			title="{getSelectionName(rightUniversity, rightProject)} Timeline"
			contentHeight="h-chart-md"
		>
			{#if rightTimeline.length > 0}
				<StackedTimeline data={rightTimeline} />
			{:else}
				<EmptyState message="No timeline data" icon={FileQuestion} />
			{/if}
		</ChartCard>
	</div>

	<!-- Resource Types Comparison -->
	<div class="grid gap-6 lg:grid-cols-2">
		<ChartCard
			title="{getSelectionName(leftUniversity, leftProject)} Resource Types"
			contentHeight="h-chart-md"
		>
			{#if leftResourceTypes.length > 0}
				<PieChart data={leftResourceTypes} />
			{:else}
				<EmptyState message="No data" icon={FileQuestion} />
			{/if}
		</ChartCard>

		<ChartCard
			title="{getSelectionName(rightUniversity, rightProject)} Resource Types"
			contentHeight="h-chart-md"
		>
			{#if rightResourceTypes.length > 0}
				<PieChart data={rightResourceTypes} />
			{:else}
				<EmptyState message="No data" icon={FileQuestion} />
			{/if}
		</ChartCard>
	</div>

	<!-- Top Subjects Comparison -->
	<div class="grid gap-6 lg:grid-cols-2">
		<ChartCard
			title="{getSelectionName(leftUniversity, leftProject)} Top Subjects"
			contentHeight="h-chart-md"
		>
			{#if leftSubjects.length > 0}
				<BarChart data={leftSubjects} maxItems={8} />
			{:else}
				<EmptyState message="No data" icon={FileQuestion} />
			{/if}
		</ChartCard>

		<ChartCard
			title="{getSelectionName(rightUniversity, rightProject)} Top Subjects"
			contentHeight="h-chart-md"
		>
			{#if rightSubjects.length > 0}
				<BarChart data={rightSubjects} maxItems={8} />
			{:else}
				<EmptyState message="No data" icon={FileQuestion} />
			{/if}
		</ChartCard>
	</div>

	<!-- Languages Comparison -->
	<div class="grid gap-6 lg:grid-cols-2">
		<ChartCard
			title="{getSelectionName(leftUniversity, leftProject)} Languages"
			contentHeight="h-chart-sm"
		>
			{#if leftLanguages.length > 0}
				<BarChart data={leftLanguages} maxItems={6} />
			{:else}
				<EmptyState message="No data" icon={FileQuestion} />
			{/if}
		</ChartCard>

		<ChartCard
			title="{getSelectionName(rightUniversity, rightProject)} Languages"
			contentHeight="h-chart-sm"
		>
			{#if rightLanguages.length > 0}
				<BarChart data={rightLanguages} maxItems={6} />
			{:else}
				<EmptyState message="No data" icon={FileQuestion} />
			{/if}
		</ChartCard>
	</div>
</div>
