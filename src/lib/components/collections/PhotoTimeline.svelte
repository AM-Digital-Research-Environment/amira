<script lang="ts">
	import type { CollectionItem } from '$lib/types';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import {
		getPreviewImage,
		getPrimaryDate,
		getDescriptiveTitle,
		getLocationLabel,
		type CardLabels
	} from './photoHelpers';

	interface Props {
		items: CollectionItem[];
		onSelect?: (item: CollectionItem) => void;
		/** Optional map from item._id → number of deduped records. When
		 *  >1, the thumbnail shows a small count badge. */
		countsById?: Map<string, number> | null;
		/** Optional label override map. When set, the thumbnail tooltip uses
		 *  the override title instead of the item's descriptive title. */
		labelsById?: Map<string, CardLabels> | null;
	}

	let { items, onSelect, countsById = null, labelsById = null }: Props = $props();

	interface YearGroup {
		year: number;
		items: CollectionItem[];
		cols: number;
	}

	/**
	 * Items with a parseable primary date, bucketed by year. Each group
	 * computes its own column count as ~sqrt(n) so dense years expand
	 * into a square-ish block instead of a tall tower — otherwise a
	 * single prolific year towers over sparse neighbours.
	 */
	let groups = $derived.by<YearGroup[]>(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const byYear = new Map<number, CollectionItem[]>();
		for (const item of items) {
			const date = getPrimaryDate(item);
			if (!date) continue;
			const y = date.getFullYear();
			if (!byYear.has(y)) byYear.set(y, []);
			byYear.get(y)!.push(item);
		}
		return Array.from(byYear.entries())
			.map(([year, list]) => ({
				year,
				items: list,
				cols: Math.max(1, Math.ceil(Math.sqrt(list.length)))
			}))
			.sort((a, b) => a.year - b.year);
	});

	let undatedCount = $derived(items.length - groups.reduce((sum, g) => sum + g.items.length, 0));

	let yearSpan = $derived.by(() => {
		if (groups.length === 0) return null;
		return { from: groups[0].year, to: groups[groups.length - 1].year };
	});

	/** Used to normalize the tick mark heights on the axis rail. */
	let maxCount = $derived(Math.max(1, ...groups.map((g) => g.items.length)));

	const THUMB = 72; // px — thumbnail side
	const GAP = 6; // px — gap between thumbs
</script>

<div class="timeline-shell" in:fade={{ duration: 200 }}>
	{#if groups.length === 0}
		<div class="timeline-empty">No items with a usable date in this collection.</div>
	{:else}
		<div class="timeline-scroller">
			<div class="timeline-track">
				{#each groups as group, groupIndex (group.year)}
					{@const columnWidth = group.cols * THUMB + (group.cols - 1) * GAP}
					<div
						class="timeline-column"
						style:min-width="{Math.max(columnWidth, 72)}px"
						in:fly={{ y: 8, duration: 320, delay: groupIndex * 20, easing: cubicOut }}
					>
						<!-- Year axis label (on top, as requested). -->
						<div class="timeline-head">
							<div class="timeline-year">{group.year}</div>
							<div class="timeline-count">
								{group.items.length}
								<span class="timeline-count-unit">
									{group.items.length === 1 ? 'photo' : 'photos'}
								</span>
							</div>
							<div
								class="timeline-tick"
								style:height="{6 + (group.items.length / maxCount) * 20}px"
								title="{group.items.length} photo{group.items.length === 1
									? ''
									: 's'} in {group.year}"
							></div>
						</div>

						<!-- Grid of thumbs, sqrt-column layout keeps tall years square. -->
						<div
							class="timeline-grid"
							style:grid-template-columns="repeat({group.cols}, {THUMB}px)"
							style:gap="{GAP}px"
						>
							{#each group.items as item, thumbIndex (item._id)}
								{@const preview = getPreviewImage(item)}
								{@const count = countsById?.get(item._id) ?? 1}
								{@const label =
									labelsById?.get(item._id)?.title?.trim() || getDescriptiveTitle(item)}
								{#if preview}
									<button
										type="button"
										class="timeline-thumb"
										onclick={() => onSelect?.(item)}
										title={`${label}${
											!labelsById?.get(item._id) && getLocationLabel(item)
												? ' — ' + getLocationLabel(item)
												: ''
										}${count > 1 ? ` (× ${count} records)` : ''}`}
										in:fade={{
											duration: 240,
											delay: groupIndex * 20 + Math.min(thumbIndex * 10, 200),
											easing: cubicOut
										}}
									>
										<img src={preview} alt={label} loading="lazy" draggable="false" />
										{#if count > 1}
											<span class="timeline-thumb-count">× {count}</span>
										{/if}
									</button>
								{/if}
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="timeline-footer">
			{#if yearSpan}
				<span>
					<strong>{yearSpan.to - yearSpan.from + 1}</strong> year{yearSpan.to - yearSpan.from === 0
						? ''
						: 's'} ({yearSpan.from}–{yearSpan.to})
				</span>
			{/if}
			{#if undatedCount > 0}
				<span class="timeline-footer-note">
					· {undatedCount} photo{undatedCount === 1 ? '' : 's'} without a date hidden
				</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.timeline-shell {
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
		background: hsl(var(--card));
		padding: 1rem;
	}

	.timeline-empty {
		padding: 2rem 1rem;
		text-align: center;
		color: hsl(var(--muted-foreground));
		font-size: var(--font-size-sm);
	}

	.timeline-scroller {
		overflow-x: auto;
		padding-bottom: 0.25rem;
		scrollbar-gutter: stable;
	}

	.timeline-track {
		display: flex;
		align-items: flex-start;
		gap: 1.25rem;
		padding: 0.25rem;
		min-height: 260px;
	}

	.timeline-column {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* Year axis sits on top so row heights don't cause it to float mid-column. */
	.timeline-head {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.125rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid hsl(var(--border));
	}

	.timeline-year {
		font-family: var(--font-display);
		font-size: var(--font-size-lg);
		font-weight: 600;
		color: hsl(var(--foreground));
		letter-spacing: var(--tracking-tight);
		line-height: 1;
	}

	.timeline-count {
		font-size: var(--font-size-xs);
		color: hsl(var(--muted-foreground));
		font-variant-numeric: tabular-nums;
	}
	.timeline-count-unit {
		opacity: 0.8;
	}

	.timeline-tick {
		width: 3px;
		background: hsl(var(--chart-1));
		border-radius: 2px;
		margin-top: 0.25rem;
	}

	.timeline-grid {
		display: grid;
		align-content: start;
	}

	.timeline-thumb {
		position: relative;
		padding: 0;
		width: 72px;
		height: 54px;
		border: 1px solid hsl(var(--border));
		border-radius: calc(var(--radius) - 4px);
		background: hsl(var(--muted));
		overflow: hidden;
		cursor: pointer;
		transition:
			border-color 160ms ease,
			transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.timeline-thumb-count {
		position: absolute;
		top: 2px;
		right: 2px;
		padding: 0 0.25rem;
		font-size: 0.55rem;
		font-weight: 600;
		background: hsl(var(--foreground) / 0.75);
		color: hsl(var(--background));
		border-radius: 999px;
	}
	.timeline-thumb:hover {
		border-color: hsl(var(--primary));
		transform: translateY(-1px) scale(1.05);
		z-index: 2;
	}
	.timeline-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.timeline-footer {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
		font-size: var(--font-size-xs);
		color: hsl(var(--foreground));
		padding: 0 0.25rem;
	}
	.timeline-footer-note {
		color: hsl(var(--muted-foreground));
	}
</style>
