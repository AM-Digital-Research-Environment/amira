/**
 * Per-entity dashboard layouts. Each entity exports a single
 * `EntityLayout`; the `ENTITY_LAYOUTS` map below is the only thing
 * external code needs (consumed by `EntityDashboard.svelte`).
 *
 * Add a new entity by:
 *   1. Adding its name to `EntityType` in `../entityDashboardLayouts.ts`.
 *   2. Creating a `<entity>.ts` file here that exports a single
 *      `EntityLayout` constant.
 *   3. Importing + registering it in this file's `ENTITY_LAYOUTS` map.
 */

import type { EntityLayout, EntityType } from '../entityDashboardLayouts';
import { languageLayout } from './language';
import { subjectLayout } from './subject';
import { tagLayout } from './tag';
import { genreLayout } from './genre';
import { resourceTypeLayout } from './resource-type';
import { groupLayout } from './group';
import { personLayout } from './person';
import { institutionLayout } from './institution';
import { locationLayout } from './location';
import { researchSectionLayout } from './research-section';
import { projectLayout } from './project';

export const ENTITY_LAYOUTS: Partial<Record<EntityType, EntityLayout>> = {
	language: languageLayout,
	subject: subjectLayout,
	tag: tagLayout,
	genre: genreLayout,
	'resource-type': resourceTypeLayout,
	group: groupLayout,
	person: personLayout,
	institution: institutionLayout,
	location: locationLayout,
	'research-section': researchSectionLayout,
	project: projectLayout
};

export {
	languageLayout,
	subjectLayout,
	tagLayout,
	genreLayout,
	resourceTypeLayout,
	groupLayout,
	personLayout,
	institutionLayout,
	locationLayout,
	researchSectionLayout,
	projectLayout
};

export * from './fragments';
