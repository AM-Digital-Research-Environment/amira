<script lang="ts" generics="T">
	import { Pagination, EmptyState } from '$lib/components/ui';
	import { Search } from '@lucide/svelte';
	import { paginate } from '$lib/utils/pagination';
	import { DEFAULT_ENTITIES_PER_PAGE } from '$lib/utils/constants';
	import type { Snippet, Component } from 'svelte';

	interface Props {
		items: T[];
		getKey: (item: T) => string;
		card: Snippet<[T]>;
		emptyMessage?: string;
		emptyIcon?: Component;
		/** Cards per page. Defaults to `DEFAULT_ENTITIES_PER_PAGE` (48). */
		perPage?: number;
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
		perPage = DEFAULT_ENTITIES_PER_PAGE,
		density = 'cozy'
	}: Props = $props();

	let page = $state(0);

	// Reset to page 0 when the input list changes (e.g. search / sort / filter).
	// We key on length + first/last keys so changing sort order or filter visibly
	// rewinds; content mutation without reordering (rare here) won't.
	let resetKey = $derived(
		items.length === 0
			? '∅'
			: `${items.length}|${getKey(items[0])}|${getKey(items[items.length - 1])}`
	);
	$effect(() => {
		resetKey;
		page = 0;
	});

	let paginatedItems = $derived(paginate(items, page, perPage));

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
		{#each paginatedItems as item (getKey(item))}
			{@render card(item)}
		{/each}
	</div>
	<Pagination
		currentPage={page}
		totalItems={items.length}
		itemsPerPage={perPage}
		onPageChange={(p) => (page = p)}
	/>
{/if}
