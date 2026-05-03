/**
 * Reusable `ChartSlot` constants and slot groups shared across entity
 * layouts. Centralising them here keeps the per-entity layout files
 * focused on what makes that entity *different* — most layouts now read
 * as a list of named slot groups plus 1–3 entity-specific overrides.
 */

import type { ChartSlot } from '../entityDashboardLayouts';

// --- single slots ----------------------------------------------------------

/** Wide stacked-timeline opener (used by 10/11 entity layouts). */
export const stackedTimelineWide: ChartSlot = { chart: 'stackedTimeline', wide: true };

/** Wide word-cloud row (subjects + tags). */
export const wordCloudWide: ChartSlot = { chart: 'wordCloud', wide: true };

/** Wide subject-trends area chart. */
export const subjectTrendsWide: ChartSlot = { chart: 'subjectTrends', wide: true };

/** Heatmap of resource type × decade (language, resource-type,
 *  research-section, project). */
export const heatmapResourceTypeByDecade: ChartSlot = {
	chart: 'heatmap',
	wide: true,
	title: 'Resource type × decade'
};

/** Trailing wide+tall map of geographic origins. Used at the end of
 *  almost every layout. */
export const locationsTrailing: ChartSlot = { chart: 'locations', wide: true, tall: true };

/** Origin → current location flow card (research-section, project). */
export const geoFlowsCard: ChartSlot = {
	chart: 'geoFlows',
	wide: true,
	tall: true,
	title: 'Origin → current location',
	description: "Items by where they were created vs. where they're held today"
};

// --- slot groups -----------------------------------------------------------

/** Default categorical pair. The `language` layout overrides the second
 *  slot's title to "Co-occurring languages", so callers there inline that
 *  custom slot rather than spreading this group. */
export const typesAndLanguages: ChartSlot[] = [{ chart: 'types' }, { chart: 'languages' }];

/** Default subjects+contributors pair. Some layouts (subject, tag, person,
 *  institution) override one of the titles — those callers inline. */
export const subjectsAndContributors: ChartSlot[] = [
	{ chart: 'subjects' },
	{ chart: 'contributors' }
];
