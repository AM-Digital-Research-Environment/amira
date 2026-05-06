/**
 * Reactive state for a detail/list dual-view page.
 *
 * Centralises the URL-param ↔ state plumbing that every dual-view page
 * (research-items, research-sections, the entity-browse pages) duplicated
 * verbatim:
 *
 * 1. A `$state('')` selection key.
 * 2. A `$effect` that reads the URL query param and pushes it into the
 *    state on every navigation (deep-links, back/forward, in-app push).
 * 3. A `select(key)` writer that pushes to URL + scrolls to top.
 * 4. A `clear()` writer that drops the URL param + scrolls to top.
 *
 * The factory must be called from a component's `<script>` (top-level
 * setup) so the `$state` and `$effect` it sets up bind to that
 * component's lifecycle.
 *
 * Pages that have additional URL params (e.g. research-items also reads
 * `audience` / `method`) keep their own `$effect` for those — this
 * factory only owns the primary detail key.
 *
 * Usage:
 *
 *     const detail = createDetailListState({ paramName: 'section' });
 *     let selectedSectionData = $derived(
 *         sections.find((s) => s.name === detail.key) || null
 *     );
 *     ...
 *     <button onclick={() => detail.select(section.name)}>...</button>
 *     <BackToList onclick={() => detail.clear()} />
 */

import { page } from '$app/state';
import { createUrlSelection, scrollToTop } from '../urlSelection';

export interface DetailListStateOptions {
	/** URL query param name (e.g. `'id'`, `'section'`). */
	paramName: string;
	/**
	 * Whether `select()` and `clear()` scroll to top after the
	 * URL change. Defaults to true — every dual-view page wants this
	 * so the detail header isn't off-screen when you click into it.
	 */
	scroll?: boolean;
}

export interface DetailListState {
	/**
	 * Currently-selected key. Empty string in list view.
	 * Reactive — re-reads from `$page` on every navigation.
	 */
	readonly key: string;
	/** Push the value to the URL param and (by default) scroll to top. */
	select(key: string): void;
	/** Remove the URL param and (by default) scroll to top. */
	clear(): void;
}

export function createDetailListState(options: DetailListStateOptions): DetailListState {
	const { paramName, scroll = true } = options;
	const url = createUrlSelection(paramName);

	const key = $derived(page.url.searchParams.get(paramName) ?? '');

	return {
		get key() {
			return key;
		},
		select(value: string) {
			url.pushToUrl(value);
			if (scroll) scrollToTop();
		},
		clear() {
			url.removeFromUrl();
			if (scroll) scrollToTop();
		}
	};
}
