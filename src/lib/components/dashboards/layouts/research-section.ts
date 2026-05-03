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

export const researchSectionLayout: EntityLayout = {
	entity: 'research-section',
	showUniversityFilter: true,
	charts: [
		stackedTimelineWide,
		...typesAndLanguages,
		...subjectsAndContributors,
		wordCloudWide,
		heatmapResourceTypeByDecade,
		subjectTrendsWide,
		{
			chart: 'timeAwareChord',
			wide: true,
			tall: true,
			title: 'Subject co-occurrence over time',
			description: "How the section's subject network has filled in across years"
		},
		{
			chart: 'contributorNetwork',
			wide: true,
			tall: true,
			title: 'Persons & projects',
			description: "Persons credited within this section and the projects they're associated with"
		},
		geoFlowsCard,
		locationsTrailing
	]
};
