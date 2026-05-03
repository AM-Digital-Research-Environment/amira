import type { EntityLayout } from '../entityDashboardLayouts';
import { stackedTimelineWide, typesAndLanguages, locationsTrailing } from './fragments';

export const subjectLayout: EntityLayout = {
	entity: 'subject',
	showUniversityFilter: false,
	charts: [
		stackedTimelineWide,
		...typesAndLanguages,
		{ chart: 'subjects', title: 'Co-occurring subjects' },
		{ chart: 'contributors' },
		{ chart: 'wordCloud', wide: true, title: 'Related subjects & tags' },
		{ chart: 'coSubjects', wide: true, tall: true, title: 'Subject co-occurrence network' },
		locationsTrailing
	]
};
