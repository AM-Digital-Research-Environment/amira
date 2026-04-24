/**
 * EntityDashboard public API.
 *
 * See `entityDashboardLayouts.ts` for the layout system and
 * `src/lib/utils/loaders/entityDashboardLoader.ts` for the data loader.
 */

export { default as EntityDashboard } from './EntityDashboard.svelte';
export { default as EntityDashboardSection } from './EntityDashboardSection.svelte';
export { default as ChartSlot } from './ChartSlot.svelte';
export {
	ENTITY_LAYOUTS,
	CHART_METADATA,
	NOT_YET_IMPLEMENTED,
	getEntityLayout,
	showsUniversityFilter,
	shouldRenderSlot,
	type ChartKey,
	type ChartSlot as ChartSlotConfig,
	type EntityType,
	type EntityLayout,
	type EntityDashboardData
} from './entityDashboardLayouts';
