<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import Button from '$lib/components/ui/button.svelte';
	import Badge from '$lib/components/ui/badge.svelte';
	import {
		filters,
		resetFilters,
		toggleResourceType,
		toggleLanguage,
		toggleUniversity,
		activeFilterCount
	} from '$lib/stores/filters';
	import { allCollections, universityItemCounts } from '$lib/stores/data';
	import { getUniqueResourceTypes, getUniqueLanguages } from '$lib/utils/dataTransform';
	import { languageName } from '$lib/utils/languages';
	import { universities } from '$lib/types';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	let resourceTypes = $derived(getUniqueResourceTypes($allCollections));
	let languages = $derived(getUniqueLanguages($allCollections));

	let isExpanded = $state(false);
</script>

<div class={cn('rounded-lg border bg-card p-4', className)}>
	<div class="flex items-center justify-between mb-4">
		<div class="flex items-center gap-2">
			<h3 class="font-semibold">Filters</h3>
			{#if $activeFilterCount > 0}
				<Badge variant="secondary">{$activeFilterCount}</Badge>
			{/if}
		</div>
		<div class="flex gap-2">
			{#if $activeFilterCount > 0}
				<Button variant="ghost" size="sm" onclick={() => resetFilters()}>
					{#snippet children()}Clear{/snippet}
				</Button>
			{/if}
			<Button variant="ghost" size="sm" onclick={() => isExpanded = !isExpanded}>
				{#snippet children()}
					{isExpanded ? 'Collapse' : 'Expand'}
				{/snippet}
			</Button>
		</div>
	</div>

	{#if isExpanded}
		<div class="space-y-4">
			<!-- Universities -->
			<div>
				<h4 class="text-sm font-medium mb-2 text-muted-foreground">University</h4>
				<div class="flex flex-wrap gap-2">
					{#each universities as uni}
						<button
							type="button"
							onclick={() => toggleUniversity(uni.id)}
							class={cn(
								'px-2 py-1 rounded-md text-xs transition-colors flex items-center gap-1.5',
								$filters.universities.includes(uni.id)
									? 'bg-primary text-primary-foreground'
									: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
							)}
						>
							<span>{uni.name}</span>
							<span class="opacity-70">({$universityItemCounts[uni.id] || 0})</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Resource Types -->
			<div>
				<h4 class="text-sm font-medium mb-2 text-muted-foreground">Resource Type</h4>
				<div class="flex flex-wrap gap-2">
					{#each resourceTypes as type}
						<button
							type="button"
							onclick={() => toggleResourceType(type)}
							class={cn(
								'px-2 py-1 rounded-md text-xs transition-colors',
								$filters.resourceTypes.includes(type)
									? 'bg-primary text-primary-foreground'
									: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
							)}
						>
							{type}
						</button>
					{/each}
				</div>
			</div>

			<!-- Languages -->
			<div>
				<h4 class="text-sm font-medium mb-2 text-muted-foreground">Language</h4>
				<div class="flex flex-wrap gap-2">
					{#each languages as lang}
						<button
							type="button"
							onclick={() => toggleLanguage(lang)}
							class={cn(
								'px-2 py-1 rounded-md text-xs transition-colors',
								$filters.languages.includes(lang)
									? 'bg-primary text-primary-foreground'
									: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
							)}
						>
							{languageName(lang)}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{:else}
		<!-- Quick filter summary -->
		<div class="flex flex-wrap gap-2">
			{#each $filters.universities as uniId}
				{@const uni = universities.find((u) => u.id === uniId)}
				{#if uni}
					<Badge variant="outline">
						{uni.name}
						<button
							type="button"
							class="ml-1 hover:text-destructive"
							onclick={() => toggleUniversity(uniId)}
						>
							×
						</button>
					</Badge>
				{/if}
			{/each}
			{#each $filters.resourceTypes as type}
				<Badge variant="outline">
					{type}
					<button
						type="button"
						class="ml-1 hover:text-destructive"
						onclick={() => toggleResourceType(type)}
					>
						×
					</button>
				</Badge>
			{/each}
			{#each $filters.languages as lang}
				<Badge variant="outline">
					{languageName(lang)}
					<button
						type="button"
						class="ml-1 hover:text-destructive"
						onclick={() => toggleLanguage(lang)}
					>
						×
					</button>
				</Badge>
			{/each}
			{#if $activeFilterCount === 0}
				<span class="text-sm text-muted-foreground">No filters applied</span>
			{/if}
		</div>
	{/if}
</div>
