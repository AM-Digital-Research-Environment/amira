import type { EntityLayout } from '../entityDashboardLayouts';
import {
	stackedTimelineWide,
	typesAndLanguages,
	wordCloudWide,
	locationsTrailing
} from './fragments';

export const personLayout: EntityLayout = {
	entity: 'person',
	showUniversityFilter: true,
	charts: [
		stackedTimelineWide,
		...typesAndLanguages,
		{ chart: 'roles' },
		{ chart: 'subjects' },
		{ chart: 'contributors', title: 'Co-contributors' },
		wordCloudWide,
		{
			chart: 'coContributors',
			wide: true,
			tall: true,
			title: 'Co-credited persons',
			description:
				'Other persons who appear on the same items as this contributor, weighted by shared items'
		},
		{
			chart: 'contributorNetwork',
			wide: true,
			tall: true,
			title: 'Projects & co-contributors',
			description: 'Projects this person worked on and the other persons credited on those items'
		},
		{
			chart: 'affiliationNetwork',
			wide: true,
			tall: true,
			title: 'Affiliated institutions',
			description: 'Institutions referenced by the items this person contributed to'
		},
		locationsTrailing
	]
};
