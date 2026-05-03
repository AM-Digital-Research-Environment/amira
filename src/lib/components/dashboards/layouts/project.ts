import type { EntityLayout } from '../entityDashboardLayouts';
import {
	stackedTimelineWide,
	typesAndLanguages,
	subjectsAndContributors,
	wordCloudWide,
	heatmapResourceTypeByDecade,
	subjectTrendsWide,
	geoFlowsCard,
	locationsTrailing
} from './fragments';

export const projectLayout: EntityLayout = {
	entity: 'project',
	showUniversityFilter: false,
	charts: [
		stackedTimelineWide,
		...typesAndLanguages,
		{ chart: 'roles' },
		...subjectsAndContributors,
		wordCloudWide,
		heatmapResourceTypeByDecade,
		subjectTrendsWide,
		{ chart: 'sunburst', wide: true, title: 'Type → language → subject' },
		{ chart: 'chord', wide: true, tall: true, title: 'Subject co-occurrence' },
		{
			chart: 'timeAwareChord',
			wide: true,
			tall: true,
			title: 'Subject co-occurrence over time'
		},
		{ chart: 'sankey', wide: true, title: 'Contributor → project → type' },
		{
			chart: 'contributorNetwork',
			wide: true,
			tall: true,
			title: 'Persons on this project',
			description: "Persons credited on this project's items and the broader projects they touch"
		},
		geoFlowsCard,
		locationsTrailing
	]
};
