<script lang="ts" generics="L, R">
	/**
	 * Side-by-side pair of `ChartCard`s with empty-state fallbacks.
	 *
	 * Both compare flows (projects, entities) repeat the same
	 * ChartCard + #if data.length>0 + EmptyState pattern five times. This
	 * component takes the data + a title for each side and a snippet that
	 * renders the chart given non-empty data, so the call site shrinks to
	 * a single block per chart family.
	 */
	import type { Snippet } from 'svelte';
	import { ChartCard, EmptyState } from '$lib/components/ui';
	import { FileQuestion } from '@lucide/svelte';

	interface Props {
		leftTitle: string;
		rightTitle: string;
		leftData: L[];
		rightData: R[];
		/** Tailwind h-chart-* token. Defaults to `h-chart-md`. */
		contentHeight?: string;
		emptyMessage?: string;
		left: Snippet<[L[]]>;
		right: Snippet<[R[]]>;
	}

	let {
		leftTitle,
		rightTitle,
		leftData,
		rightData,
		contentHeight = 'h-chart-md',
		emptyMessage = 'No data',
		left,
		right
	}: Props = $props();
</script>

<div class="grid gap-6 lg:grid-cols-2">
	<ChartCard title={leftTitle} {contentHeight}>
		{#if leftData.length > 0}
			{@render left(leftData)}
		{:else}
			<EmptyState message={emptyMessage} icon={FileQuestion} />
		{/if}
	</ChartCard>

	<ChartCard title={rightTitle} {contentHeight}>
		{#if rightData.length > 0}
			{@render right(rightData)}
		{:else}
			<EmptyState message={emptyMessage} icon={FileQuestion} />
		{/if}
	</ChartCard>
</div>
