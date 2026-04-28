import type {
	CollectionItem,
	Project,
	HeatmapDataPoint,
	BeeswarmDataPoint,
	GanttDataPoint
} from '$lib/types';
import { extractYear } from './dates';
import { buildProjectMetaMap, countByProjectId } from './indexing';

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
 *
 * External items (university='external') are routed onto a partner university
 * axis when their project's institution matches one — BayGlo2025 lists
 * 'University of Bayreuth', so its items count under UBT. External items whose
 * project has no partner-institution match stay under "External".
 */
export function buildResearchSectionUniversityHeatmap(
	projects: Project[],
	items: CollectionItem[]
): HeatmapDataPoint[] {
	const { sections: projectSections, institutions: projectInstitutions } =
		buildProjectMetaMap(projects);

	// Full institution names on the axis (more readable than UBT/UNILAG/...).
	// `rhodes` is a synthetic axis for ILAM (housed at Rhodes University) so
	// those items show up under their actual home institution instead of an
	// opaque "External" bucket.
	const uniLabelMap: Record<string, string> = {
		ubt: 'University of Bayreuth',
		unilag: 'University of Lagos',
		ujkz: 'Université Joseph Ki-Zerbo',
		ufba: 'Federal University of Bahia',
		rhodes: 'Rhodes University',
		external: 'External'
	};

	// Institutions listed on projects that, when matched, reclassify the
	// axis bucket for external-tagged items. BayGlo lists "University of
	// Bayreuth" and routes back to UBT; ILAM lists "Rhodes University" and
	// now gets its own axis instead of falling through to "External".
	const partnerInstitutionToUniId: Record<string, string> = {
		'University of Bayreuth': 'ubt',
		'University of Lagos African Cluster Centre (LACC)': 'unilag',
		'University Joseph Ki-Zerbo': 'ujkz',
		'Universidade Federal da Bahia': 'ufba',
		'CEAO Centro de Estudos Afro-Orientais': 'ufba',
		'Rhodes University': 'rhodes'
	};

	const matrix = new Map<string, number>();

	for (const item of items) {
		const projectId = item.project?.id;
		const uni = item.university;
		if (!projectId || !uni) continue;

		const sections = projectSections.get(projectId);
		if (!sections?.length) continue;

		// Resolve the axis bucket. External items route to a partner axis
		// when their project's institutions name one; otherwise fall back to
		// the generic "External" bucket.
		let axisKey = uni;
		if (uni === 'external') {
			const insts = projectInstitutions.get(projectId) ?? [];
			const matchedUni = insts
				.map((i) => partnerInstitutionToUniId[i])
				.find((v): v is string => !!v);
			if (matchedUni) axisKey = matchedUni;
		}
		const uniLabel = uniLabelMap[axisKey] || axisKey;

		for (const section of sections) {
			const key = `${uniLabel}||${section}`;
			matrix.set(key, (matrix.get(key) || 0) + 1);
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
	const itemCountByProject = countByProjectId(items);

	const result: BeeswarmDataPoint[] = [];

	for (const project of projects) {
		const startYear = extractYear(project.date?.start);
		if (!startYear) continue;

		// A project can be in multiple sections — use the first one for grouping
		const section = project.researchSection?.[0] || 'Unassigned';
		const itemCount = itemCountByProject.get(project.id) ?? 0;

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
