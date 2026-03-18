<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';

	interface Props {
		currentPage: number;
		totalItems: number;
		itemsPerPage: number;
		onPageChange: (page: number) => void;
	}

	let { currentPage, totalItems, itemsPerPage, onPageChange }: Props = $props();

	let totalPages = $derived(Math.ceil(totalItems / itemsPerPage));
	let startItem = $derived(currentPage * itemsPerPage + 1);
	let endItem = $derived(Math.min((currentPage + 1) * itemsPerPage, totalItems));
</script>

{#if totalPages > 1}
	<div class="flex items-center justify-between mt-6 pt-4 border-t">
		<p class="text-sm text-muted-foreground">
			Showing {startItem}–{endItem} of {totalItems}
		</p>
		<div class="flex items-center gap-2">
			<button
				onclick={() => onPageChange(currentPage - 1)}
				disabled={currentPage === 0}
				class="p-2 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
				aria-label="Previous page"
			>
				<ChevronLeft class="h-4 w-4" />
			</button>

			<span class="text-sm text-muted-foreground min-w-[80px] text-center">
				{currentPage + 1} / {totalPages}
			</span>

			<button
				onclick={() => onPageChange(currentPage + 1)}
				disabled={currentPage >= totalPages - 1}
				class="p-2 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
				aria-label="Next page"
			>
				<ChevronRight class="h-4 w-4" />
			</button>
		</div>
	</div>
{/if}
