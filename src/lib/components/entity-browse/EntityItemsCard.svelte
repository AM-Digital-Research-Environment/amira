<script lang="ts">
	import {
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		Badge,
		Pagination,
		CollectionItemRow
	} from '$lib/components/ui';
	import { FileText } from '@lucide/svelte';
	import type { CollectionItem } from '$lib/types';
	import { paginate } from '$lib/utils/pagination';
	import { DEFAULT_ITEMS_PER_PAGE } from '$lib/utils/constants';

	interface Props {
		items: CollectionItem[];
		title?: string;
		showType?: boolean;
		showProject?: boolean;
		itemsPerPage?: number;
		emptyMessage?: string;
	}

	let {
		items,
		title = 'Research Items',
		showType = true,
		showProject = true,
		itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
		emptyMessage = 'No research items associated.'
	}: Props = $props();

	let currentPage = $state(0);
	let paginated = $derived(paginate(items, currentPage, itemsPerPage));

	// Reset to page 0 when the item list changes (e.g. selection change).
	$effect(() => {
		items;
		currentPage = 0;
	});
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
								{#snippet children()}{items.length}{/snippet}
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
					<ul class="space-y-2">
						{#each paginated as item (item._id || item.dre_id)}
							<CollectionItemRow {item} {showType} {showProject} />
						{/each}
					</ul>
					<Pagination
						{currentPage}
						totalItems={items.length}
						{itemsPerPage}
						onPageChange={(p) => (currentPage = p)}
					/>
				{/if}
			{/snippet}
		</CardContent>
	{/snippet}
</Card>
