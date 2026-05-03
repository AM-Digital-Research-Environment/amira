import type { EntityLayout } from '../entityDashboardLayouts';
import { stackedTimelineWide, typesAndLanguages, locationsTrailing } from './fragments';

export const tagLayout: EntityLayout = {
	entity: 'tag',
	showUniversityFilter: false,
	charts: [
		stackedTimelineWide,
		...typesAndLanguages,
		{ chart: 'subjects', title: 'Subject headings on tagged items' },
		{ chart: 'contributors' },
		{ chart: 'wordCloud', wide: true, title: 'Related subjects & tags' },
		{ chart: 'coSubjects', wide: true, tall: true, title: 'Subject co-occurrence network' },
		locationsTrailing
	]
};
