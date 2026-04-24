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
import { SvelteMap } from 'svelte/reactivity';

const cache = new SvelteMap<string, EntityDashboardData | null>();
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const inflight: Map<string, Promise<EntityDashboardData | null>> = new Map();

function cacheKey(entityType: EntityType, id: string): string {
	return `${entityType}:${id}`;
}

export function fetchEntityDashboard(
	entityType: EntityType,
	id: string
): Promise<EntityDashboardData | null> {
	const key = cacheKey(entityType, id);
	if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
	const pending = inflight.get(key);
	if (pending) return pending;

	const promise = loadEntityDashboard(entityType, id)
		.then((data) => {
			cache.set(key, data);
			return data;
		})
		.finally(() => {
			inflight.delete(key);
		});
	inflight.set(key, promise);
	return promise;
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
		const cached = cache.get(key);
		if (cached !== undefined) {
			data = cached;
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
