<script lang="ts">
	import { Input, Badge } from '$lib/components/ui';
	import { ArrowDownAZ, ArrowDown01 } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	export type EntitySort = 'count-desc' | 'count-asc' | 'name-asc' | 'name-desc';

	interface Props {
		searchQuery: string;
		onSearchChange: (value: string) => void;
		searchPlaceholder?: string;
		sort?: EntitySort;
		onSortChange?: (value: EntitySort) => void;
		totalCount: number;
		totalLabel?: string;
		sortable?: boolean;
		/** Extra controls rendered between the search + sort (e.g. view-mode toggle). */
		extras?: Snippet;
	}

	let {
		searchQuery,
		onSearchChange,
		searchPlaceholder = 'Search...',
		sort = 'count-desc',
		onSortChange,
		totalCount,
		totalLabel = 'results',
		sortable = true,
		extras
	}: Props = $props();

	function cycleCountSort() {
		if (!onSortChange) return;
		onSortChange(sort === 'count-desc' ? 'count-asc' : 'count-desc');
	}

	function cycleNameSort() {
		if (!onSortChange) return;
		onSortChange(sort === 'name-asc' ? 'name-desc' : 'name-asc');
	}
</script>

<div
	class="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-border/60 bg-card"
>
	<div class="flex-1 min-w-0">
		<Input
			placeholder={searchPlaceholder}
			value={searchQuery}
			oninput={(e) => onSearchChange((e.currentTarget as HTMLInputElement).value)}
		/>
	</div>

	{#if extras}
		{@render extras()}
	{/if}

	{#if sortable && onSortChange}
		<div class="flex items-center gap-1">
			<button
				type="button"
				onclick={cycleCountSort}
				class="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-md border text-xs font-medium transition-colors {sort ===
					'count-desc' || sort === 'count-asc'
					? 'border-primary bg-primary/10 text-primary'
					: 'border-input hover:bg-muted'}"
				title="Sort by item count"
			>
				<ArrowDown01 class="h-3.5 w-3.5" />
				Count
				{#if sort === 'count-desc'}
					<span class="text-2xs">↓</span>
				{:else if sort === 'count-asc'}
					<span class="text-2xs">↑</span>
				{/if}
			</button>
			<button
				type="button"
				onclick={cycleNameSort}
				class="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-md border text-xs font-medium transition-colors {sort ===
					'name-asc' || sort === 'name-desc'
					? 'border-primary bg-primary/10 text-primary'
					: 'border-input hover:bg-muted'}"
				title="Sort alphabetically"
			>
				<ArrowDownAZ class="h-3.5 w-3.5" />
				A–Z
				{#if sort === 'name-asc'}
					<span class="text-2xs">↓</span>
				{:else if sort === 'name-desc'}
					<span class="text-2xs">↑</span>
				{/if}
			</button>
		</div>
	{/if}

	<Badge variant="secondary" class="shrink-0 self-start sm:self-auto">
		{#snippet children()}{totalCount}
			{totalLabel}{/snippet}
	</Badge>
</div>
