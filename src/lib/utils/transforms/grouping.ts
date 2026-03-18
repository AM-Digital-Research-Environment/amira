import type { CollectionItem, Project, TimelineDataPoint } from '$lib/types';
import { extractItemYear, extractYear } from './dates';

/**
 * Stacked timeline data point for showing breakdown by resource type
 */
export interface StackedTimelineDataPoint {
	year: number;
	total: number;
	byType: Record<string, number>;
}

/**
 * Group collection items by year for timeline visualization
 */
export function groupByYear(items: CollectionItem[]): TimelineDataPoint[] {
	const yearMap = new Map<number, CollectionItem[]>();

	items.forEach((item) => {
		const year = extractItemYear(item);

		if (year) {
			const existing = yearMap.get(year) || [];
			existing.push(item);
			yearMap.set(year, existing);
		}
	});

	return Array.from(yearMap.entries())
		.map(([year, items]) => ({
			year,
			count: items.length,
			items
		}))
		.sort((a, b) => a.year - b.year);
}

/**
 * Group collection items by year and resource type for stacked bar chart
 */
export function groupByYearAndType(items: CollectionItem[]): StackedTimelineDataPoint[] {
	const yearMap = new Map<number, Map<string, number>>();

	items.forEach((item) => {
		const year = extractItemYear(item);

		if (year) {
			if (!yearMap.has(year)) {
				yearMap.set(year, new Map());
			}
			const typeMap = yearMap.get(year)!;
			const resourceType = item.typeOfResource || 'Unknown';
			typeMap.set(resourceType, (typeMap.get(resourceType) || 0) + 1);
		}
	});

	return Array.from(yearMap.entries())
		.map(([year, typeMap]) => {
			const byType = Object.fromEntries(typeMap);
			const total = Array.from(typeMap.values()).reduce((sum, count) => sum + count, 0);
			return { year, total, byType };
		})
		.sort((a, b) => a.year - b.year);
}

/**
 * Get all unique resource types from stacked timeline data
 */
export function getResourceTypesFromStackedData(data: StackedTimelineDataPoint[]): string[] {
	const types = new Set<string>();
	data.forEach((point) => {
		Object.keys(point.byType).forEach((type) => types.add(type));
	});
	return Array.from(types).sort();
}

/**
 * Group projects by year for timeline visualization
 */
export function groupProjectsByYear(projects: Project[]): TimelineDataPoint[] {
	const yearMap = new Map<number, number>();

	projects.forEach((project) => {
		const year = extractYear(project.date?.start);
		if (year) {
			yearMap.set(year, (yearMap.get(year) || 0) + 1);
		}
	});

	return Array.from(yearMap.entries())
		.map(([year, count]) => ({ year, count }))
		.sort((a, b) => a.year - b.year);
}
