<script lang="ts">
	/**
	 * Generic per-entity dashboard grid.
	 *
	 * Accepts a layout (list of `ChartSlot`s) and a `data` map (chart-key → payload)
	 * and renders each slot through `<ChartSlot>`. The grid is the same 2-column
	 * pattern existing pages use, with `wide: true` slots spanning both columns.
	 *
	 * Filtering happens upstream via `shouldRenderSlot()`: slots without a
	 * renderer yet, slots with empty data, and slots whose `cond` rejects the
	 * data are omitted entirely — no empty cards, no "coming soon" stubs.
	 *
	 * When the visible layout contains a geography slot we auto-trigger the
	 * shared `ensureEnrichedLocations()` loader so the map reads the
	 * archive-wide Wikidata geo file without the calling page having to care.
	 */
	import ChartSlot from './ChartSlot.svelte';
	import {
		shouldRenderSlot,
		type EntityLayout,
		type EntityDashboardData
	} from './entityDashboardLayouts';
	import { cn } from '$lib/utils/cn';
	import type { CollectionItem, EnrichedLocationsData } from '$lib/types';
	import { base } from '$app/paths';
	import {
		ensureEnrichedLocations,
		enrichedLocations as enrichedLocationsStore
	} from '$lib/stores/data';

	interface Props {
		layout: EntityLayout;
		data: EntityDashboardData;
		/** Collection items scoped to the current entity. Passed to the map
		 * slot so popup contents can render a clickable list of documents
		 * at each cluster. Optional — the map falls back to a count-only
		 * popup if the page doesn't have the raw items handy. */
		items?: CollectionItem[];
		/** Override the shared enriched-locations store for this dashboard.
		 * Leave undefined to consume the shared singleton, which is auto-
		 * populated by `ensureEnrichedLocations()` the first time a geography
		 * slot becomes visible anywhere in the app. */
		enrichedLocations?: EnrichedLocationsData | null;
		class?: string;
	}

	let {
		layout,
		data,
		items = [],
		enrichedLocations = undefined,
		class: className = ''
	}: Props = $props();

	let visibleSlots = $derived.by(() =>
		layout.charts.filter((slot) => shouldRenderSlot(slot, data))
	);

	/** True when any visible slot needs the Wikidata geo lookup. */
	let needsEnrichedLocations = $derived(
		visibleSlots.some(
			(s) => s.chart === 'locations' || s.chart === 'geoFlows' || s.chart === 'choropleth'
		)
	);

	// Lazily trigger the shared loader the first time a location-bearing
	// dashboard is rendered. `ensureEnrichedLocations()` memoises internally
	// so multiple dashboards share a single fetch.
	$effect(() => {
		if (needsEnrichedLocations && enrichedLocations === undefined) {
			ensureEnrichedLocations(base);
		}
	});

	/** Effective enriched-locations value: explicit prop > shared store. */
	let effectiveEnriched = $derived(
		enrichedLocations !== undefined ? enrichedLocations : $enrichedLocationsStore
	);
</script>

{#if visibleSlots.length > 0}
	<div class={cn('entity-dashboard-grid', className)}>
		{#each visibleSlots as slot (slot.chart)}
			<div class={slot.wide ? 'slot-wide' : 'slot-default'}>
				<ChartSlot {slot} data={data[slot.chart]} enrichedLocations={effectiveEnriched} {items} />
			</div>
		{/each}
	</div>
{/if}

<style>
	.entity-dashboard-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1.5rem;
		min-width: 0;
	}

	.entity-dashboard-grid > :global(*) {
		min-width: 0;
		max-width: 100%;
	}

	@media (min-width: 1024px) {
		.entity-dashboard-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.slot-wide {
			grid-column: span 2 / span 2;
		}
	}
</style>
