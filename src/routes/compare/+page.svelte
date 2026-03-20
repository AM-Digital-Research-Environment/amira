<script lang="ts">
	import { ChartCard, EmptyState, Card, CardHeader, CardTitle, CardContent, Select, Combobox, Badge, SEO } from '$lib/components/ui';
	import { StackedTimeline, BarChart, PieChart } from '$lib/components/charts';
	import { allCollections } from '$lib/stores/data';
	import {
		groupByYearAndType,
		extractSubjects,
		extractResourceTypes,
		extractLanguages
	} from '$lib/utils/dataTransform';
	import { UNIVERSITY_COLLECTIONS, getUniversities } from '$lib/utils/dataLoader';
	import type { CollectionItem } from '$lib/types';
	import { universityOptions } from '$lib/types';
	import { FileQuestion } from '@lucide/svelte';

	// Get all universities
	const allUniversities = getUniversities();

	// Build a lookup of project ID → full project name from collection items
	let projectNameMap = $derived.by(() => {
		const map = new Map<string, string>();
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

	// Build project options for a given university
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
			projectList = allUniversities.flatMap((uni) =>
				(UNIVERSITY_COLLECTIONS[uni.id] || []).map((proj) => buildOption(uni.id, proj))
			);
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

		// Filter by project if not "all"
		if (projectId !== 'all') {
			// projectId format: "universityId:projectName"
			const [, projectName] = projectId.split(':');
			if (projectName) {
				result = result.filter(
					(item) =>
						item.project?.name?.includes(projectName.replace(/(\d{4})$/, '')) ||
						item.project?.id?.includes(projectName)
				);
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
			return 'All Collections';
		}

		const uni = allUniversities.find((u) => u.id === universityId);
		const uniName = uni?.name || 'All';

		if (projectId === 'all') {
			return uniName;
		}

		const [, projKey] = projectId.split(':');
		const fullName = projKey ? projectNameMap.get(projKey) : null;
		return fullName || projKey || projectId;
	}
</script>
<SEO title="Compare" description="Compare research data across universities and collections" />

<div class="space-y-6">
	<!-- Page Header -->
	<div class="animate-slide-in-up">
		<h1 class="page-title">Compare Collections</h1>
		<p class="page-subtitle">
			Side-by-side comparison of different collections
		</p>
	</div>

	<!-- Collection Selectors -->
	<div class="grid gap-4 md:grid-cols-2">
		<Card>
			{#snippet children()}
				<CardHeader class="pb-3">
					{#snippet children()}
						<CardTitle class="text-lg">
							{#snippet children()}Left Collection{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="space-y-3">
							<div>
								<span class="text-sm text-muted-foreground mb-1 block">University</span>
								<Select
									options={universityOptions}
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
							{#snippet children()}Right Collection{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="space-y-3">
							<div>
								<span class="text-sm text-muted-foreground mb-1 block">University</span>
								<Select
									options={universityOptions}
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
									<p class="text-xs text-muted-foreground max-w-[120px] truncate">{getSelectionName(leftUniversity, leftProject)}</p>
								</div>
								<span class="text-muted-foreground">vs</span>
								<div>
									<div class="text-2xl font-bold text-chart-2">{rightData.length}</div>
									<p class="text-xs text-muted-foreground max-w-[120px] truncate">{getSelectionName(rightUniversity, rightProject)}</p>
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
									<p class="text-xs text-muted-foreground max-w-[120px] truncate">{getSelectionName(leftUniversity, leftProject)}</p>
								</div>
								<span class="text-muted-foreground">vs</span>
								<div>
									<div class="text-2xl font-bold text-chart-2">{rightResourceTypes.length}</div>
									<p class="text-xs text-muted-foreground max-w-[120px] truncate">{getSelectionName(rightUniversity, rightProject)}</p>
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
							{#each subjectOverlap.shared as subject}
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
		<ChartCard title="{getSelectionName(leftUniversity, leftProject)} Timeline" contentHeight="h-[350px]">
			{#if leftTimeline.length > 0}
				<StackedTimeline data={leftTimeline} />
			{:else}
				<EmptyState message="No timeline data" icon={FileQuestion} />
			{/if}
		</ChartCard>

		<ChartCard title="{getSelectionName(rightUniversity, rightProject)} Timeline" contentHeight="h-[350px]">
			{#if rightTimeline.length > 0}
				<StackedTimeline data={rightTimeline} />
			{:else}
				<EmptyState message="No timeline data" icon={FileQuestion} />
			{/if}
		</ChartCard>
	</div>

	<!-- Resource Types Comparison -->
	<div class="grid gap-6 lg:grid-cols-2">
		<ChartCard title="{getSelectionName(leftUniversity, leftProject)} Resource Types" contentHeight="h-[350px]">
			{#if leftResourceTypes.length > 0}
				<PieChart data={leftResourceTypes} />
			{:else}
				<EmptyState message="No data" icon={FileQuestion} />
			{/if}
		</ChartCard>

		<ChartCard title="{getSelectionName(rightUniversity, rightProject)} Resource Types" contentHeight="h-[350px]">
			{#if rightResourceTypes.length > 0}
				<PieChart data={rightResourceTypes} />
			{:else}
				<EmptyState message="No data" icon={FileQuestion} />
			{/if}
		</ChartCard>
	</div>

	<!-- Top Subjects Comparison -->
	<div class="grid gap-6 lg:grid-cols-2">
		<ChartCard title="{getSelectionName(leftUniversity, leftProject)} Top Subjects" contentHeight="h-[350px]">
			{#if leftSubjects.length > 0}
				<BarChart data={leftSubjects} maxItems={8} />
			{:else}
				<EmptyState message="No data" icon={FileQuestion} />
			{/if}
		</ChartCard>

		<ChartCard title="{getSelectionName(rightUniversity, rightProject)} Top Subjects" contentHeight="h-[350px]">
			{#if rightSubjects.length > 0}
				<BarChart data={rightSubjects} maxItems={8} />
			{:else}
				<EmptyState message="No data" icon={FileQuestion} />
			{/if}
		</ChartCard>
	</div>

	<!-- Languages Comparison -->
	<div class="grid gap-6 lg:grid-cols-2">
		<ChartCard title="{getSelectionName(leftUniversity, leftProject)} Languages" contentHeight="h-[300px]">
			{#if leftLanguages.length > 0}
				<BarChart data={leftLanguages} maxItems={6} />
			{:else}
				<EmptyState message="No data" icon={FileQuestion} />
			{/if}
		</ChartCard>

		<ChartCard title="{getSelectionName(rightUniversity, rightProject)} Languages" contentHeight="h-[300px]">
			{#if rightLanguages.length > 0}
				<BarChart data={rightLanguages} maxItems={6} />
			{:else}
				<EmptyState message="No data" icon={FileQuestion} />
			{/if}
		</ChartCard>
	</div>
</div>
