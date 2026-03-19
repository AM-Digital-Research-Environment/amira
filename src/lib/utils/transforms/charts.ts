import type {
	CollectionItem,
	Project,
	HeatmapDataPoint,
	BeeswarmDataPoint,
	GanttDataPoint
} from '$lib/types';
import { extractYear, extractItemYear } from './dates';

/**
 * Build a heatmap matrix crossing two categorical dimensions from collection items.
 *
 * @param items - Collection items to process
 * @param xExtractor - Extracts x-axis categories from an item
 * @param yExtractor - Extracts y-axis categories from an item
 * @param maxX - Maximum number of x-axis categories (top N by total count)
 * @param maxY - Maximum number of y-axis categories (top N by total count)
 */
export function buildHeatmapData(
	items: CollectionItem[],
	xExtractor: (item: CollectionItem) => string | string[] | null | undefined,
	yExtractor: (item: CollectionItem) => string | string[] | null | undefined,
	maxX = 15,
	maxY = 10
): HeatmapDataPoint[] {
	// Count totals per x and y to find top categories
	const xCounts = new Map<string, number>();
	const yCounts = new Map<string, number>();
	const matrix = new Map<string, number>();

	for (const item of items) {
		const xRaw = xExtractor(item);
		const yRaw = yExtractor(item);
		if (!xRaw || !yRaw) continue;

		const xs = Array.isArray(xRaw) ? xRaw : [xRaw];
		const ys = Array.isArray(yRaw) ? yRaw : [yRaw];

		for (const x of xs) {
			if (!x?.trim()) continue;
			for (const y of ys) {
				if (!y?.trim()) continue;
				xCounts.set(x, (xCounts.get(x) || 0) + 1);
				yCounts.set(y, (yCounts.get(y) || 0) + 1);
				const key = `${x}||${y}`;
				matrix.set(key, (matrix.get(key) || 0) + 1);
			}
		}
	}

	// Get top categories
	const topX = [...xCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, maxX)
		.map(([name]) => name);
	const topY = [...yCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, maxY)
		.map(([name]) => name);

	const topXSet = new Set(topX);
	const topYSet = new Set(topY);

	// Build data points only for top categories
	const result: HeatmapDataPoint[] = [];
	for (const [key, value] of matrix) {
		const [x, y] = key.split('||');
		if (topXSet.has(x) && topYSet.has(y)) {
			result.push({ x, y, value });
		}
	}

	return result;
}

/**
 * Build a research-section × university heatmap from projects and collection items.
 */
export function buildResearchSectionUniversityHeatmap(
	projects: Project[],
	items: CollectionItem[]
): HeatmapDataPoint[] {
	// Map project ID → research sections
	const projectSections = new Map<string, string[]>();
	for (const p of projects) {
		if (p.researchSection?.length) {
			projectSections.set(p.id, p.researchSection);
		}
	}

	// Map university codes from item data
	const uniLabelMap: Record<string, string> = {
		ubt: 'UBT',
		unilag: 'UNILAG',
		ujkz: 'UJKZ',
		ufba: 'UFBA'
	};

	const matrix = new Map<string, number>();
	const sectionCounts = new Map<string, number>();
	const uniCounts = new Map<string, number>();

	for (const item of items) {
		const projectId = item.project?.id;
		const uni = item.university;
		if (!projectId || !uni) continue;

		const sections = projectSections.get(projectId);
		if (!sections?.length) continue;

		const uniLabel = uniLabelMap[uni] || uni;

		for (const section of sections) {
			const key = `${uniLabel}||${section}`;
			matrix.set(key, (matrix.get(key) || 0) + 1);
			sectionCounts.set(section, (sectionCounts.get(section) || 0) + 1);
			uniCounts.set(uniLabel, (uniCounts.get(uniLabel) || 0) + 1);
		}
	}

	const result: HeatmapDataPoint[] = [];
	for (const [key, value] of matrix) {
		const [x, y] = key.split('||');
		result.push({ x, y, value });
	}

	return result;
}

/**
 * Build beeswarm data from projects, plotting them by start year and grouped by research section.
 */
export function buildProjectBeeswarm(
	projects: Project[],
	items: CollectionItem[]
): BeeswarmDataPoint[] {
	// Count collection items per project for sizing
	const itemCountByProject = new Map<string, number>();
	for (const item of items) {
		const pid = item.project?.id;
		if (pid) {
			itemCountByProject.set(pid, (itemCountByProject.get(pid) || 0) + 1);
		}
	}

	const result: BeeswarmDataPoint[] = [];

	for (const project of projects) {
		const startYear = extractYear(project.date?.start);
		if (!startYear) continue;

		// A project can be in multiple sections — use the first one for grouping
		const section = project.researchSection?.[0] || 'Unassigned';
		const itemCount = itemCountByProject.get(project.id) || 0;

		result.push({
			category: section,
			value: startYear,
			label: project.name,
			size: Math.max(itemCount, 1)
		});
	}

	return result;
}

/**
 * Build Gantt chart data from projects, using start/end dates.
 * Groups by first research section for color coding.
 */
export function buildProjectGantt(projects: Project[]): GanttDataPoint[] {
	const result: GanttDataPoint[] = [];

	for (const project of projects) {
		const startYear = extractYear(project.date?.start);
		const endYear = extractYear(project.date?.end);
		if (!startYear) continue;

		// If no end date, assume ongoing (current year) or 1 year
		const effectiveEnd = endYear || Math.max(startYear + 1, new Date().getFullYear());

		// Truncate long names for the y-axis
		const shortName =
			project.name.length > 50 ? project.name.substring(0, 47) + '...' : project.name;

		const section = project.researchSection?.[0] || 'Unassigned';

		result.push({
			name: shortName,
			start: startYear,
			end: effectiveEnd,
			category: section,
			tooltip: project.id
		});
	}

	return result;
}
