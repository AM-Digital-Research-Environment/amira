import type {
	CollectionItem,
	Project,
	BarChartDataPoint,
	PieChartDataPoint,
	WordCloudDataPoint
} from '$lib/types';
import { languageName, normalizeLanguageCode } from '$lib/utils/languages';

/**
 * Count occurrences for bar chart data
 */
export function countOccurrences<T>(
	items: T[],
	extractor: (item: T) => string | string[] | null | undefined
): BarChartDataPoint[] {
	const countMap = new Map<string, number>();

	items.forEach((item) => {
		const value = extractor(item);
		if (!value) return;

		const values = Array.isArray(value) ? value : [value];
		values.forEach((v) => {
			if (v && v.trim()) {
				countMap.set(v, (countMap.get(v) || 0) + 1);
			}
		});
	});

	return Array.from(countMap.entries())
		.map(([name, value]) => ({ name, value }))
		.sort((a, b) => b.value - a.value);
}

/**
 * Extract subjects from collection items
 */
export function extractSubjects(items: CollectionItem[]): BarChartDataPoint[] {
	return countOccurrences(items, (item) => item.subject?.map((s) => s.authLabel || s.origLabel));
}

/**
 * Extract resource types from collection items
 */
export function extractResourceTypes(items: CollectionItem[]): PieChartDataPoint[] {
	return countOccurrences(items, (item) => item.typeOfResource);
}

/**
 * Extract languages from collection items
 */
export function extractLanguages(items: CollectionItem[]): BarChartDataPoint[] {
	return countOccurrences(items, (item) => item.language?.map(normalizeLanguageCode)).map((d) => ({
		...d,
		name: languageName(d.name)
	}));
}

/**
 * Extract tags for word cloud
 */
export function extractTags(items: CollectionItem[]): WordCloudDataPoint[] {
	const tagCounts = countOccurrences(items, (item) => item.tags);
	// Combine with subjects for richer word cloud
	const subjectCounts = countOccurrences(items, (item) =>
		item.subject?.map((s) => s.authLabel || s.origLabel)
	);

	const combined = new Map<string, number>();
	[...tagCounts, ...subjectCounts].forEach(({ name, value }) => {
		combined.set(name, (combined.get(name) || 0) + value);
	});

	return Array.from(combined.entries())
		.map(([name, value]) => ({ name, value }))
		.sort((a, b) => b.value - a.value);
}

/**
 * Extract location origins for geographic data
 */
export function extractLocations(
	items: CollectionItem[]
): { country: string; region: string; city: string; count: number }[] {
	const locationMap = new Map<
		string,
		{ country: string; region: string; city: string; count: number }
	>();

	items.forEach((item) => {
		item.location?.origin?.forEach((origin) => {
			if (origin.l1) {
				const key = `${origin.l1}|${origin.l2 || ''}|${origin.l3 || ''}`;
				const existing = locationMap.get(key);
				if (existing) {
					existing.count++;
				} else {
					locationMap.set(key, {
						country: origin.l1,
						region: origin.l2 || '',
						city: origin.l3 || '',
						count: 1
					});
				}
			}
		});
	});

	return Array.from(locationMap.values()).sort((a, b) => b.count - a.count);
}

/**
 * Extract research sections from projects.
 *
 * The Africa Multiple cluster has exactly six thematic research sections; the
 * "External" label on dashboard projects is a pseudo-section used to group
 * datasets that live outside the cluster's structure. Filtering it out here
 * keeps stat cards and bar charts honest -- e.g. "Research Sections: 6".
 */
export function extractResearchSections(projects: Project[]): BarChartDataPoint[] {
	return countOccurrences(projects, (project) => project.researchSection).filter(
		(entry) => entry.name !== 'External'
	);
}

/**
 * Extract institutions from projects
 */
export function extractInstitutions(projects: Project[]): BarChartDataPoint[] {
	return countOccurrences(projects, (project) => project.institutions);
}
