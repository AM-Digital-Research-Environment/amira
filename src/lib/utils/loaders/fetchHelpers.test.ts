import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { fetchJSON, fetchJSONWithFallback } from './fetchHelpers';

const originalFetch = globalThis.fetch;
const originalConsoleWarn = console.warn;

function mockFetchOk(body: unknown): void {
	globalThis.fetch = vi.fn().mockResolvedValue({
		ok: true,
		status: 200,
		json: async () => body
	}) as typeof fetch;
}

function mockFetchStatus(status: number): void {
	globalThis.fetch = vi.fn().mockResolvedValue({
		ok: false,
		status,
		json: async () => ({})
	}) as typeof fetch;
}

function mockFetchThrows(message: string): void {
	globalThis.fetch = vi.fn().mockRejectedValue(new Error(message)) as typeof fetch;
}

beforeEach(() => {
	globalThis.fetch = originalFetch;
	console.warn = vi.fn();
});

describe('fetchJSON', () => {
	it('returns parsed JSON on a 200 response', async () => {
		mockFetchOk({ hello: 'world' });
		expect(await fetchJSON<{ hello: string }>('/x.json')).toEqual({ hello: 'world' });
	});

	it('applies the transform when provided', async () => {
		mockFetchOk({ a: 1, b: 2 });
		const result = await fetchJSON<number, { a: number; b: number }>('/x.json', {
			transform: (raw) => raw.a + raw.b
		});
		expect(result).toBe(3);
	});

	it('returns null on a non-OK response', async () => {
		mockFetchStatus(500);
		expect(await fetchJSON('/x.json')).toBeNull();
	});

	it('returns null on a network error', async () => {
		mockFetchThrows('boom');
		expect(await fetchJSON('/x.json')).toBeNull();
	});

	it('stays silent by default on failure', async () => {
		mockFetchStatus(404);
		await fetchJSON('/x.json');
		expect(console.warn).not.toHaveBeenCalled();
	});

	it('warns on every failure when warnLevel is "always"', async () => {
		mockFetchStatus(404);
		await fetchJSON('/x.json', { warnLevel: 'always' });
		expect(console.warn).toHaveBeenCalled();
	});

	it('skips the warning for 404 when warnLevel is "non-404"', async () => {
		mockFetchStatus(404);
		await fetchJSON('/x.json', { warnLevel: 'non-404' });
		expect(console.warn).not.toHaveBeenCalled();
	});

	it('warns for non-404 failures when warnLevel is "non-404"', async () => {
		mockFetchStatus(500);
		await fetchJSON('/x.json', { warnLevel: 'non-404' });
		expect(console.warn).toHaveBeenCalled();
	});
});

describe('fetchJSONWithFallback', () => {
	it('returns parsed JSON when the response is OK', async () => {
		mockFetchOk([1, 2, 3]);
		expect(await fetchJSONWithFallback<number[]>('/x.json', [])).toEqual([1, 2, 3]);
	});

	it('returns the fallback when the response is missing', async () => {
		mockFetchStatus(404);
		expect(await fetchJSONWithFallback<number[]>('/x.json', [])).toEqual([]);
	});

	it('returns the fallback on a network error', async () => {
		mockFetchThrows('offline');
		expect(await fetchJSONWithFallback<Record<string, number>>('/x.json', { fallback: 1 })).toEqual(
			{
				fallback: 1
			}
		);
	});
});

// Restore globals after the suite.
afterAll(() => {
	globalThis.fetch = originalFetch;
	console.warn = originalConsoleWarn;
});
