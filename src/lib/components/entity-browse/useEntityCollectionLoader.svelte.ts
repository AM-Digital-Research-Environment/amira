import { onMount } from 'svelte';
import { base } from '$app/paths';
import { ensureCollections } from '$lib/stores/data';

/**
 * Shared hook for entity-browse pages (people, projects, locations,
 * institutions, languages, subjects, genres, groups, resource-types,
 * research-sections). All of these:
 *
 * 1. Show a list view by default (no entity selected → load the full
 *    collections payload so list-page charts / counts / browse grids
 *    have data).
 * 2. Switch to a detail view when the URL carries a selection — at
 *    that point the per-entity precomputed JSON is enough; we want to
 *    *avoid* the ~13 MB collections fetch.
 *
 * The pattern lived inline as an `onMount` + `$effect` pair on every
 * page; this helper centralises it so we only have to think about it
 * in one place.
 *
 * @param hasSelection - Reactive getter that returns truthy when the
 *   page is in detail view (a selection exists). The hook re-runs on
 *   every change, so flipping back to falsy (e.g. user clears the
 *   selection) re-triggers the load.
 * @param onMountExtra - Optional side-effect to run alongside `onMount`
 *   (e.g. `loadWisskiUrls('persons')` on the people page).
 *
 * Must be called during component setup (top-level `<script>`).
 */
export function useEntityCollectionLoader(
	hasSelection: () => unknown,
	options: { onMountExtra?: () => void } = {}
): void {
	onMount(() => {
		options.onMountExtra?.();
		if (!hasSelection()) void ensureCollections(base);
	});
	$effect(() => {
		if (!hasSelection()) void ensureCollections(base);
	});
}
