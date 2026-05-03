import type { EntityLayout } from '../entityDashboardLayouts';
import {
	stackedTimelineWide,
	typesAndLanguages,
	subjectsAndContributors,
	wordCloudWide,
	locationsTrailing
} from './fragments';

export const genreLayout: EntityLayout = {
	entity: 'genre',
	showUniversityFilter: false,
	charts: [
		stackedTimelineWide,
		...typesAndLanguages,
		...subjectsAndContributors,
		wordCloudWide,
		locationsTrailing
	]
};
