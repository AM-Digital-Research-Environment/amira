<script lang="ts">
	/**
	 * Items card with built-in search + type filter + sort + pagination.
	 *
	 * Mirrors the rich Research Items block on the /projects detail page and
	 * replaces the plain EntityItemsCard on every per-entity detail view so
	 * users get the same browsing affordances everywhere. Internal state is
	 * self-contained — pages just pass the items array.
	 *
	 * The type filter + sort bar is hidden on very small item sets (under
	 * `controlsMinItems`, default 5) because the controls add more UI weight
	 * than value at that size.
	 */
	import {
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		Badge,
		Pagination,
		Input,
		CollectionItemRow,
		EmptyState
	} from '$lib/components/ui';
	import { FileText, Search, ArrowUpDown } from '@lucide/svelte';
	import type { CollectionItem } from '$lib/types';
	import { paginate } from '$lib/utils/pagination';
	import { DEFAULT_ITEMS_PER_PAGE } from '$lib/utils/constants';
	import { getItemTitle } from '$lib/utils/helpers';
	import { languageName } from '$lib/utils/languages';
	import { SvelteSet } from 'svelte/reactivity';
	import type { Snippet } from 'svelte';

	type SortField = 'title' | 'date' | 'type';

	interface Props {
		items: CollectionItem[];
		title?: string;
		/** Show the resource-type text under each item's title. */
		showType?: boolean;
		/** Show the containing project name under each item's title. */
		showProject?: boolean;
		/** Threshold under which the filter/sort toolbar is hidden. */
		controlsMinItems?: number;
		/** Override the page size. */
		itemsPerPage?: number;
		emptyMessage?: string;
		/** Placeholder text for the search field. */
		searchPlaceholder?: string;
		/** Extra metadata rendered inside each row — passed the item so callers
		 * can e.g. badge the person's role on that item. */
		rowExtra?: Snippet<[CollectionItem]>;
	}

	let {
		items,
		title = 'Research Items',
		showType = true,
		showProject = true,
		controlsMinItems = 5,
		itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
		emptyMessage = 'No research items associated.',
		searchPlaceholder = 'Search items...',
		rowExtra
	}: Props = $props();

	const uid = $props.id();

	let searchQuery = $state('');
	let typeFilter = $state('');
	let sortBy = $state<SortField>('title');
	let sortAsc = $state(true);
	let currentPage = $state(0);

	// Distinct resource types for the type filter.
	let resourceTypes = $derived.by(() => {
		const set = new SvelteSet<string>();
		for (const item of items) {
			if (item.typeOfResource) set.add(item.typeOfResource);
		}
		return Array.from(set).sort();
	});

	const itemDate = (item: CollectionItem): number => {
		const d =
			item.dateInfo?.issue?.start ||
			item.dateInfo?.created?.start ||
			item.dateInfo?.captured?.start ||
			item.dateInfo?.other?.start;
		return d ? new Date(d).getTime() : 0;
	};

	let filteredItems = $derived.by((): CollectionItem[] => {
		let result = items;

		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			result = result.filter(
				(item) =>
					getItemTitle(item).toLowerCase().includes(q) ||
					item.typeOfResource?.toLowerCase().includes(q) ||
					item.language?.some((l) => languageName(l).toLowerCase().includes(q))
			);
		}

		if (typeFilter) {
			result = result.filter((item) => item.typeOfResource === typeFilter);
		}

		result = [...result].sort((a, b) => {
			let cmp = 0;
			if (sortBy === 'title') {
				cmp = getItemTitle(a).localeCompare(getItemTitle(b));
			} else if (sortBy === 'type') {
				cmp = (a.typeOfResource || '').localeCompare(b.typeOfResource || '');
			} else if (sortBy === 'date') {
				cmp = itemDate(a) - itemDate(b);
			}
			// Stable tiebreaker: fall back to title order.
			if (cmp === 0 && sortBy !== 'title') {
				cmp = getItemTitle(a).localeCompare(getItemTitle(b));
			}
			return sortAsc ? cmp : -cmp;
		});

		return result;
	});

	let paginatedItems = $derived(paginate(filteredItems, currentPage, itemsPerPage));

	// Reset pagination + filters whenever the input items change (e.g. on
	// navigation between entities).
	$effect(() => {
		items;
		searchQuery = '';
		typeFilter = '';
		currentPage = 0;
	});

	// Reset pagination when filters change without losing the filters
	// themselves.
	$effect(() => {
		searchQuery;
		typeFilter;
		sortBy;
		sortAsc;
		currentPage = 0;
	});

	function toggleSort(field: SortField) {
		if (sortBy === field) {
			sortAsc = !sortAsc;
		} else {
			sortBy = field;
			sortAsc = true;
		}
	}

	const showControls = $derived(items.length >= controlsMinItems);
</script>

<Card class="overflow-hidden">
	{#snippet children()}
		<CardHeader>
			{#snippet children()}
				<CardTitle class="text-lg">
					{#snippet children()}
						<span class="flex items-center gap-2">
							<FileText class="h-5 w-5 text-muted-foreground" />
							{title}
							<Badge variant="secondary">
								{#snippet children()}
									{filteredItems.length}{#if filteredItems.length !== items.length}
										/ {items.length}{/if}
								{/snippet}
							</Badge>
						</span>
					{/snippet}
				</CardTitle>
			{/snippet}
		</CardHeader>
		<CardContent>
			{#snippet children()}
				{#if items.length === 0}
					<p class="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>
				{:else}
					{#if showControls}
						<!-- Search + type filter -->
						<div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
							<div class="relative flex-1 min-w-0">
								<Search
									class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
								/>
								<Input placeholder={searchPlaceholder} bind:value={searchQuery} class="pl-10" />
							</div>
							{#if resourceTypes.length > 1}
								<!-- Height / border radius match `<Input>` so the two controls sit
								     flush beside each other. `min-w-[9rem]` + `max-w-[14rem]`
								     keeps the dropdown readable without letting long resource
								     type names stretch it past the card edge. -->
								<select
									id="{uid}-type-filter"
									name="type-filter"
									bind:value={typeFilter}
									aria-label="Filter by resource type"
									class="h-10 rounded-lg border border-input bg-background px-3 pr-8 text-sm ring-offset-background transition-[border-color,box-shadow] duration-fast ease-out hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-transparent sm:min-w-[9rem] sm:max-w-[14rem]"
								>
									<option value="">All types</option>
									{#each resourceTypes as type (type)}
										<option value={type}>{type}</option>
									{/each}
								</select>
							{/if}
						</div>

						<!-- Sort toggles -->
						<div class="flex items-center gap-1 mb-4 text-xs text-muted-foreground">
							<ArrowUpDown class="h-3.5 w-3.5" />
							<span>Sort by:</span>
							<button
								type="button"
								onclick={() => toggleSort('title')}
								class="px-2 py-0.5 rounded transition-colors {sortBy === 'title'
									? 'bg-primary/10 text-primary font-medium'
									: 'hover:bg-muted'}"
							>
								Title {sortBy === 'title' ? (sortAsc ? '↑' : '↓') : ''}
							</button>
							<button
								type="button"
								onclick={() => toggleSort('date')}
								class="px-2 py-0.5 rounded transition-colors {sortBy === 'date'
									? 'bg-primary/10 text-primary font-medium'
									: 'hover:bg-muted'}"
							>
								Date {sortBy === 'date' ? (sortAsc ? '↑' : '↓') : ''}
							</button>
							<button
								type="button"
								onclick={() => toggleSort('type')}
								class="px-2 py-0.5 rounded transition-colors {sortBy === 'type'
									? 'bg-primary/10 text-primary font-medium'
									: 'hover:bg-muted'}"
							>
								Type {sortBy === 'type' ? (sortAsc ? '↑' : '↓') : ''}
							</button>
						</div>
					{/if}

					{#if filteredItems.length === 0}
						<EmptyState message="No items match your filters" icon={Search} />
					{:else}
						<ul class="space-y-2">
							{#each paginatedItems as item (item._id || item.dre_id)}
								<CollectionItemRow {item} {showType} {showProject}>
									{#snippet extraMetadata()}
										{#if rowExtra}{@render rowExtra(item)}{/if}
									{/snippet}
								</CollectionItemRow>
							{/each}
						</ul>
						<Pagination
							{currentPage}
							totalItems={filteredItems.length}
							{itemsPerPage}
							onPageChange={(p) => (currentPage = p)}
						/>
					{/if}
				{/if}
			{/snippet}
		</CardContent>
	{/snippet}
</Card>
