<script lang="ts">
	/**
	 * Wraps LocationMap (clustered points) and ChoroplethMap (country fill)
	 * behind a small Points/Countries toggle. Keeps the dashboard down to a
	 * single map card per entity instead of two near-identical ones.
	 *
	 * Choropleth data is aggregated from the same `LocationData[]` payload by
	 * summing counts per country — no separate precompute payload needed.
	 *
	 * The toggle is rendered via the `extraControls` snippet on the active
	 * map, so it sits next to the inner Globe button (single horizontal
	 * group) and goes fullscreen with the map frame.
	 */
	import { MapPin, Earth } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import LocationMap from './LocationMap.svelte';
	import ChoroplethMap from './ChoroplethMap.svelte';
	import type { LocationData } from './map/markerBuilder';
	import type { CollectionItem, EnrichedLocationsData } from '$lib/types';
	import type { ChoroplethDataPoint } from './ChoroplethMap.svelte';

	interface Props {
		data: LocationData[];
		items?: CollectionItem[];
		enrichedLocations?: EnrichedLocationsData | null;
		class?: string;
	}

	let { data, items = [], enrichedLocations = null, class: className = '' }: Props = $props();

	type View = 'points' | 'countries';
	let view = $state<View>('points');

	// Stable wrapper element used as the FullscreenControl target. Since
	// `{#if}{:else}` swaps unmount the active map (and its own frame), the
	// wrapper has to outlive both children — otherwise the browser exits
	// fullscreen the moment the user toggles the view.
	let outerFrame: HTMLDivElement | undefined = $state();

	// Lifted projection state — without this, swapping Points/Countries
	// silently resets the user's globe selection back to Mercator because
	// each child map mounts fresh.
	let isGlobe = $state(false);

	// Aggregate `LocationData[]` to country-level totals on demand. The
	// LocationMap distributes counts across precision levels (city / region /
	// country) and never double-counts, so re-summing by `country` is exact.
	let countryData = $derived.by<ChoroplethDataPoint[]>(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const m = new Map<string, number>();
		for (const d of data) {
			const c = (d.country || '').trim();
			if (!c) continue;
			m.set(c, (m.get(c) || 0) + (d.count || 0));
		}
		return Array.from(m, ([country, count]) => ({ country, count }));
	});
</script>

{#snippet viewToggle()}
	<div
		role="tablist"
		aria-label="Map view"
		class="inline-flex h-[30px] items-center rounded-md border border-border/60 bg-background/90 p-0.5 text-xs font-medium shadow-sm backdrop-blur-sm"
	>
		<button
			type="button"
			role="tab"
			aria-selected={view === 'points'}
			onclick={() => (view = 'points')}
			class={cn(
				'inline-flex items-center gap-1.5 rounded px-2 py-1 transition-colors',
				view === 'points'
					? 'bg-card text-foreground shadow-xs'
					: 'text-muted-foreground hover:text-foreground'
			)}
		>
			<MapPin class="h-3.5 w-3.5 shrink-0" />
			<span class="hidden sm:inline">Points</span>
		</button>
		<button
			type="button"
			role="tab"
			aria-selected={view === 'countries'}
			onclick={() => (view = 'countries')}
			class={cn(
				'inline-flex items-center gap-1.5 rounded px-2 py-1 transition-colors',
				view === 'countries'
					? 'bg-card text-foreground shadow-xs'
					: 'text-muted-foreground hover:text-foreground'
			)}
		>
			<Earth class="h-3.5 w-3.5 shrink-0" />
			<span class="hidden sm:inline">Countries</span>
		</button>
	</div>
{/snippet}

<div bind:this={outerFrame} class={className || 'h-full w-full'}>
	{#if view === 'points'}
		<LocationMap
			{data}
			{items}
			{enrichedLocations}
			class="h-full w-full"
			extraControls={viewToggle}
			fullscreenContainer={outerFrame ?? null}
			bind:isGlobe
		/>
	{:else}
		<ChoroplethMap
			data={countryData}
			class="h-full w-full"
			extraControls={viewToggle}
			fullscreenContainer={outerFrame ?? null}
			bind:isGlobe
		/>
	{/if}
</div>
