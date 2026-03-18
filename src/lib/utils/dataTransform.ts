import type {
	CollectionItem,
	Project,
	Person,
	TimelineDataPoint,
	BarChartDataPoint,
	PieChartDataPoint,
	WordCloudDataPoint,
	NetworkData,
	DashboardStats
} from '$lib/types';
import { languageName } from '$lib/utils/languages';

/**
 * Extract year from various date formats
 */
export function extractYear(date: Date | string | null | undefined): number | null {
	if (!date) return null;
	const d = date instanceof Date ? date : new Date(date);
	if (isNaN(d.getTime())) return null;
	return d.getFullYear();
}

/**
 * Extract year from a collection item's dateInfo, checking all possible date fields
 * Priority: issue.start > issue.end > creation.start > creation.end > created.start > created.end
 */
export function extractItemYear(item: CollectionItem): number | null {
	const dateInfo = item.dateInfo as Record<string, { start?: unknown; end?: unknown }> | undefined;
	if (!dateInfo) return null;

	// Try each date category in order of preference
	const categories = ['issue', 'creation', 'created'];

	for (const category of categories) {
		const dateCategory = dateInfo[category];
		if (dateCategory) {
			// Try start date first, then end date
			let year = extractYear(dateCategory.start as Date | string | null);
			if (year) return year;

			year = extractYear(dateCategory.end as Date | string | null);
			if (year) return year;
		}
	}

	return null;
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
 * Stacked timeline data point for showing breakdown by resource type
 */
export interface StackedTimelineDataPoint {
	year: number;
	total: number;
	byType: Record<string, number>;
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
	return countOccurrences(items, (item) => item.language).map((d) => ({
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
	const locationMap = new Map<string, { country: string; region: string; city: string; count: number }>();

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
 * Extract research sections from projects
 */
export function extractResearchSections(projects: Project[]): BarChartDataPoint[] {
	return countOccurrences(projects, (project) => project.researchSection);
}

/**
 * Extract institutions from projects
 */
export function extractInstitutions(projects: Project[]): BarChartDataPoint[] {
	return countOccurrences(projects, (project) => project.institutions);
}

/**
 * Build network data for person-institution relationships
 */
export function buildPersonInstitutionNetwork(
	persons: Person[],
	maxNodes: number = 100
): NetworkData {
	const nodes: NetworkData['nodes'] = [];
	const links: NetworkData['links'] = [];
	const institutionSet = new Set<string>();

	// Limit persons for performance
	const limitedPersons = persons.slice(0, maxNodes);

	limitedPersons.forEach((person) => {
		nodes.push({
			id: person._id,
			name: person.name,
			category: 0, // Person category
			symbolSize: 10
		});

		person.affiliation?.forEach((inst) => {
			if (!institutionSet.has(inst)) {
				institutionSet.add(inst);
				nodes.push({
					id: `inst_${inst}`,
					name: inst,
					category: 1, // Institution category
					symbolSize: 20
				});
			}
			links.push({
				source: person._id,
				target: `inst_${inst}`
			});
		});
	});

	return {
		nodes,
		links,
		categories: [{ name: 'Person' }, { name: 'Institution' }]
	};
}

/**
 * Build network data for contributors in collections
 */
export function buildContributorNetwork(items: CollectionItem[], maxNodes: number = 100): NetworkData {
	const nodes: NetworkData['nodes'] = [];
	const links: NetworkData['links'] = [];
	const personSet = new Set<string>();
	const projectSet = new Set<string>();
	const linkSet = new Set<string>();

	items.slice(0, maxNodes * 2).forEach((item) => {
		const projectId = item.project?.id;
		if (!projectId) return;

		if (!projectSet.has(projectId)) {
			projectSet.add(projectId);
			nodes.push({
				id: projectId,
				name: item.project.name || projectId,
				category: 0,
				symbolSize: 30
			});
		}

		item.name?.forEach((entry) => {
			const personName = entry.name?.label;
			if (!personName) return;

			if (!personSet.has(personName)) {
				personSet.add(personName);
				nodes.push({
					id: personName,
					name: personName,
					category: 1,
					symbolSize: 15
				});
			}

			const linkKey = `${personName}-${projectId}`;
			if (!linkSet.has(linkKey)) {
				linkSet.add(linkKey);
				links.push({
					source: personName,
					target: projectId
				});
			}
		});
	});

	return {
		nodes: nodes.slice(0, maxNodes),
		links,
		categories: [{ name: 'Project' }, { name: 'Contributor' }]
	};
}

/**
 * Calculate dashboard statistics
 */
export function calculateStats(
	projects: Project[],
	persons: Person[],
	institutions: { _id: string; name: string }[],
	collections: { all: CollectionItem[] }
): DashboardStats {
	// Count collections by project for breakdown
	const projectCounts = new Map<string, number>();
	collections.all.forEach((item) => {
		const projectName = item.project?.name || 'Unknown';
		projectCounts.set(projectName, (projectCounts.get(projectName) || 0) + 1);
	});

	return {
		totalProjects: projects.length,
		totalPersons: persons.length,
		totalDocuments: collections.all.length,
		totalInstitutions: institutions.length,
		collectionCounts: Object.fromEntries(projectCounts)
	};
}

/**
 * Filter collection items by date range
 */
export function filterByDateRange(
	items: CollectionItem[],
	startYear: number | null,
	endYear: number | null
): CollectionItem[] {
	if (!startYear && !endYear) return items;

	return items.filter((item) => {
		const year = extractItemYear(item);
		if (!year) return true; // Include items without dates

		if (startYear && year < startYear) return false;
		if (endYear && year > endYear) return false;
		return true;
	});
}

/**
 * Filter collection items by resource type
 */
export function filterByResourceType(items: CollectionItem[], types: string[]): CollectionItem[] {
	if (!types.length) return items;
	return items.filter((item) => types.includes(item.typeOfResource));
}

/**
 * Filter collection items by language
 */
export function filterByLanguage(items: CollectionItem[], languages: string[]): CollectionItem[] {
	if (!languages.length) return items;
	return items.filter((item) => item.language?.some((lang) => languages.includes(lang)));
}

/**
 * Get unique values from collection items
 */
export function getUniqueResourceTypes(items: CollectionItem[]): string[] {
	const types = new Set<string>();
	items.forEach((item) => {
		if (item.typeOfResource) types.add(item.typeOfResource);
	});
	return Array.from(types).sort();
}

export function getUniqueLanguages(items: CollectionItem[]): string[] {
	const languages = new Set<string>();
	items.forEach((item) => {
		item.language?.forEach((lang) => languages.add(lang));
	});
	return Array.from(languages).sort();
}

export function getUniqueSubjects(items: CollectionItem[]): string[] {
	const subjects = new Set<string>();
	items.forEach((item) => {
		item.subject?.forEach((s) => {
			const label = s.authLabel || s.origLabel;
			if (label) subjects.add(label);
		});
	});
	return Array.from(subjects).sort();
}

/**
 * Build Sankey diagram data: Contributor → Project → Resource Type
 */
export function buildSankeyData(
	items: CollectionItem[],
	maxItems: number = 200
): { nodes: { name: string }[]; links: { source: string; target: string; value: number }[] } {
	const nodeSet = new Set<string>();
	const linkMap = new Map<string, number>();

	// Process items to build links
	items.slice(0, maxItems).forEach((item) => {
		const projectName = item.project?.name || item.project?.id;
		const resourceType = item.typeOfResource;

		if (!projectName || !resourceType) return;

		// Add project and resource type nodes
		nodeSet.add(projectName);
		nodeSet.add(resourceType);

		// Project → Resource Type link
		const projectToType = `${projectName}|||${resourceType}`;
		linkMap.set(projectToType, (linkMap.get(projectToType) || 0) + 1);

		// Contributor → Project links (top contributors only)
		item.name?.slice(0, 3).forEach((entry) => {
			const contributor = entry.name?.label;
			if (contributor) {
				nodeSet.add(contributor);
				const contribToProject = `${contributor}|||${projectName}`;
				linkMap.set(contribToProject, (linkMap.get(contribToProject) || 0) + 1);
			}
		});
	});

	// Convert to arrays
	const nodes = Array.from(nodeSet).map((name) => ({ name }));
	const links = Array.from(linkMap.entries())
		.map(([key, value]) => {
			const [source, target] = key.split('|||');
			return { source, target, value };
		})
		.filter((link) => link.value > 0)
		.sort((a, b) => b.value - a.value)
		.slice(0, 100); // Limit links for readability

	return { nodes, links };
}

/**
 * Build subject co-occurrence matrix for chord diagram
 * Shows which subjects frequently appear together in the same items
 */
export function buildSubjectCoOccurrence(
	items: CollectionItem[],
	minOccurrences: number = 3,
	maxSubjects: number = 25
): { names: string[]; matrix: number[][] } {
	// First, count all subjects to find the most common ones
	const subjectCounts = new Map<string, number>();

	items.forEach((item) => {
		const subjects = item.subject?.map((s) => s.authLabel || s.origLabel).filter(Boolean) || [];
		subjects.forEach((subject) => {
			if (subject) {
				subjectCounts.set(subject, (subjectCounts.get(subject) || 0) + 1);
			}
		});
	});

	// Get top subjects that appear at least minOccurrences times
	const topSubjects = Array.from(subjectCounts.entries())
		.filter(([, count]) => count >= minOccurrences)
		.sort((a, b) => b[1] - a[1])
		.slice(0, maxSubjects)
		.map(([name]) => name);

	if (topSubjects.length === 0) {
		return { names: [], matrix: [] };
	}

	// Create a map for quick index lookup
	const subjectIndex = new Map<string, number>();
	topSubjects.forEach((subject, i) => subjectIndex.set(subject, i));

	// Build co-occurrence matrix
	const n = topSubjects.length;
	const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

	items.forEach((item) => {
		const subjects = item.subject
			?.map((s) => s.authLabel || s.origLabel)
			.filter((s): s is string => Boolean(s) && subjectIndex.has(s)) || [];

		// Count co-occurrences (pairs that appear in the same item)
		for (let i = 0; i < subjects.length; i++) {
			for (let j = i + 1; j < subjects.length; j++) {
				const idx1 = subjectIndex.get(subjects[i])!;
				const idx2 = subjectIndex.get(subjects[j])!;
				matrix[idx1][idx2]++;
				matrix[idx2][idx1]++;
			}
		}
	});

	return { names: topSubjects, matrix };
}

/**
 * Build institution collaboration network
 * Shows which institutions collaborate through shared project memberships
 */
export function buildInstitutionCollaborationNetwork(
	projects: Project[],
	persons: Person[],
	maxNodes: number = 50
): NetworkData {
	const nodes: NetworkData['nodes'] = [];
	const links: NetworkData['links'] = [];
	const institutionSet = new Set<string>();
	const collaborationMap = new Map<string, number>();

	// Build a map of person names to their institutions
	const personInstitutions = new Map<string, string[]>();
	persons.forEach((person) => {
		if (person.affiliation && person.affiliation.length > 0) {
			personInstitutions.set(person.name, person.affiliation);
		}
	});

	// For each project, find all institutions involved
	projects.forEach((project) => {
		const projectInstitutions = new Set<string>();

		// Add institutions directly listed on the project
		project.institutions?.forEach((inst) => {
			if (inst) projectInstitutions.add(inst);
		});

		// Add institutions from PI affiliations
		project.pi?.forEach((piName) => {
			const affiliations = personInstitutions.get(piName);
			affiliations?.forEach((inst) => projectInstitutions.add(inst));
		});

		// Add institutions from member affiliations
		if (Array.isArray(project.members)) {
			project.members.forEach((memberName) => {
				if (typeof memberName === 'string') {
					const affiliations = personInstitutions.get(memberName);
					affiliations?.forEach((inst) => projectInstitutions.add(inst));
				}
			});
		}

		// Create collaboration links between all institution pairs in this project
		const instArray = Array.from(projectInstitutions);
		for (let i = 0; i < instArray.length; i++) {
			institutionSet.add(instArray[i]);
			for (let j = i + 1; j < instArray.length; j++) {
				const key = [instArray[i], instArray[j]].sort().join('|||');
				collaborationMap.set(key, (collaborationMap.get(key) || 0) + 1);
			}
		}
	});

	// Convert institutions to nodes, sorted by collaboration count
	const institutionCollabCount = new Map<string, number>();
	collaborationMap.forEach((count, key) => {
		const [inst1, inst2] = key.split('|||');
		institutionCollabCount.set(inst1, (institutionCollabCount.get(inst1) || 0) + count);
		institutionCollabCount.set(inst2, (institutionCollabCount.get(inst2) || 0) + count);
	});

	// Take top institutions by collaboration count
	const sortedInstitutions = Array.from(institutionSet)
		.map((name) => ({ name, count: institutionCollabCount.get(name) || 0 }))
		.sort((a, b) => b.count - a.count)
		.slice(0, maxNodes);

	const topInstitutionSet = new Set(sortedInstitutions.map((i) => i.name));

	// Create nodes
	sortedInstitutions.forEach((inst) => {
		nodes.push({
			id: `inst_${inst.name}`,
			name: inst.name,
			category: 0,
			symbolSize: Math.max(15, Math.min(60, 10 + Math.sqrt(inst.count) * 5))
		});
	});

	// Create links (only between top institutions)
	collaborationMap.forEach((count, key) => {
		const [inst1, inst2] = key.split('|||');
		if (topInstitutionSet.has(inst1) && topInstitutionSet.has(inst2)) {
			links.push({
				source: `inst_${inst1}`,
				target: `inst_${inst2}`,
				value: count
			});
		}
	});

	return {
		nodes,
		links,
		categories: [{ name: 'Institution' }]
	};
}

/**
 * Sunburst hierarchy node type
 */
export interface SunburstNode {
	name: string;
	value?: number;
	children: SunburstNode[];
}

/**
 * Build Sunburst data: Resource Type → Language → Subject hierarchy
 */
export function buildSunburstData(
	items: CollectionItem[],
	maxSubjects: number = 8
): SunburstNode[] {
	// Group by resource type
	const typeMap = new Map<string, Map<string, Map<string, number>>>();

	items.forEach((item) => {
		const resourceType = item.typeOfResource || 'Unknown';
		const languages = item.language?.length ? item.language : ['Unknown'];
		const subjects = item.subject?.map((s) => s.authLabel || s.origLabel).filter(Boolean) || [];

		if (!typeMap.has(resourceType)) {
			typeMap.set(resourceType, new Map());
		}
		const langMap = typeMap.get(resourceType)!;

		languages.forEach((lang) => {
			if (!langMap.has(lang)) {
				langMap.set(lang, new Map());
			}
			const subjectMap = langMap.get(lang)!;

			if (subjects.length === 0) {
				subjectMap.set('(no subject)', (subjectMap.get('(no subject)') || 0) + 1);
			} else {
				subjects.forEach((subject) => {
					subjectMap.set(subject, (subjectMap.get(subject) || 0) + 1);
				});
			}
		});
	});

	// Convert to sunburst format
	const result: SunburstNode[] = [];

	typeMap.forEach((langMap, resourceType) => {
		const typeNode: SunburstNode = {
			name: resourceType,
			children: []
		};

		langMap.forEach((subjectMap, lang) => {
			const langNode: SunburstNode = {
				name: lang,
				children: []
			};

			// Sort subjects by count and take top N
			const sortedSubjects = Array.from(subjectMap.entries())
				.sort((a, b) => b[1] - a[1])
				.slice(0, maxSubjects);

			sortedSubjects.forEach(([subject, count]) => {
				langNode.children.push({ name: subject, value: count, children: [] });
			});

			if (langNode.children.length > 0) {
				typeNode.children.push(langNode);
			}
		});

		if (typeNode.children.length > 0) {
			result.push(typeNode);
		}
	});

	// Sort by total count
	return result.sort((a, b) => {
		const aTotal = a.children.reduce((sum, lang) => sum + lang.children.reduce((s, subj) => s + (subj.value ?? 0), 0), 0);
		const bTotal = b.children.reduce((sum, lang) => sum + lang.children.reduce((s, subj) => s + (subj.value ?? 0), 0), 0);
		return bTotal - aTotal;
	});
}
