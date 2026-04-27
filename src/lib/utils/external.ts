import type { Project } from '$lib/types';

/**
 * Pseudo research section label used for external collections that don't
 * belong to the six official research sections of the cluster.
 */
export const EXTERNAL_SECTION = 'External';

/**
 * Virtual Project records for external collections that live outside the
 * partner-university project data but still need to appear in project lists,
 * comparison selectors, research-section groupings, etc.
 *
 * BayGlo2025 is affiliated with University of Bayreuth (UBT); ILAM is
 * unaffiliated. Both are grouped under the "External" pseudo research section.
 */
export const EXTERNAL_PROJECTS: Project[] = [
	{
		_id: 'Ext_BayGlo2025',
		id: 'Ext_BayGlo2025',
		idShort: 'BayGlo2025',
		locale: 'Bayreuth',
		localeCode: 0,
		researchSection: [EXTERNAL_SECTION],
		name: 'Bayreuth Global / Bayreuth Postkolonial',
		pi: [],
		members: [],
		emails: [],
		description:
			'External collection contributed by the Bayreuth Global / Bayreuth Postkolonial project at the University of Bayreuth.',
		// Project lifespan, NOT the historical content range. Bayreuth
		// Global / Bayreuth Postkolonial ran for the calendar year 2025.
		date: { start: new Date('2025-01-01'), end: new Date('2025-12-31') },
		rdspace: {
			collection: { uuid: null, handle: null },
			projectSub: { uuid: null, handle: null }
		},
		createdAt: null,
		updatedAt: '',
		updatedBy: '',
		institutions: ['University of Bayreuth']
	},
	{
		_id: 'Ext_ILAM',
		id: 'Ext_ILAM',
		idShort: 'ILAM',
		locale: 'Makhanda',
		localeCode: 0,
		researchSection: [EXTERNAL_SECTION],
		name: 'International Library of African Music (ILAM)',
		pi: [],
		members: [],
		emails: [],
		description:
			'External collection sourced from the International Library of African Music (ILAM) at Rhodes University.',
		// Institutional founding (1954) — ILAM still operates today. The
		// upstream record sometimes carries historical content dates (e.g.
		// 1013 for medieval transcriptions); we explicitly pin the project
		// lifespan so the gantt axis doesn't blow out to a millennium.
		date: { start: new Date('1954-01-01'), end: null },
		rdspace: {
			collection: { uuid: null, handle: null },
			projectSub: { uuid: null, handle: null }
		},
		createdAt: null,
		updatedAt: '',
		updatedBy: '',
		institutions: ['Rhodes University']
	}
];

/** Quick lookup of external project ids. */
export const EXTERNAL_PROJECT_IDS: ReadonlySet<string> = new Set(
	EXTERNAL_PROJECTS.map((p) => p.id)
);

/**
 * Map a collection-name (as listed under manifest.external[folder]) to the
 * virtual project it belongs to. Keys are the bare names, e.g. "BayGlo2025".
 */
export const EXTERNAL_COLLECTION_TO_PROJECT: Record<string, Project> = {
	BayGlo2025: EXTERNAL_PROJECTS[0],
	ILAM: EXTERNAL_PROJECTS[1]
};

export function isExternalProjectId(id: string | undefined | null): boolean {
	return !!id && EXTERNAL_PROJECT_IDS.has(id);
}
