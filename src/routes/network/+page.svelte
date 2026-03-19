<script lang="ts">
	import { StatCard, ChartCard, EmptyState, Card, CardContent, Tabs, Select, SEO } from '$lib/components/ui';
	import { NetworkGraph } from '$lib/components/charts';
	import { allCollections, persons, projects } from '$lib/stores/data';
	import { buildContributorNetwork, buildPersonInstitutionNetwork, buildInstitutionCollaborationNetwork } from '$lib/utils/dataTransform';
	import { universityOptions } from '$lib/types';
	import type { CollectionItem } from '$lib/types';
	import { Circle, Link, Tag, Building2, Users, Briefcase } from '@lucide/svelte';

	const tabs = [
		{ id: 'contributors', label: 'Contributors' },
		{ id: 'affiliations', label: 'Affiliations' },
		{ id: 'institutions', label: 'Institution Collaborations' }
	];

	let activeTab = $state('contributors');

	// Filters
	let selectedUniversity = $state('all');
	let maxNodes = $state(100);
	let selectedResourceType = $state('all');

	// Get unique resource types from all collections
	let resourceTypeOptions = $derived.by(() => {
		const types = new Set<string>();
		$allCollections.forEach((item) => {
			if (item.typeOfResource) types.add(item.typeOfResource);
		});
		return [
			{ value: 'all', label: 'All Resource Types' },
			...Array.from(types).sort().map((t) => ({ value: t, label: t }))
		];
	});

	// Filtered collections based on facets
	let filteredCollections = $derived.by(() => {
		let result: CollectionItem[] = $allCollections;

		if (selectedUniversity !== 'all') {
			result = result.filter((item) => item.university === selectedUniversity);
		}

		if (selectedResourceType !== 'all') {
			result = result.filter((item) => item.typeOfResource === selectedResourceType);
		}

		return result;
	});

	let contributorNetwork = $derived(buildContributorNetwork(filteredCollections, maxNodes));
	let affiliationNetwork = $derived(buildPersonInstitutionNetwork($persons, 50));
	let institutionNetwork = $derived(buildInstitutionCollaborationNetwork($projects, $persons, maxNodes));

	function handleTabChange(tabId: string) {
		activeTab = tabId;
	}
</script>
<SEO title="Network" description="Explore relationships between contributors, projects, and institutions" />

<div class="space-y-6">
	<!-- Page Header -->
	<div class="animate-slide-in-up">
		<h1 class="page-title">Network</h1>
		<p class="page-subtitle">
			Explore relationships between contributors, projects, and institutions
		</p>
	</div>

	<!-- Filters -->
	<Card>
		<CardContent class="pt-6">
			<div class="flex flex-wrap items-end gap-4">
				<div class="w-48">
					<span class="text-sm text-muted-foreground mb-1 block">University</span>
					<Select
						options={universityOptions}
						bind:value={selectedUniversity}
						placeholder="Select university"
					/>
				</div>

				<div class="w-48">
					<span class="text-sm text-muted-foreground mb-1 block">Resource Type</span>
					<Select
						options={resourceTypeOptions}
						bind:value={selectedResourceType}
						placeholder="Select type"
					/>
				</div>

				<div class="w-48">
					<span class="text-sm text-muted-foreground mb-1 block">
						Max Nodes: <span class="font-medium">{maxNodes}</span>
					</span>
					<input
						type="range"
						min="20"
						max="200"
						step="10"
						bind:value={maxNodes}
						class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
					/>
				</div>

				<div class="text-sm text-muted-foreground">
					Showing <span class="font-medium text-foreground">{filteredCollections.length}</span> items
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Tabs -->
	<Tabs {tabs} {activeTab} onTabChange={handleTabChange}>
		{#snippet children(tab)}
			{#if tab === 'contributors'}
				<!-- Contributor Network -->
				<div class="grid gap-4 md:grid-cols-3 mb-6">
					<StatCard
						value={contributorNetwork.nodes.length}
						label="Nodes"
						icon={Circle}
						animationDelay="75ms"
					/>
					<StatCard
						value={contributorNetwork.links.length}
						label="Connections"
						icon={Link}
						animationDelay="150ms"
					/>
					<StatCard
						value={contributorNetwork.categories.length}
						label="Categories"
						icon={Tag}
						animationDelay="225ms"
					/>
				</div>

				<ChartCard title="Contributor-Project Network" contentHeight="h-[600px]">
					{#if contributorNetwork.nodes.length > 0}
						<NetworkGraph data={contributorNetwork} />
					{:else}
						<EmptyState message="No network data available" />
					{/if}
				</ChartCard>

				<ChartCard title="Network Legend" class="mt-6">
					<div class="flex gap-6">
						{#each contributorNetwork.categories as category, i}
							<div class="flex items-center gap-2">
								<div
									class="w-4 h-4 rounded-full"
									style="background-color: {i === 0 ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-2))'}"
								></div>
								<span class="text-sm">{category.name}</span>
							</div>
						{/each}
					</div>
					<p class="text-sm text-muted-foreground mt-4">
						Drag nodes to rearrange. Scroll to zoom. Click and drag background to pan.
					</p>
				</ChartCard>
			{:else if tab === 'affiliations'}
				<!-- Affiliation Network -->
				<div class="grid gap-4 md:grid-cols-3 mb-6">
					<StatCard
						value={affiliationNetwork.nodes.length}
						label="Nodes"
						icon={Circle}
						animationDelay="75ms"
					/>
					<StatCard
						value={affiliationNetwork.links.length}
						label="Connections"
						icon={Link}
						animationDelay="150ms"
					/>
					<StatCard
						value={$persons.length}
						label="Total Persons"
						icon={Users}
						animationDelay="225ms"
					/>
				</div>

				<ChartCard title="Person-Institution Network" contentHeight="h-[600px]">
					{#if affiliationNetwork.nodes.length > 0}
						<NetworkGraph data={affiliationNetwork} />
					{:else}
						<EmptyState message="No affiliation data available. Persons may not have institutional affiliations recorded." />
					{/if}
				</ChartCard>

				<ChartCard title="Network Legend" class="mt-6">
					<div class="flex gap-6">
						{#each affiliationNetwork.categories as category, i}
							<div class="flex items-center gap-2">
								<div
									class="w-4 h-4 rounded-full"
									style="background-color: {i === 0 ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-2))'}"
								></div>
								<span class="text-sm">{category.name}</span>
							</div>
						{/each}
					</div>
					<p class="text-sm text-muted-foreground mt-4">
						Drag nodes to rearrange. Scroll to zoom. Click and drag background to pan.
					</p>
				</ChartCard>
			{:else}
				<!-- Institution Collaboration Network -->
				<div class="grid gap-4 md:grid-cols-3 mb-6">
					<StatCard
						value={institutionNetwork.nodes.length}
						label="Institutions"
						icon={Building2}
						animationDelay="75ms"
					/>
					<StatCard
						value={institutionNetwork.links.length}
						label="Collaborations"
						icon={Link}
						animationDelay="150ms"
					/>
					<StatCard
						value={$projects.length}
						label="Total Projects"
						icon={Briefcase}
						animationDelay="225ms"
					/>
				</div>

				<ChartCard title="Institution Collaboration Network" contentHeight="h-[600px]">
					{#if institutionNetwork.nodes.length > 0}
						<NetworkGraph data={institutionNetwork} />
					{:else}
						<EmptyState message="No collaboration data available. Institutions may not have shared projects." />
					{/if}
				</ChartCard>

				<ChartCard title="About this visualization" class="mt-6">
					<p class="text-sm text-muted-foreground">
						This network shows institutions that collaborate through shared research projects.
						Connections are formed when institutions have team members working on the same project.
						Node size reflects the number of collaborations. Thicker lines indicate more shared projects.
					</p>
					<p class="text-sm text-muted-foreground mt-4">
						Drag nodes to rearrange. Scroll to zoom. Click and drag background to pan.
					</p>
				</ChartCard>
			{/if}
		{/snippet}
	</Tabs>
</div>
