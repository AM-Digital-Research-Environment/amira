import { describe, it, expect, vi } from 'vitest';
import { createOnceLoader, createLazyLoader } from './cacheFactory';

describe('createOnceLoader', () => {
	it('runs the loader once across multiple fetches', async () => {
		const loader = vi.fn(async () => 'value');
		const once = createOnceLoader(loader);
		const a = once.fetch();
		const b = once.fetch();
		await Promise.all([a, b]);
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it('returns the same promise to concurrent callers', () => {
		const once = createOnceLoader(async () => 1);
		expect(once.fetch()).toBe(once.fetch());
	});

	it('reports isLoaded true after the first fetch is initiated', () => {
		const once = createOnceLoader(async () => 1);
		expect(once.isLoaded()).toBe(false);
		once.fetch();
		expect(once.isLoaded()).toBe(true);
	});

	it('reset() forces the next fetch to re-run the loader', async () => {
		const loader = vi.fn(async () => 'value');
		const once = createOnceLoader(loader);
		await once.fetch();
		once.reset();
		await once.fetch();
		expect(loader).toHaveBeenCalledTimes(2);
	});
});

describe('createLazyLoader', () => {
	it('caches values by key', async () => {
		const loader = vi.fn(async (key: string) => `value:${key}`);
		const lazy = createLazyLoader(loader);
		expect(await lazy.fetch('a')).toBe('value:a');
		expect(await lazy.fetch('a')).toBe('value:a');
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it('runs the loader once per distinct key', async () => {
		const loader = vi.fn(async (key: string) => key.toUpperCase());
		const lazy = createLazyLoader(loader);
		await lazy.fetch('a');
		await lazy.fetch('b');
		await lazy.fetch('a');
		expect(loader).toHaveBeenCalledTimes(2);
	});

	it('dedupes inflight requests for the same key', async () => {
		let resolveLoader: (value: string) => void = () => {};
		const loader = vi.fn(
			() =>
				new Promise<string>((resolve) => {
					resolveLoader = resolve;
				})
		);
		const lazy = createLazyLoader(loader);
		const p1 = lazy.fetch('k');
		const p2 = lazy.fetch('k');
		expect(loader).toHaveBeenCalledTimes(1);
		resolveLoader('done');
		expect(await p1).toBe('done');
		expect(await p2).toBe('done');
	});

	it('caches null values without re-fetching', async () => {
		const loader = vi.fn(async () => null);
		const lazy = createLazyLoader<string, null>(loader);
		await lazy.fetch('k');
		await lazy.fetch('k');
		expect(loader).toHaveBeenCalledTimes(1);
		expect(lazy.has('k')).toBe(true);
		expect(lazy.get('k')).toBeNull();
	});

	it('clear() drops cached and inflight state', async () => {
		const loader = vi.fn(async (k: string) => `value:${k}`);
		const lazy = createLazyLoader(loader);
		await lazy.fetch('a');
		expect(lazy.has('a')).toBe(true);
		lazy.clear();
		expect(lazy.has('a')).toBe(false);
		await lazy.fetch('a');
		expect(loader).toHaveBeenCalledTimes(2);
	});

	it('honours the reactive option (SvelteMap-backed cache)', async () => {
		const lazy = createLazyLoader(async (k: string) => k, { reactive: true });
		await lazy.fetch('x');
		// We can't observe Svelte 5 runes from outside a component, but the
		// cache contract should behave identically to the plain-Map variant.
		expect(lazy.has('x')).toBe(true);
		expect(lazy.get('x')).toBe('x');
	});
});
