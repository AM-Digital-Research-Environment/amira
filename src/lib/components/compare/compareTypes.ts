/**
 * Whitelist of comparison types and their canonical ordering.
 *
 * Adding a new type means: append it here, plumb it through the per-type
 * config in `EntityCompare.svelte` (or add a dedicated component for
 * `ProjectsCompare`-style flows). The route's `entries()` reads this list
 * to drive prerender.
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
