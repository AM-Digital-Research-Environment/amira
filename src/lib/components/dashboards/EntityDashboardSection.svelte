<script lang="ts">
	/**
	 * Thin wrapper: loads precomputed entity-dashboard JSON + renders
	 * `<EntityDashboard>` with the layout declared in `ENTITY_LAYOUTS`.
	 *
	 * Pages use this to avoid hand-rolling the load/race/fallback dance every
	 * time. The section renders nothing until the JSON is in hand; if the file
	 * is missing (an entity without precompute yet), it stays silent — the
	 * page is expected to show the EntityItemsCard regardless.
	 *
	 * Pass a preloaded `data` prop to skip the internal fetch when the page
	 * already loaded the JSON (typically so it can hand `data.items` to the
	 * EntityItemsCard above). The internal fetch still runs if `data` is
	 * omitted.
	 */
	import { getEntityLayout, type EntityDashboardData, type EntityType } from './index';
	import EntityDashboard from './EntityDashboard.svelte';
	import { loadEntityDashboard } from '$lib/utils/loaders/entityDashboardLoader';
	import type { CollectionItem, EnrichedLocationsData } from '$lib/types';

	interface Props {
		entityType: EntityType;
		entityId: string;
		/** Items scoped to this entity; forwarded to the map-cluster popup. */
		items?: CollectionItem[];
		enrichedLocations?: EnrichedLocationsData | null;
		/** Preloaded dashboard JSON. If provided, the internal fetch is skipped. */
		data?: EntityDashboardData | null;
		class?: string;
	}

	let {
		entityType,
		entityId,
		items = [],
		enrichedLocations = undefined,
		data: externalData = undefined,
		class: className = ''
	}: Props = $props();

	const layout = $derived(getEntityLayout(entityType));
	let internalData = $state<EntityDashboardData | null>(null);
	let internalLoading = $state(false);

	$effect(() => {
		// Skip the fetch when the caller handed us preloaded JSON.
		if (externalData !== undefined) return;
		if (!entityId) {
			internalData = null;
			return;
		}
		const requested = entityId;
		internalLoading = true;
		loadEntityDashboard(entityType, requested).then((data) => {
			// Stale-response guard: don't clobber newer state.
			if (requested === entityId) {
				internalData = data;
				internalLoading = false;
			}
		});
	});

	const effectiveData = $derived(externalData !== undefined ? externalData : internalData);
	const showLoading = $derived(externalData === undefined && internalLoading);
</script>

{#if layout && effectiveData}
	<EntityDashboard {layout} data={effectiveData} {items} {enrichedLocations} class={className} />
{:else if showLoading}
	<p class="text-sm text-muted-foreground">Loading dashboard…</p>
{/if}
