/**
 * Index builders — turn lists of `CollectionItem` / `Project` / `Person`
 * into per-key lookup Maps so chart and network builders can do O(1)
 * membership checks instead of repeatedly iterating the full list.
 *
 * Each helper here had at least two existing inline call sites with the
 * same Map-building boilerplate; centralising them keeps the building
 * logic in one place and lets unit tests cover edge cases (missing IDs,
 * empty arrays, multi-valued fields) once.
 */

import type { CollectionItem, Project, Person } from '$lib/types';

/**
 * Count how many collection items reference each project ID. Items with
 * no `project.id` are skipped.
 */
export function countByProjectId(items: CollectionItem[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const item of items) {
		const pid = item.project?.id;
		if (!pid) continue;
		counts.set(pid, (counts.get(pid) ?? 0) + 1);
	}
	return counts;
}

/**
 * Per-project metadata Maps built from a project list. Useful when a chart
 * needs to look up several project facets while iterating items: doing the
 * lookup as `metaMap.sections.get(item.project.id)` is O(1) per item rather
 * than O(P) for a `.find()` over the project array.
 */
export interface ProjectMetaMap {
	sections: Map<string, string[]>;
	institutions: Map<string, string[]>;
}

export function buildProjectMetaMap(projects: Project[]): ProjectMetaMap {
	const sections = new Map<string, string[]>();
	const institutions = new Map<string, string[]>();
	for (const p of projects) {
		if (p.researchSection?.length) sections.set(p.id, p.researchSection);
		if (p.institutions?.length) institutions.set(p.id, p.institutions);
	}
	return { sections, institutions };
}

/**
 * Map a person's display name to their affiliation list. Persons with no
 * affiliations are omitted so callers can use `.get(name)` as a presence
 * check.
 */
export function buildPersonAffiliationMap(persons: Person[]): Map<string, string[]> {
	const map = new Map<string, string[]>();
	for (const person of persons) {
		if (person.affiliation?.length) {
			map.set(person.name, person.affiliation);
		}
	}
	return map;
}
