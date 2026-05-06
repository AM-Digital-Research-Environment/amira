/**
 * Cross-cutting entity lookups: ID → University, ID → Project, and a
 * couple of derived helpers for labelling.
 *
 * The pattern was duplicated across four files:
 *
 * - `loaders/collectionLoader.ts` (`getUniversity()` private helper +
 *   the `institutions → university id` resolver inline in
 *   `loadExternalCollection`)
 * - `components/layout/FilterPanel.svelte` (chip relabel)
 * - `components/research-items/sections/ItemHeader.svelte` (university
 *   badge)
 * - `components/compare/ProjectsCompare.svelte` (uses a local
 *   `allUniversities` copy)
 *
 * Each call site re-implemented `universities.find((u) => u.id ===
 * id)` with subtly different fallbacks (some return `undefined`, some
 * coalesce to `'External'`). This module owns the canonical lookups.
 */

import type { Project, University } from '$lib/types';
import { universities } from '$lib/types';
import { EXTERNAL_SOURCE_ID } from './loaders/collectionLoader';

/** Find a university by id. Returns `undefined` for `EXTERNAL_SOURCE_ID`
 *  and any unknown id; the External pseudo-university isn't a real
 *  `University` record, so callers that need a label for it should use
 *  `getUniversityName` instead. */
export function getUniversityById(id: string | undefined | null): University | undefined {
	if (!id) return undefined;
	return universities.find((u) => u.id === id);
}

/** Display name for a university id, with the External pseudo-source
 *  spelled `'External'`. Returns `null` for unknown ids so callers can
 *  decide whether to render a fallback chip or hide it. */
export function getUniversityName(id: string | undefined | null): string | null {
	if (!id) return null;
	if (id === EXTERNAL_SOURCE_ID) return 'External';
	return getUniversityById(id)?.name ?? null;
}

/** Resolve the hosting university for an external collection from the
 *  list of institution names attached to its virtual project (e.g.
 *  `['Rhodes University']` → `'rhodes'`; `['University of Bayreuth',
 *  'BIGSAS']` → `'ubt'`). Falls back to `EXTERNAL_SOURCE_ID` when no
 *  known university name matches, so the item still surfaces under the
 *  External chip in the FilterPanel. */
export function resolveCollectionUniversity(institutions: readonly string[]): string {
	const match = universities.find((u) => institutions.includes(u.name));
	return match?.id ?? EXTERNAL_SOURCE_ID;
}

/** Find a project by any of its three identifier fields (`id`, `_id`,
 *  `idShort`). The `/projects` page lets users land on a detail URL
 *  via any of those, so the lookup is permissive. Pages that only
 *  carry one identifier kind can still call this — the extra
 *  comparisons are cheap on a single-digit-thousands array. */
export function getProjectById(
	projects: readonly Project[],
	id: string | undefined | null
): Project | undefined {
	if (!id) return undefined;
	return projects.find((p) => p.id === id || p._id === id || p.idShort === id);
}
