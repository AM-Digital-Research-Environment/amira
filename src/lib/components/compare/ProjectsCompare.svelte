<script lang="ts">
	/**
	 * Side-by-side compare of two project / university selections.
	 *
	 * Distinct from `EntityCompare` because the data flow is on-the-fly
	 * aggregation off `$allCollections`: users pick a `(university, project)`
	 * pair on each side and the page filters in-memory. We can't precompute
	 * a JSON for every (university × project) combination.
	 *
	 * Renders the shared compare primitives: stat row, profile radar,
	 * shared-subjects chips, and side-by-side timeline / types / subjects /
	 * languages pairs.
	 */
	import { Card, CardHeader, CardTitle, CardContent, Select, Combobox } from '$lib/components/ui';
	import { StackedTimeline, BarChart, PieChart } from '$lib/components/charts';
	import {
		CompareStatRow,
		CompareSharedSubjects,
		CompareProfileRadar,
		ComparePair,
		computeSubjectOverlap,
		type Profile
	} from '$lib/components/compare';
	import { extractItemYear } from '$lib/utils/transforms/dates';
	import { allCollections, ensureCollections } from '$lib/stores/data';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import {
		groupByYearAndType,
		extractSubjects,
		extractResourceTypes,
		extractLanguages
	} from '$lib/utils/transforms';
	import { UNIVERSITY_COLLECTIONS, getUniversities, EXTERNAL_SOURCE_ID } from '$lib/utils/loaders';
	import { getUniversityName } from '$lib/utils/entityResolver';
	import { EXTERNAL_PROJECTS } from '$lib/utils/external';
	import type { CollectionItem } from '$lib/types';
	import { universityOptions } from '$lib/types';
	import { SvelteMap } from 'svelte/reactivity';

	const compareUniversityOptions = [
		...universityOptions,
		{ value: EXTERNAL_SOURCE_ID, label: 'External' }
	];

	const allUniversities = getUniversities();

	// Build a lookup of project ID → full project name from collection items.
	// Seed with the virtual external projects so selectors label them correctly
	// even before any items have been loaded.
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
		return text.length > max ? text.slice(0, max - 1) + '…' : text;
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

	let leftUniversity = $state('all');
	let leftProject = $state('all');
	let leftProjectOptions = $derived(getProjectOptions(leftUniversity, projectNameMap));

	let rightUniversity = $state(allUniversities[0]?.id || 'all');
	let rightProject = $state('all');
	let rightProjectOptions = $derived(getProjectOptions(rightUniversity, projectNameMap));

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

	function getCollection(universityId: string, projectId: string): CollectionItem[] {
		let result = $allCollections;

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

	let leftItems = $derived(getCollection(leftUniversity, leftProject));
	let rightItems = $derived(getCollection(rightUniversity, rightProject));

	let leftTimeline = $derived(groupByYearAndType(leftItems));
	let leftSubjects = $derived(extractSubjects(leftItems));
	let leftResourceTypes = $derived(extractResourceTypes(leftItems));
	let leftLanguages = $derived(extractLanguages(leftItems));

	let rightTimeline = $derived(groupByYearAndType(rightItems));
	let rightSubjects = $derived(extractSubjects(rightItems));
	let rightResourceTypes = $derived(extractResourceTypes(rightItems));
	let rightLanguages = $derived(extractLanguages(rightItems));

	// Profile metrics for the radar overlay. Each side becomes a 6-axis
	// polygon: items, unique subjects, unique languages, unique resource
	// types, year span, unique contributors. Year span is `max - min + 1`
	// so a one-year project still registers as 1 (not 0).
	function profileFor(items: CollectionItem[]): Profile {
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

	let leftProfile = $derived(profileFor(leftItems));
	let rightProfile = $derived(profileFor(rightItems));
	let overlap = $derived(computeSubjectOverlap(leftSubjects, rightSubjects, 10));

	function getSelectionName(universityId: string, projectId: string): string {
		if (universityId === 'all' && projectId === 'all') return 'All Projects';

		// `getUniversityName` returns null for unknown ids (e.g. the
		// 'all' sentinel); the ?? 'All' fallback preserves the original
		// label.
		const uniName = getUniversityName(universityId) ?? 'All';

		if (projectId === 'all') return uniName;

		const [, projKey] = projectId.split(':');
		const fullName = projKey ? projectNameMap.get(projKey) : null;
		const externalMatch = projKey ? EXTERNAL_PROJECTS.find((p) => p.id === projKey) : null;
		return fullName || externalMatch?.name || projKey || projectId;
	}

	let leftName = $derived(getSelectionName(leftUniversity, leftProject));
	let rightName = $derived(getSelectionName(rightUniversity, rightProject));
	let bothEmpty = $derived(leftItems.length === 0 && rightItems.length === 0);

	onMount(() => {
		void ensureCollections(base);
	});
</script>

<!-- Selection cards: each side picks a (university, project) pair. -->
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

<CompareStatRow
	{leftName}
	{rightName}
	leftItems={leftProfile.items}
	rightItems={rightProfile.items}
	middleLabel="Resource Types"
	leftMiddle={leftResourceTypes.length}
	rightMiddle={rightResourceTypes.length}
	{overlap}
/>

{#if !bothEmpty}
	<CompareProfileRadar
		title="Project profile"
		{leftName}
		{leftProfile}
		{rightName}
		{rightProfile}
	/>
{/if}

<CompareSharedSubjects shared={overlap.shared} />

<ComparePair
	leftTitle="{leftName} Timeline"
	rightTitle="{rightName} Timeline"
	leftData={leftTimeline}
	rightData={rightTimeline}
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
	leftTitle="{leftName} Resource Types"
	rightTitle="{rightName} Resource Types"
	leftData={leftResourceTypes}
	rightData={rightResourceTypes}
>
	{#snippet left(data)}
		<PieChart {data} />
	{/snippet}
	{#snippet right(data)}
		<PieChart {data} />
	{/snippet}
</ComparePair>

<ComparePair
	leftTitle="{leftName} Top Subjects"
	rightTitle="{rightName} Top Subjects"
	leftData={leftSubjects}
	rightData={rightSubjects}
>
	{#snippet left(data)}
		<BarChart {data} maxItems={8} />
	{/snippet}
	{#snippet right(data)}
		<BarChart {data} maxItems={8} />
	{/snippet}
</ComparePair>

<ComparePair
	leftTitle="{leftName} Languages"
	rightTitle="{rightName} Languages"
	leftData={leftLanguages}
	rightData={rightLanguages}
	contentHeight="h-chart-sm"
>
	{#snippet left(data)}
		<BarChart {data} maxItems={6} />
	{/snippet}
	{#snippet right(data)}
		<BarChart {data} maxItems={6} />
	{/snippet}
</ComparePair>
