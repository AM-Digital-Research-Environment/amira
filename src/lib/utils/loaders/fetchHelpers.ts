/**
 * Shared fetch + JSON-parse helper for loaders.
 *
 * Loaders consistently want one of two failure modes: "this file is OK to
 * be missing" (return null / empty) and "this file is required" (throw).
 * Before this helper, every loader hand-rolled the try → response.ok →
 * json → maybe-warn dance with subtle differences (some warned, some
 * didn't, some treated 404 specially). Centralising the variation here
 * lets each loader become a one-liner.
 */

export type WarnLevel = 'silent' | 'always' | 'non-404';

export interface FetchJsonOptions<TRaw, T> {
	/** Transform raw JSON into the desired shape (e.g. `transformMongoJSON`). */
	transform?: (raw: TRaw) => T;
	/**
	 * Logging policy when the fetch fails or the response is not OK.
	 *  - `'silent'` (default) — never log. Use for files that may be absent
	 *    on a fresh build (embeddings, etc.).
	 *  - `'always'` — log every non-OK response and every thrown error.
	 *  - `'non-404'` — log non-404 failures only; treat 404 as expected.
	 */
	warnLevel?: WarnLevel;
	/** Optional human-readable label used in warning messages instead of the
	 *  raw path (useful when the path includes a long content hash). */
	contextLabel?: string;
}

function maybeWarn(message: string, level: WarnLevel, status?: number): void {
	if (level === 'silent') return;
	if (level === 'non-404' && status === 404) return;
	console.warn(message);
}

/**
 * Fetch a URL and parse JSON. Returns `null` on any failure (network
 * error, non-OK status, parse failure).
 */
export async function fetchJSON<T, TRaw = unknown>(
	path: string,
	options: FetchJsonOptions<TRaw, T> = {}
): Promise<T | null> {
	const { transform, warnLevel = 'silent' } = options;
	const label = options.contextLabel ?? path;
	let response: Response;
	try {
		response = await fetch(path);
	} catch (err) {
		maybeWarn(`Error loading ${label}: ${(err as Error).message}`, warnLevel);
		return null;
	}
	if (!response.ok) {
		maybeWarn(`Failed to load ${label}: ${response.status}`, warnLevel, response.status);
		return null;
	}
	try {
		const raw = (await response.json()) as TRaw;
		return transform ? transform(raw) : (raw as unknown as T);
	} catch (err) {
		maybeWarn(`Error parsing ${label}: ${(err as Error).message}`, warnLevel);
		return null;
	}
}

/**
 * Like `fetchJSON` but returns the supplied `fallback` instead of `null`
 * when anything goes wrong. Use when downstream code can't sensibly
 * handle null and prefers an empty record / array.
 */
export async function fetchJSONWithFallback<T, TRaw = unknown>(
	path: string,
	fallback: T,
	options: FetchJsonOptions<TRaw, T> = {}
): Promise<T> {
	const result = await fetchJSON<T, TRaw>(path, options);
	return result ?? fallback;
}
