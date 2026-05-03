import type { EntityLayout } from '../entityDashboardLayouts';
import { typesAndLanguages, locationsTrailing } from './fragments';

export const groupLayout: EntityLayout = {
	entity: 'group',
	showUniversityFilter: true,
	charts: [
		{ chart: 'timeline', wide: true },
		...typesAndLanguages,
		{ chart: 'subjects' },
		{ chart: 'contributors', title: 'Members & collaborators' },
		locationsTrailing
	]
};
