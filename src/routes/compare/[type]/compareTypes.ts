/**
 * Whitelist of comparison types. Adding a new type means: append it
 * here, plumb it through `+page.svelte`'s `TYPE_META` map. The route's
 * `entries()` (in `+page.ts`) reads from this list to drive prerender.
 */
export const COMPARE_TYPES = [
	'projects',
	'people',
	'institutions',
	'subjects',
	'languages',
	'genres'
] as const;

export type CompareType = (typeof COMPARE_TYPES)[number];
