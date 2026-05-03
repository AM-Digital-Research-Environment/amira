import type { EntityLayout } from '../entityDashboardLayouts';
import {
	stackedTimelineWide,
	typesAndLanguages,
	wordCloudWide,
	locationsTrailing
} from './fragments';

export const institutionLayout: EntityLayout = {
	entity: 'institution',
	showUniversityFilter: true,
	charts: [
		stackedTimelineWide,
		...typesAndLanguages,
		{ chart: 'subjects' },
		{ chart: 'contributors', title: 'Affiliated contributors' },
		wordCloudWide,
		{
			chart: 'contributorNetwork',
			wide: true,
			tall: true,
			title: 'Affiliated persons & projects',
			description: 'Persons linked to this institution and the projects that connect them'
		},
		{
			chart: 'affiliationNetwork',
			wide: true,
			tall: true,
			title: 'Other institutions',
			description: 'Institutions co-referenced with this one across the same items'
		},
		locationsTrailing
	]
};
