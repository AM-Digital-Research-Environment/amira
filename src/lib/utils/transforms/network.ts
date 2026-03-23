import type { CollectionItem, Project, Person, NetworkData } from '$lib/types';
import { normalizeLanguageCode } from '$lib/utils/languages';

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
 * Build Sankey diagram data: Contributor -> Project -> Resource Type
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

		// Project -> Resource Type link
		const projectToType = `${projectName}|||${resourceType}`;
		linkMap.set(projectToType, (linkMap.get(projectToType) || 0) + 1);

		// Contributor -> Project links (top contributors only)
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
 * Build Sunburst data: Resource Type -> Language -> Subject hierarchy
 */
export function buildSunburstData(
	items: CollectionItem[],
	maxSubjects: number = 8
): SunburstNode[] {
	// Group by resource type
	const typeMap = new Map<string, Map<string, Map<string, number>>>();

	items.forEach((item) => {
		const resourceType = item.typeOfResource || 'Unknown';
		const languages = item.language?.length ? item.language.map(normalizeLanguageCode) : ['Unknown'];
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
