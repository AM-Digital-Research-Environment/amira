import type { EntityLayout } from '../entityDashboardLayouts';
import {
	stackedTimelineWide,
	wordCloudWide,
	subjectTrendsWide,
	locationsTrailing
} from './fragments';

export const resourceTypeLayout: EntityLayout = {
	entity: 'resource-type',
	showUniversityFilter: false,
	charts: [
		stackedTimelineWide,
		{ chart: 'subjects' },
		{ chart: 'languages' },
		{ chart: 'contributors' },
		subjectTrendsWide,
		wordCloudWide,
		{ chart: 'heatmap', wide: true, title: 'Language × decade' },
		locationsTrailing
	]
};
