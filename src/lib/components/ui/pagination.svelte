<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { tick } from 'svelte';

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

	let containerEl: HTMLDivElement | undefined = $state();

	// After a page change, scroll the user back to the top of the list so
	// they don't have to scroll up to see the new page. We pick the first
	// visible preceding sibling (skipping `hidden`/display:none wrappers
	// like the desktop-only table on mobile), and fall back to the parent
	// container. No-op when the list top is already in view.
	async function changePage(newPage: number) {
		onPageChange(newPage);
		await tick();
		if (!containerEl) return;
		let target: HTMLElement | null = null;
		let sibling = containerEl.previousElementSibling as HTMLElement | null;
		while (sibling) {
			if (sibling.offsetWidth > 0 || sibling.offsetHeight > 0) {
				target = sibling;
				break;
			}
			sibling = sibling.previousElementSibling as HTMLElement | null;
		}
		if (!target) target = containerEl.parentElement;
		if (!target) return;
		const rect = target.getBoundingClientRect();
		if (rect.top < 0) {
			target.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}
</script>

{#if totalPages > 1}
	<div
		bind:this={containerEl}
		class="flex items-center justify-between mt-6 pt-4 border-t border-border/60"
	>
		<p class="text-sm text-muted-foreground">
			Showing <span class="font-medium text-foreground">{startItem}–{endItem}</span> of
			<span class="font-medium text-foreground">{totalItems}</span>
		</p>
		<div class="flex items-center gap-1">
			<button
				onclick={() => changePage(currentPage - 1)}
				disabled={currentPage === 0}
				class="p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label="Previous page"
			>
				<ChevronLeft class="h-4 w-4" />
			</button>

			<span class="text-sm text-muted-foreground tabular-nums min-w-[4.5rem] text-center">
				<span class="font-medium text-foreground">{currentPage + 1}</span>
				<span class="opacity-60 mx-0.5">/</span>
				{totalPages}
			</span>

			<button
				onclick={() => changePage(currentPage + 1)}
				disabled={currentPage >= totalPages - 1}
				class="p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label="Next page"
			>
				<ChevronRight class="h-4 w-4" />
			</button>
		</div>
	</div>
{/if}
