/**
 * Reactive state for an entity detail view.
 *
 * Wraps `loadEntityDashboard()` + the stale-response race guard + a memoised
 * per-(type, id) cache so multiple sections on the same page never re-fetch
 * the same JSON. Keeps the URL-param → fetched-data plumbing out of each
 * entity page.
 *
 * Usage:
 *
 *     const detail = createEntityDetailState('subject', () => selectedName);
 *     let items = $derived(detail.items);
 *     let data = $derived(detail.data);
 *     ...
 *     <EntityDashboardSection data={detail.data} ... />
 */

import type { EntityDashboardData, EntityType } from '$lib/components/dashboards';
import type { CollectionItem } from '$lib/types';
import { loadEntityDashboard } from './entityDashboardLoader';
import { createLazyLoader } from './cacheFactory';

function cacheKey(entityType: EntityType, id: string): string {
	return `${entityType}:${id}`;
}

const dashboardLoader = createLazyLoader<string, EntityDashboardData | null>(
	async (key) => {
		const [type, id] = key.split(':') as [EntityType, string];
		return loadEntityDashboard(type, id);
	},
	{ reactive: true }
);

export function fetchEntityDashboard(
	entityType: EntityType,
	id: string
): Promise<EntityDashboardData | null> {
	return dashboardLoader.fetch(cacheKey(entityType, id));
}

export interface EntityDetailState {
	readonly data: EntityDashboardData | null;
	readonly loading: boolean;
	readonly items: CollectionItem[];
}

/**
 * Create a reactive wrapper around the per-entity JSON for use inside a
 * Svelte component. Both accessors are read reactively, so pages can pass
 * `() => viewMode === 'tags' ? 'tag' : 'subject'` for dynamic types and
 * `() => selectedName` for the id — the loader re-fires whenever either
 * changes.
 */
export function createEntityDetailState(
	entityType: EntityType | (() => EntityType),
	getId: () => string
): EntityDetailState {
	const resolveType = typeof entityType === 'function' ? entityType : () => entityType;

	let data = $state<EntityDashboardData | null>(null);
	let loading = $state(false);

	$effect(() => {
		const id = getId();
		const type = resolveType();
		if (!id) {
			data = null;
			loading = false;
			return;
		}
		const key = cacheKey(type, id);
		if (dashboardLoader.has(key)) {
			data = dashboardLoader.get(key) ?? null;
			loading = false;
			return;
		}
		loading = true;
		fetchEntityDashboard(type, id).then((fetched) => {
			// Stale-response guard: only apply if (type, id) are still current.
			if (getId() === id && resolveType() === type) {
				data = fetched;
				loading = false;
			}
		});
	});

	return {
		get data() {
			return data;
		},
		get loading() {
			return loading;
		},
		get items() {
			const raw = (data as { items?: unknown } | null)?.items;
			return Array.isArray(raw) ? (raw as CollectionItem[]) : [];
		}
	};
}
