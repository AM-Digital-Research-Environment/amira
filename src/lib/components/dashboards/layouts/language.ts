import type { EntityLayout } from '../entityDashboardLayouts';
import {
	stackedTimelineWide,
	subjectsAndContributors,
	wordCloudWide,
	heatmapResourceTypeByDecade,
	subjectTrendsWide,
	locationsTrailing
} from './fragments';

export const languageLayout: EntityLayout = {
	entity: 'language',
	showUniversityFilter: false,
	charts: [
		stackedTimelineWide,
		{ chart: 'types' },
		{ chart: 'languages', title: 'Co-occurring languages' },
		...subjectsAndContributors,
		wordCloudWide,
		heatmapResourceTypeByDecade,
		subjectTrendsWide,
		locationsTrailing
	]
};
