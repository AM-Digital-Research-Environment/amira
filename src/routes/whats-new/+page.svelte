<script lang="ts">
	import { Sparkles, FileText, Briefcase } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { projects, allCollections, ensureCollections } from '$lib/stores/data';
	import type { Project, CollectionItem, BarChartDataPoint } from '$lib/types';
	import { formatDate, getProjectTitle, getSectionColor } from '$lib/utils/helpers';
	import { projectUrl, personUrl, researchSectionsUrl } from '$lib/utils/urls';
	import { paginate } from '$lib/utils/pagination';
	import SEO from '$lib/components/ui/seo.svelte';
	import StatCard from '$lib/components/ui/stat-card.svelte';
	import ChartCard from '$lib/components/ui/chart-card.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import CardContent from '$lib/components/ui/card-content.svelte';
	import Badge from '$lib/components/ui/badge.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import CollectionItemRow from '$lib/components/ui/collection-item-row.svelte';
	import Pagination from '$lib/components/ui/pagination.svelte';
	import EmptyState from '$lib/components/ui/empty-state.svelte';
	import { BarChart } from '$lib/components/charts';
	import { SvelteDate, SvelteMap, SvelteSet } from 'svelte/reactivity';

	onMount(() => {
		void ensureCollections(base);
	});

	// Parse a date-like value into a Date or null
	function parseDate(val: Date | string | null | undefined): Date | null {
		if (!val) return null;
		const d = val instanceof Date ? val : new Date(val);
		return isNaN(d.getTime()) ? null : d;
	}

	// Time window filter. No "All time" option -- What's New is specifically
	// about recent additions, so an unbounded window defeats the page's purpose.
	const timeWindowOptions = [
		{ value: '3', label: 'Last 3 months' },
		{ value: '6', label: 'Last 6 months' },
		{ value: '12', label: 'Last 12 months' }
	];
	let timeWindow = $state('6');

	let cutoffDate: Date = $derived.by(() => {
		const d = new SvelteDate();
		d.setMonth(d.getMonth() - parseInt(timeWindow));
		return d;
	});

	// Items with createdAt within the time window, sorted desc
	let recentItems: CollectionItem[] = $derived.by(() => {
		return [...$allCollections]
			.filter((item) => {
				const d = parseDate(item.createdAt);
				if (!d) return false;
				return d >= cutoffDate;
			})
			.sort((a, b) => {
				const da = parseDate(a.createdAt);
				const db = parseDate(b.createdAt);
				return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
			});
	});

	// Per-project: most recent item createdAt and count of items within window
	interface ProjectNewInfo {
		project: Project;
		latestItemDate: Date;
		newItemCount: number;
		totalItemCount: number;
	}

	let projectsByNewItems: ProjectNewInfo[] = $derived.by(() => {
		const map = new SvelteMap<string, { latest: Date; count: number }>();
		for (const item of recentItems) {
			const pid = item.project?.id;
			if (!pid) continue;
			const d = parseDate(item.createdAt)!;
			const existing = map.get(pid);
			if (existing) {
				if (d > existing.latest) existing.latest = d;
				existing.count++;
			} else {
				map.set(pid, { latest: d, count: 1 });
			}
		}

		return [...map.entries()]
			.map(([pid, info]) => {
				const project = $projects.find((p) => p.id === pid);
				if (!project) return null;
				return {
					project,
					latestItemDate: info.latest,
					newItemCount: info.count,
					totalItemCount: $allCollections.filter((item) => item.project?.id === pid).length
				};
			})
			.filter((x): x is ProjectNewInfo => x !== null)
			.sort((a, b) => b.latestItemDate.getTime() - a.latestItemDate.getTime())
			.slice(0, 10);
	});

	// Count of projects that have items within time window
	let projectsWithNewItems: number = $derived.by(() => {
		const pids = new SvelteSet<string>();
		for (const item of recentItems) {
			if (item.project?.id) pids.add(item.project.id);
		}
		return pids.size;
	});

	// Recently added items grouped by resource type
	let itemsByType: BarChartDataPoint[] = $derived.by(() => {
		const counts = new SvelteMap<string, number>();
		for (const item of recentItems) {
			const type = item.typeOfResource || 'Unknown';
			counts.set(type, (counts.get(type) ?? 0) + 1);
		}
		return [...counts.entries()]
			.map(([name, value]) => ({ name, value }))
			.sort((a, b) => b.value - a.value);
	});

	// Pagination for recent items
	let itemsPage = $state(0);
	const itemsPerPage = 15;

	// Reset pagination when time window changes
	$effect(() => {
		timeWindow;
		itemsPage = 0;
	});

	let paginatedItems: CollectionItem[] = $derived(paginate(recentItems, itemsPage, itemsPerPage));
</script>

<SEO
	title="What's New"
	description="Recently added and updated projects and research items across the Africa Multiple Cluster of Excellence."
/>

<div class="space-y-8">
	<!-- Header -->
	<div class="animate-slide-in-up">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div>
				<h1 class="page-title">What's New</h1>
				<p class="page-subtitle">Recently added projects and research items</p>
			</div>
			<Select options={timeWindowOptions} bind:value={timeWindow} class="w-44 shrink-0" />
		</div>
	</div>

	<!-- Stat cards -->
	<div
		class="grid gap-4 grid-cols-2 lg:grid-cols-3 animate-slide-in-up"
		style="animation-delay: 50ms"
	>
		<StatCard
			value={$projects.length}
			label="Total Projects"
			icon={Briefcase}
			iconBgClass="bg-primary/10"
		/>
		<StatCard
			value={projectsWithNewItems}
			label="Projects with New Items"
			icon={Sparkles}
			iconBgClass="bg-chart-2/10"
			animationDelay="75ms"
		/>
		<StatCard
			value={recentItems.length}
			label="Recently Added Items"
			icon={FileText}
			iconBgClass="bg-chart-3/10"
			animationDelay="150ms"
		/>
	</div>

	<!-- Items by resource type -->
	{#if itemsByType.length > 0}
		<div class="animate-slide-in-up" style="animation-delay: 100ms">
			<ChartCard title="New Items by Resource Type" subtitle="Breakdown of recently added items">
				<BarChart data={itemsByType} />
			</ChartCard>
		</div>
	{/if}

	<!-- Projects with recently added items -->
	<div class="animate-slide-in-up" style="animation-delay: 150ms">
		<h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
			<Sparkles class="h-5 w-5 text-primary" />
			Projects with Recently Added Items
		</h2>
		{#if projectsByNewItems.length > 0}
			<div class="grid gap-3 sm:grid-cols-2">
				{#each projectsByNewItems as { project, latestItemDate, newItemCount, totalItemCount } (project.id)}
					<Card class="min-w-0">
						<CardContent class="p-4">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0 flex-1">
									<a
										href={projectUrl(project.id)}
										class="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2 break-words"
									>
										{getProjectTitle(project)}
									</a>
									{#if project.pi?.length}
										<p class="text-xs text-muted-foreground mt-1 truncate">
											PI: {#each project.pi as pi, i (pi)}{#if i > 0},
												{/if}<a href={personUrl(pi)} class="hover:text-primary transition-colors"
													>{pi}</a
												>{/each}
										</p>
									{/if}
									<div class="flex flex-wrap items-center gap-1.5 mt-2">
										{#each project.researchSection ?? [] as section (section)}
											<a
												href={researchSectionsUrl(section)}
												class="hover:opacity-80 transition-opacity"
											>
												<Badge variant="outline">
													<span
														class="inline-block w-2 h-2 rounded-full mr-1"
														style="background-color: {getSectionColor(section)}"
													></span>
													{section}
												</Badge>
											</a>
										{/each}
									</div>
								</div>
								<div class="text-right shrink-0">
									<span class="text-xs text-chart-2">
										{formatDate(latestItemDate)}
									</span>
									<p class="text-xs text-muted-foreground mt-1">
										{newItemCount} new · {totalItemCount} total
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				{/each}
			</div>
		{:else}
			<EmptyState message="No projects with recently added items" icon={Briefcase} />
		{/if}
	</div>

	<!-- Recently added research items -->
	<div class="animate-slide-in-up" style="animation-delay: 200ms">
		<h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
			<FileText class="h-5 w-5 text-primary" />
			Recently Added Research Items
		</h2>
		{#if recentItems.length > 0}
			<Card>
				<CardContent class="p-4">
					<ul class="space-y-2">
						{#each paginatedItems as item (item._id || item.dre_id)}
							<CollectionItemRow {item} showType={true} showProject={true}>
								{#snippet extraMetadata()}
									{#if item.createdAt}
										<span class="text-xs text-chart-2">
											{formatDate(parseDate(item.createdAt))}
										</span>
									{/if}
								{/snippet}
							</CollectionItemRow>
						{/each}
					</ul>
					<div class="mt-4">
						<Pagination
							currentPage={itemsPage}
							totalItems={recentItems.length}
							{itemsPerPage}
							onPageChange={(p) => (itemsPage = p)}
						/>
					</div>
				</CardContent>
			</Card>
		{:else}
			<EmptyState message="No items with creation dates available" icon={FileText} />
		{/if}
	</div>
</div>
