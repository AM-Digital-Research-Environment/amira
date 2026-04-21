<script lang="ts">
	import type { CollectionItem } from '$lib/types';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { ChevronDown, SlidersHorizontal, X } from '@lucide/svelte';
	import { getPrimaryDate, getTopicLabels } from './photoHelpers';

	export type SortKey = 'year-desc' | 'year-asc' | 'title-asc' | 'title-desc';

	export interface PhotoFilterState {
		sort: SortKey;
		years: Set<number>;
		countries: Set<string>;
		topics: Set<string>;
	}

	interface Props {
		items: CollectionItem[];
		filters: PhotoFilterState;
		onChange: (next: PhotoFilterState) => void;
		/** Count of items after filters — shown in the header. */
		filteredCount: number;
	}

	let { items, filters, onChange, filteredCount }: Props = $props();

	let expanded = $state(false);

	/** Facet buckets derived from the input items (not the filtered subset,
	 *  so counts stay stable while users apply/un-apply filters). */
	let facets = $derived.by(() => {
		// Transient accumulators — not stored or observed outside this block,
		// so plain Maps are fine and SvelteMap overhead is unnecessary.
		/* eslint-disable svelte/prefer-svelte-reactivity */
		const years = new Map<number, number>();
		const countries = new Map<string, number>();
		const topics = new Map<string, number>();
		/* eslint-enable svelte/prefer-svelte-reactivity */
		for (const item of items) {
			const d = getPrimaryDate(item);
			if (d) years.set(d.getFullYear(), (years.get(d.getFullYear()) ?? 0) + 1);
			const country = item.location?.origin?.[0]?.l1;
			if (country) countries.set(country, (countries.get(country) ?? 0) + 1);
			for (const t of getTopicLabels(item, 8)) {
				topics.set(t, (topics.get(t) ?? 0) + 1);
			}
		}
		return {
			years: Array.from(years.entries()).sort((a, b) => a[0] - b[0]),
			countries: Array.from(countries.entries()).sort((a, b) => b[1] - a[1]),
			topics: Array.from(topics.entries())
				.sort((a, b) => b[1] - a[1])
				.slice(0, 16)
		};
	});

	let activeCount = $derived(filters.years.size + filters.countries.size + filters.topics.size);

	// Sets live inside the parent's $state-tracked filterState; their own
	// reactivity isn't observed, so plain Sets are correct here.
	/* eslint-disable svelte/prefer-svelte-reactivity */
	function toggleYear(y: number) {
		const next = new Set(filters.years);
		if (next.has(y)) next.delete(y);
		else next.add(y);
		onChange({ ...filters, years: next });
	}

	function toggleCountry(c: string) {
		const next = new Set(filters.countries);
		if (next.has(c)) next.delete(c);
		else next.add(c);
		onChange({ ...filters, countries: next });
	}

	function toggleTopic(t: string) {
		const next = new Set(filters.topics);
		if (next.has(t)) next.delete(t);
		else next.add(t);
		onChange({ ...filters, topics: next });
	}

	function clearFilters() {
		onChange({ ...filters, years: new Set(), countries: new Set(), topics: new Set() });
	}

	function setSort(sort: SortKey) {
		onChange({ ...filters, sort });
	}
	/* eslint-enable svelte/prefer-svelte-reactivity */

	const sortLabels: Record<SortKey, string> = {
		'year-desc': 'Newest first',
		'year-asc': 'Oldest first',
		'title-asc': 'Title A–Z',
		'title-desc': 'Title Z–A'
	};
</script>

<div class="facets">
	<div class="facets-bar">
		<button
			type="button"
			class="facets-toggle"
			onclick={() => (expanded = !expanded)}
			aria-expanded={expanded}
		>
			<SlidersHorizontal class="h-4 w-4" />
			<span>Filters</span>
			{#if activeCount > 0}
				<span class="facets-badge">{activeCount}</span>
			{/if}
			<ChevronDown class="h-4 w-4 facets-chevron" data-open={expanded} />
		</button>

		{#if activeCount > 0}
			<button
				type="button"
				class="facets-clear-inline"
				onclick={clearFilters}
				title="Clear {activeCount} active filter{activeCount === 1 ? '' : 's'}"
			>
				<X class="h-3 w-3" />
				Clear
			</button>
		{/if}

		<div class="facets-sort">
			<label for="facets-sort-select" class="facets-sort-label">Sort</label>
			<select
				id="facets-sort-select"
				class="facets-sort-select"
				value={filters.sort}
				onchange={(e) => setSort((e.currentTarget as HTMLSelectElement).value as SortKey)}
			>
				{#each Object.entries(sortLabels) as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
		</div>

		<div class="facets-count">
			<strong>{filteredCount.toLocaleString('en-GB')}</strong>
			<span>of {items.length.toLocaleString('en-GB')} photos</span>
		</div>
	</div>

	{#if expanded}
		<div class="facets-panel" transition:slide={{ duration: 200, easing: cubicOut }}>
			{#if activeCount > 0}
				<div class="facets-active">
					<button type="button" class="facets-clear" onclick={clearFilters}>
						<X class="h-3 w-3" />
						Clear all filters
					</button>
				</div>
			{/if}

			{#if facets.years.length > 0}
				<section class="facets-group">
					<h3 class="facets-group-title">Year</h3>
					<div class="facets-chips">
						{#each facets.years as [year, count] (year)}
							<button
								type="button"
								class="facets-chip"
								data-active={filters.years.has(year)}
								onclick={() => toggleYear(year)}
							>
								{year}
								<span class="facets-chip-count">{count}</span>
							</button>
						{/each}
					</div>
				</section>
			{/if}

			{#if facets.countries.length > 0}
				<section class="facets-group">
					<h3 class="facets-group-title">Country</h3>
					<div class="facets-chips">
						{#each facets.countries as [country, count] (country)}
							<button
								type="button"
								class="facets-chip"
								data-active={filters.countries.has(country)}
								onclick={() => toggleCountry(country)}
							>
								{country}
								<span class="facets-chip-count">{count}</span>
							</button>
						{/each}
					</div>
				</section>
			{/if}

			{#if facets.topics.length > 0}
				<section class="facets-group">
					<h3 class="facets-group-title">Subject / Tag</h3>
					<div class="facets-chips">
						{#each facets.topics as [topic, count] (topic)}
							<button
								type="button"
								class="facets-chip"
								data-active={filters.topics.has(topic)}
								onclick={() => toggleTopic(topic)}
							>
								{topic}
								<span class="facets-chip-count">{count}</span>
							</button>
						{/each}
					</div>
				</section>
			{/if}
		</div>
	{/if}
</div>

<style>
	.facets {
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
		background: hsl(var(--card));
		margin-bottom: 1rem;
	}

	.facets-bar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding: 0.625rem 0.875rem;
	}

	.facets-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		background: hsl(var(--muted));
		border: 1px solid hsl(var(--border));
		border-radius: calc(var(--radius) - 2px);
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: hsl(var(--foreground));
		cursor: pointer;
		transition: background 160ms ease;
	}
	.facets-toggle:hover {
		background: hsl(var(--muted) / 0.6);
	}

	.facets-clear-inline {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.625rem;
		background: transparent;
		border: 1px dashed hsl(var(--border));
		border-radius: calc(var(--radius) - 2px);
		font-size: var(--font-size-xs);
		color: hsl(var(--muted-foreground));
		cursor: pointer;
		transition:
			background 160ms ease,
			color 160ms ease,
			border-color 160ms ease;
	}
	.facets-clear-inline:hover {
		background: hsl(var(--destructive) / 0.08);
		color: hsl(var(--destructive));
		border-color: hsl(var(--destructive) / 0.5);
		border-style: solid;
	}

	.facets-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.375rem;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		border-radius: 999px;
		font-size: 0.625rem;
		font-weight: 700;
	}

	:global(.facets-chevron) {
		transition: transform 200ms ease;
	}
	:global(.facets-chevron[data-open='true']) {
		transform: rotate(180deg);
	}

	.facets-sort {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
	.facets-sort-label {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
		color: hsl(var(--muted-foreground));
	}
	.facets-sort-select {
		padding: 0.375rem 2rem 0.375rem 0.75rem;
		border: 1px solid hsl(var(--border));
		border-radius: calc(var(--radius) - 2px);
		background: hsl(var(--background));
		color: hsl(var(--foreground));
		font-size: var(--font-size-sm);
		cursor: pointer;
		appearance: none;
		background-image:
			linear-gradient(45deg, transparent 50%, hsl(var(--muted-foreground)) 50%),
			linear-gradient(135deg, hsl(var(--muted-foreground)) 50%, transparent 50%);
		background-position:
			calc(100% - 14px) 50%,
			calc(100% - 9px) 50%;
		background-size:
			5px 5px,
			5px 5px;
		background-repeat: no-repeat;
	}

	.facets-count {
		margin-left: auto;
		font-size: var(--font-size-sm);
		color: hsl(var(--muted-foreground));
	}
	.facets-count strong {
		color: hsl(var(--foreground));
	}

	.facets-panel {
		padding: 0.25rem 0.875rem 0.875rem;
		border-top: 1px solid hsl(var(--border));
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.facets-active {
		padding-top: 0.75rem;
	}

	.facets-clear {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--font-size-xs);
		color: hsl(var(--muted-foreground));
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}
	.facets-clear:hover {
		color: hsl(var(--foreground));
	}

	.facets-group-title {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
		color: hsl(var(--muted-foreground));
		margin-bottom: 0.5rem;
	}

	.facets-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.facets-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.625rem;
		background: hsl(var(--muted));
		border: 1px solid transparent;
		border-radius: 999px;
		font-size: var(--font-size-xs);
		color: hsl(var(--foreground));
		cursor: pointer;
		transition:
			background 140ms ease,
			border-color 140ms ease,
			color 140ms ease;
	}
	.facets-chip:hover {
		border-color: hsl(var(--border));
	}
	.facets-chip[data-active='true'] {
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		border-color: hsl(var(--primary));
	}

	.facets-chip-count {
		font-variant-numeric: tabular-nums;
		font-size: 0.625rem;
		opacity: 0.75;
	}
	.facets-chip[data-active='true'] .facets-chip-count {
		opacity: 0.9;
	}
</style>
