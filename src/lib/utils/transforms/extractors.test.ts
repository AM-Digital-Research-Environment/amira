import { describe, it, expect } from 'vitest';
import {
	countOccurrences,
	extractSubjects,
	extractResourceTypes,
	extractLocations,
	extractResearchSections,
	extractInstitutions
} from './extractors';
import type { CollectionItem, Project } from '$lib/types';

describe('countOccurrences', () => {
	it('counts string-valued extractors', () => {
		const items = [{ tag: 'a' }, { tag: 'b' }, { tag: 'a' }, { tag: 'c' }];
		const result = countOccurrences(items, (i) => i.tag);
		expect(result).toEqual([
			{ name: 'a', value: 2 },
			{ name: 'b', value: 1 },
			{ name: 'c', value: 1 }
		]);
	});

	it('counts array-valued extractors and sorts descending', () => {
		const items = [{ tags: ['x', 'y'] }, { tags: ['y'] }, { tags: ['z', 'y', 'x'] }];
		const result = countOccurrences(items, (i) => i.tags);
		expect(result[0]).toEqual({ name: 'y', value: 3 });
		expect(result[1]).toEqual({ name: 'x', value: 2 });
		expect(result[2]).toEqual({ name: 'z', value: 1 });
	});

	it('skips null, empty, and whitespace-only values', () => {
		const items = [{ v: 'a' }, { v: '' }, { v: '   ' }, { v: null }, { v: undefined }];
		const result = countOccurrences(items, (i) => i.v);
		expect(result).toEqual([{ name: 'a', value: 1 }]);
	});
});

describe('extractSubjects', () => {
	it('uses authLabel when present, falls back to origLabel', () => {
		const items = [
			{ subject: [{ authLabel: 'Alpha', origLabel: 'a' }] },
			{ subject: [{ origLabel: 'Beta' }] },
			{ subject: [{ authLabel: 'Alpha' }] }
		] as unknown as CollectionItem[];
		const result = extractSubjects(items);
		expect(result).toEqual([
			{ name: 'Alpha', value: 2 },
			{ name: 'Beta', value: 1 }
		]);
	});
});

describe('extractResourceTypes', () => {
	it('counts typeOfResource', () => {
		const items = [
			{ typeOfResource: 'text' },
			{ typeOfResource: 'image' },
			{ typeOfResource: 'text' }
		] as unknown as CollectionItem[];
		expect(extractResourceTypes(items)).toEqual([
			{ name: 'text', value: 2 },
			{ name: 'image', value: 1 }
		]);
	});
});

describe('extractLocations', () => {
	it('groups by country/region/city and counts occurrences', () => {
		const items = [
			{ location: { origin: [{ l1: 'Mali', l2: 'Bamako', l3: 'Bamako' }] } },
			{ location: { origin: [{ l1: 'Mali', l2: 'Bamako', l3: 'Bamako' }] } },
			{ location: { origin: [{ l1: 'Niger', l2: '', l3: '' }] } }
		] as unknown as CollectionItem[];
		const result = extractLocations(items);
		expect(result[0]).toEqual({ country: 'Mali', region: 'Bamako', city: 'Bamako', count: 2 });
		expect(result[1]).toEqual({ country: 'Niger', region: '', city: '', count: 1 });
	});

	it('skips origins with no l1', () => {
		const items = [{ location: { origin: [{ l1: '', l2: 'X' }] } }] as unknown as CollectionItem[];
		expect(extractLocations(items)).toEqual([]);
	});
});

describe('extractResearchSections', () => {
	it('counts researchSection entries', () => {
		const projects = [
			{ researchSection: ['Mobilities'] },
			{ researchSection: ['Mobilities', 'Knowledges'] }
		] as unknown as Project[];
		const result = extractResearchSections(projects);
		expect(result).toContainEqual({ name: 'Mobilities', value: 2 });
		expect(result).toContainEqual({ name: 'Knowledges', value: 1 });
	});

	it('filters out the "External" pseudo-section', () => {
		const projects = [
			{ researchSection: ['External'] },
			{ researchSection: ['Mobilities'] }
		] as unknown as Project[];
		const result = extractResearchSections(projects);
		expect(result.find((r) => r.name === 'External')).toBeUndefined();
		expect(result).toContainEqual({ name: 'Mobilities', value: 1 });
	});
});

describe('extractInstitutions', () => {
	it('counts institution entries', () => {
		const projects = [
			{ institutions: ['Bayreuth', 'Lagos'] },
			{ institutions: ['Bayreuth'] }
		] as unknown as Project[];
		const result = extractInstitutions(projects);
		expect(result).toContainEqual({ name: 'Bayreuth', value: 2 });
		expect(result).toContainEqual({ name: 'Lagos', value: 1 });
	});
});
