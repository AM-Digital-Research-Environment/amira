import type { EntityLayout } from '../entityDashboardLayouts';
import {
	stackedTimelineWide,
	typesAndLanguages,
	subjectsAndContributors,
	wordCloudWide
} from './fragments';

export const locationLayout: EntityLayout = {
	entity: 'location',
	showUniversityFilter: false,
	charts: [
		stackedTimelineWide,
		...typesAndLanguages,
		...subjectsAndContributors,
		wordCloudWide
		// No trailing locations map — this *is* the location entity.
	]
};
