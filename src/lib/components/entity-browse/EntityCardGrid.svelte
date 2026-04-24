<script lang="ts" generics="T">
	import { EmptyState } from '$lib/components/ui';
	import { Search } from '@lucide/svelte';
	import type { Snippet, Component } from 'svelte';

	interface Props {
		items: T[];
		getKey: (item: T) => string;
		card: Snippet<[T]>;
		emptyMessage?: string;
		emptyIcon?: Component;
		/**
		 * Grid density. "cozy" = 2/3/4 cols, "compact" = 2/3/4/5/6 cols,
		 * "comfortable" = 1/2/3 cols for longer names or richer cards.
		 */
		density?: 'compact' | 'cozy' | 'comfortable';
	}

	let {
		items,
		getKey,
		card,
		emptyMessage = 'No results found',
		emptyIcon = Search,
		density = 'cozy'
	}: Props = $props();

	const gridClasses = {
		compact: 'grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
		cozy: 'grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
		comfortable: 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
	} as const;
	let gridClass = $derived(gridClasses[density]);
</script>

{#if items.length === 0}
	<div class="rounded-xl border border-border/60 bg-card p-12">
		<EmptyState message={emptyMessage} icon={emptyIcon} />
	</div>
{:else}
	<div class={gridClass}>
		{#each items as item (getKey(item))}
			{@render card(item)}
		{/each}
	</div>
{/if}
