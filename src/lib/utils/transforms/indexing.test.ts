import { describe, it, expect } from 'vitest';
import { countByProjectId, buildProjectMetaMap, buildPersonAffiliationMap } from './indexing';
import type { CollectionItem, Project, Person } from '$lib/types';

describe('countByProjectId', () => {
	it('counts items per project id', () => {
		const items = [
			{ project: { id: 'p1' } },
			{ project: { id: 'p2' } },
			{ project: { id: 'p1' } },
			{ project: { id: 'p1' } }
		] as unknown as CollectionItem[];
		const counts = countByProjectId(items);
		expect(counts.get('p1')).toBe(3);
		expect(counts.get('p2')).toBe(1);
	});

	it('skips items without a project id', () => {
		const items = [
			{ project: { id: 'p1' } },
			{},
			{ project: {} },
			{ project: { id: 'p1' } }
		] as unknown as CollectionItem[];
		const counts = countByProjectId(items);
		expect(counts.size).toBe(1);
		expect(counts.get('p1')).toBe(2);
	});

	it('returns an empty map for an empty input', () => {
		expect(countByProjectId([])).toEqual(new Map());
	});
});

describe('buildProjectMetaMap', () => {
	it('builds parallel sections + institutions Maps keyed by project id', () => {
		const projects = [
			{ id: 'p1', researchSection: ['Mobilities'], institutions: ['Bayreuth'] },
			{ id: 'p2', researchSection: ['Knowledges', 'Mobilities'], institutions: [] },
			{ id: 'p3', researchSection: [], institutions: ['Lagos'] }
		] as unknown as Project[];
		const meta = buildProjectMetaMap(projects);
		expect(meta.sections.get('p1')).toEqual(['Mobilities']);
		expect(meta.sections.get('p2')).toEqual(['Knowledges', 'Mobilities']);
		expect(meta.sections.has('p3')).toBe(false);
		expect(meta.institutions.get('p1')).toEqual(['Bayreuth']);
		expect(meta.institutions.has('p2')).toBe(false);
		expect(meta.institutions.get('p3')).toEqual(['Lagos']);
	});

	it('returns empty maps for an empty list', () => {
		const meta = buildProjectMetaMap([]);
		expect(meta.sections.size).toBe(0);
		expect(meta.institutions.size).toBe(0);
	});
});

describe('buildPersonAffiliationMap', () => {
	it('maps a person name to their affiliations', () => {
		const persons = [
			{ name: 'Alice', affiliation: ['Bayreuth'] },
			{ name: 'Bob', affiliation: ['Lagos', 'Bayreuth'] }
		] as unknown as Person[];
		const map = buildPersonAffiliationMap(persons);
		expect(map.get('Alice')).toEqual(['Bayreuth']);
		expect(map.get('Bob')).toEqual(['Lagos', 'Bayreuth']);
	});

	it('omits persons with no affiliations', () => {
		const persons = [{ name: 'Alice', affiliation: [] }, { name: 'Bob' }] as unknown as Person[];
		const map = buildPersonAffiliationMap(persons);
		expect(map.size).toBe(0);
	});
});
