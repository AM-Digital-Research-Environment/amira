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
	import { getUniqueResourceTypes, getUniqueLanguages } from '$lib/utils/transforms';
	import { languageName } from '$lib/utils/languages';
	import { universities } from '$lib/types';
	import { getUniversityName } from '$lib/utils/entityResolver';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	let resourceTypes = $derived(getUniqueResourceTypes($allCollections));
	let languages = $derived(getUniqueLanguages($allCollections));

	let isExpanded = $state(false);
</script>

<div
	class={cn(
		'rounded-xl border border-border/60 bg-card shadow-xs transition-shadow duration-normal ease-expo-out hover:shadow-sm',
		className
	)}
>
	<div class="flex items-center justify-between px-5 py-4">
		<div class="flex items-center gap-2">
			<h3 class="font-display font-semibold tracking-tight">Filters</h3>
			{#if $activeFilterCount > 0}
				<Badge variant="secondary">{$activeFilterCount}</Badge>
			{/if}
		</div>
		<div class="flex gap-1">
			{#if $activeFilterCount > 0}
				<Button variant="ghost" size="sm" onclick={() => resetFilters()}>
					{#snippet children()}Clear{/snippet}
				</Button>
			{/if}
			<Button variant="ghost" size="sm" onclick={() => (isExpanded = !isExpanded)}>
				{#snippet children()}
					{isExpanded ? 'Collapse' : 'Expand'}
				{/snippet}
			</Button>
		</div>
	</div>

	{#if isExpanded}
		<div class="px-5 pb-5 space-y-5 border-t border-border/50 pt-4">
			<!-- Universities -->
			<div>
				<h4 class="text-2xs font-semibold mb-2.5 text-muted-foreground uppercase tracking-widest">
					University
				</h4>
				<div class="flex flex-wrap gap-1.5">
					{#each universities as uni (uni.id)}
						{@const count = $universityItemCounts[uni.id] || 0}
						{#if count > 0}
							<button
								type="button"
								onclick={() => toggleUniversity(uni.id)}
								class={cn(
									'px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-fast ease-out flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
									$filters.universities.includes(uni.id)
										? 'bg-primary text-primary-foreground shadow-xs'
										: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover'
								)}
							>
								<span>{uni.name}</span>
								<span class="opacity-70 tabular-nums">({count})</span>
							</button>
						{/if}
					{/each}
				</div>
			</div>

			<!-- Resource Types -->
			<div>
				<h4 class="text-2xs font-semibold mb-2.5 text-muted-foreground uppercase tracking-widest">
					Resource Type
				</h4>
				<div class="flex flex-wrap gap-1.5">
					{#each resourceTypes as type (type)}
						<button
							type="button"
							onclick={() => toggleResourceType(type)}
							class={cn(
								'px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
								$filters.resourceTypes.includes(type)
									? 'bg-primary text-primary-foreground shadow-xs'
									: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover'
							)}
						>
							{type}
						</button>
					{/each}
				</div>
			</div>

			<!-- Languages -->
			<div>
				<h4 class="text-2xs font-semibold mb-2.5 text-muted-foreground uppercase tracking-widest">
					Language
				</h4>
				<div class="flex flex-wrap gap-1.5">
					{#each languages as lang (lang)}
						<button
							type="button"
							onclick={() => toggleLanguage(lang)}
							class={cn(
								'px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
								$filters.languages.includes(lang)
									? 'bg-primary text-primary-foreground shadow-xs'
									: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover'
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
		<div class="flex flex-wrap gap-1.5 px-5 pb-4 border-t border-border/50 pt-4">
			{#each $filters.universities as uniId (uniId)}
				{@const label = getUniversityName(uniId)}
				{#if label}
					<Badge variant="outline">
						{label}
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
			{#each $filters.resourceTypes as type (type)}
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
			{#each $filters.languages as lang (lang)}
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
