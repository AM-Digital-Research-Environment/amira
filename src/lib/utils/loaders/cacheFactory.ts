/**
 * Lazy-loader factories — memoised async operations with inflight dedup.
 *
 * Two patterns recur across the codebase:
 *
 *   1. **Singleton** ("fetch this once on demand and remember the promise").
 *      `stores/data.ts` uses this for `ensureCollections()` and
 *      `ensureEnrichedLocations()` — the result is communicated through
 *      writable stores, the promise itself just gates "have we kicked off
 *      the fetch yet?"
 *
 *   2. **Keyed** ("fetch by key, cache the value, dedupe in-flight calls").
 *      `wisskiUrl.svelte.ts` does this per category, and
 *      `entityDetailState.svelte.ts` per (entity-type, id) pair.
 *
 * Both are tiny on their own but were copy-pasted four times with subtle
 * variations. Centralising them here makes the semantics testable and the
 * call sites one-liners.
 */

import { SvelteMap } from 'svelte/reactivity';

// ---------------------------------------------------------------------------
// Singleton: memoise a single async operation
// ---------------------------------------------------------------------------

export interface OnceLoader<T> {
	/** Trigger the load (idempotent). Subsequent calls return the same promise. */
	fetch(): Promise<T>;
	/** Whether `fetch()` has been called at least once (the promise may still
	 *  be resolving). */
	isLoaded(): boolean;
	/** Drop the cached promise so the next `fetch()` re-runs the loader.
	 *  Mainly useful for tests. */
	reset(): void;
}

export function createOnceLoader<T>(loader: () => Promise<T>): OnceLoader<T> {
	let promise: Promise<T> | null = null;
	return {
		fetch() {
			if (!promise) promise = loader();
			return promise;
		},
		isLoaded() {
			return promise !== null;
		},
		reset() {
			promise = null;
		}
	};
}

// ---------------------------------------------------------------------------
// Keyed: per-key cache + inflight-promise dedup
// ---------------------------------------------------------------------------

export interface LazyLoader<TKey, TValue> {
	/** Fetch `key`, returning a cached value if present, the inflight promise
	 *  if a fetch is in progress, or kicking off a fresh load otherwise. */
	fetch(key: TKey): Promise<TValue>;
	/** Whether the cache holds a resolved value for `key` (including a null
	 *  value, which is distinct from "never fetched"). */
	has(key: TKey): boolean;
	/** Synchronous read; returns `undefined` for keys that have never been
	 *  fetched OR that resolved to `undefined`. Use `has` to disambiguate. */
	get(key: TKey): TValue | undefined;
	/** Drop all cached values and inflight promises. */
	clear(): void;
}

export interface CreateLazyLoaderOptions {
	/** Use a `SvelteMap` for the cache. Reads inside Svelte 5 `$derived` /
	 *  `$effect` blocks then automatically re-run when an entry lands.
	 *  Default `false` (plain `Map`). */
	reactive?: boolean;
}

export function createLazyLoader<TKey, TValue>(
	loader: (key: TKey) => Promise<TValue>,
	options: CreateLazyLoaderOptions = {}
): LazyLoader<TKey, TValue> {
	const cache: Map<TKey, TValue> = options.reactive
		? (new SvelteMap<TKey, TValue>() as unknown as Map<TKey, TValue>)
		: new Map<TKey, TValue>();
	// Inflight tracking is never read reactively — a plain Map is fine.
	const inflight = new Map<TKey, Promise<TValue>>();

	return {
		fetch(key) {
			if (cache.has(key)) return Promise.resolve(cache.get(key) as TValue);
			const pending = inflight.get(key);
			if (pending) return pending;

			const promise = loader(key)
				.then((value) => {
					cache.set(key, value);
					return value;
				})
				.finally(() => {
					inflight.delete(key);
				});
			inflight.set(key, promise);
			return promise;
		},
		has(key) {
			return cache.has(key);
		},
		get(key) {
			return cache.get(key);
		},
		clear() {
			cache.clear();
			inflight.clear();
		}
	};
}
