<script lang="ts">
	/**
	 * Tiny year-by-year sparkline of items that share the current item's
	 * project. Highlights the current item's year so the user can see at a
	 * glance how this item sits within the project's overall timeline.
	 *
	 * Uses inline SVG instead of the full ECharts Timeline component because:
	 *   1. Sibling sparklines render as one card among many on the item page;
	 *      ECharts is heavy for a strip that's barely 60px tall.
	 *   2. The data shape is trivial — `[{year, count, current}]` — so we
	 *      don't need ECharts' axis-tick logic.
	 *
	 * Source data comes from `$allCollections` (already loaded by the
	 * research-items page on mount). Pages that haven't loaded collections
	 * pass an empty `siblings` array; the component renders nothing.
	 */
	import { Card, CardHeader, CardTitle, CardContent, Badge } from '$lib/components/ui';
	import { Calendar } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { CollectionItem } from '$lib/types';
	import { extractItemYear } from '$lib/utils/transforms/dates';
	import { researchItemUrl } from '$lib/utils/urls';
	import { getItemTitle } from '$lib/utils/helpers';

	interface Props {
		/** All items belonging to the current item's project (siblings,
		 * including the current one). The page is responsible for filtering. */
		siblings: CollectionItem[];
		/** The currently-displayed item, so we can highlight its year. */
		currentItem: CollectionItem;
		projectName?: string | null;
	}

	let { siblings, currentItem, projectName }: Props = $props();

	const currentYear = $derived(extractItemYear(currentItem));

	let bins = $derived.by(() => {
		const map = new SvelteMap<number, CollectionItem[]>();
		for (const item of siblings) {
			const year = extractItemYear(item);
			if (year == null) continue;
			const bucket = map.get(year) ?? [];
			bucket.push(item);
			map.set(year, bucket);
		}
		return Array.from(map.entries())
			.sort(([a], [b]) => a - b)
			.map(([year, items]) => ({ year, count: items.length, items }));
	});

	const maxCount = $derived(bins.length ? Math.max(...bins.map((b) => b.count)) : 0);
	const yearSpan = $derived(bins.length ? bins[bins.length - 1].year - bins[0].year : 0);

	// Tooltip / hovered bar.
	let hoveredYear = $state<number | null>(null);
	let hoveredItems = $derived.by(() => {
		if (hoveredYear == null) return [];
		const bin = bins.find((b) => b.year === hoveredYear);
		return bin?.items.slice(0, 6) ?? [];
	});

	// Layout tuning.
	const HEIGHT = 56;
	const BAR_GAP = 1;

	const visible = $derived(siblings.length >= 2 && bins.length > 0);
</script>

{#if visible}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}
							<span class="flex items-center gap-2">
								<Calendar class="h-5 w-5 text-primary" />
								Project timeline
								<Badge variant="secondary">
									{#snippet children()}{siblings.length}{/snippet}
								</Badge>
							</span>
						{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<p class="mb-2 text-xs text-muted-foreground">
						Items per year in
						{projectName ? `“${projectName}”` : 'this project'}{currentYear != null
							? ` — current item highlighted at ${currentYear}.`
							: '.'}
					</p>

					<!-- Sparkline. CSS grid lays bars out evenly; height is mapped from
					     count, with a 4px floor so even single-item years remain
					     clickable. -->
					<div class="sparkline" style="--bar-gap: {BAR_GAP}px;">
						{#each bins as bin (bin.year)}
							{@const heightPct = maxCount === 0 ? 0 : (bin.count / maxCount) * 100}
							<button
								type="button"
								class="bar {currentYear === bin.year ? 'is-current' : ''}"
								style="height: {Math.max(4, (heightPct / 100) * HEIGHT)}px"
								onmouseenter={() => (hoveredYear = bin.year)}
								onmouseleave={() => (hoveredYear = null)}
								onfocus={() => (hoveredYear = bin.year)}
								onblur={() => (hoveredYear = null)}
								aria-label="{bin.count} item{bin.count === 1 ? '' : 's'} in {bin.year}"
							></button>
						{/each}
					</div>

					<!-- Year-axis labels: first / current / last. With dense year ranges
					     a full axis would clutter; three anchor labels are enough to
					     orient the user. -->
					{#if bins.length > 0}
						<div class="mt-1 flex justify-between text-2xs text-muted-foreground tabular-nums">
							<span>{bins[0].year}</span>
							{#if yearSpan > 4 && currentYear != null && currentYear !== bins[0].year && currentYear !== bins[bins.length - 1].year}
								<span class="font-semibold text-primary">{currentYear}</span>
							{/if}
							<span>{bins[bins.length - 1].year}</span>
						</div>
					{/if}

					<!-- Hover preview. Surfaces the first six titles in the hovered
					     year so users can navigate sideways without scrolling the
					     full project items list. -->
					{#if hoveredYear != null && hoveredItems.length > 0}
						<div class="mt-3 rounded-lg border border-border/60 bg-muted/30 p-2 text-xs">
							<p class="mb-1 font-medium text-foreground">
								{hoveredYear}
								<span class="text-muted-foreground"
									>·
									{hoveredItems.length === bins.find((b) => b.year === hoveredYear)?.count
										? `${hoveredItems.length} item${hoveredItems.length === 1 ? '' : 's'}`
										: `${hoveredItems.length} of ${bins.find((b) => b.year === hoveredYear)?.count}`}</span
								>
							</p>
							<ul class="space-y-0.5">
								{#each hoveredItems as item (item._id || item.dre_id)}
									{@const isCurrent =
										(item._id || item.dre_id) === (currentItem._id || currentItem.dre_id)}
									<li>
										{#if isCurrent}
											<span class="font-semibold text-primary"
												>{getItemTitle(item)}
												<span class="text-2xs text-muted-foreground">(this)</span></span
											>
										{:else}
											<a
												href={researchItemUrl(item._id || item.dre_id)}
												class="text-foreground hover:text-primary transition-colors"
											>
												{getItemTitle(item)}
											</a>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}

<style>
	.sparkline {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		align-items: end;
		gap: var(--bar-gap, 1px);
		height: 56px;
		padding: 0;
	}
	.bar {
		all: unset;
		display: block;
		min-height: 4px;
		background: hsl(var(--chart-1));
		opacity: 0.6;
		border-radius: 1px;
		cursor: pointer;
		transition:
			opacity 120ms ease-out,
			transform 120ms ease-out;
	}
	.bar:hover,
	.bar:focus-visible {
		opacity: 1;
		outline: 2px solid hsl(var(--ring));
		outline-offset: 1px;
	}
	.bar.is-current {
		background: hsl(var(--primary));
		opacity: 1;
	}
</style>
