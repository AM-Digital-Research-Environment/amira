import { describe, it, expect } from 'vitest';
import {
	filterByDateRange,
	filterByResourceType,
	filterByLanguage,
	getUniqueResourceTypes,
	getUniqueLanguages,
	getUniqueSubjects
} from './filters';
import type { CollectionItem } from '$lib/types';

function makeItem(overrides: Partial<CollectionItem>): CollectionItem {
	return overrides as CollectionItem;
}

describe('filterByDateRange', () => {
	const items = [
		makeItem({
			dateInfo: { issue: { start: '2010-01-01' } }
		} as unknown as Partial<CollectionItem>),
		makeItem({
			dateInfo: { issue: { start: '2015-01-01' } }
		} as unknown as Partial<CollectionItem>),
		makeItem({
			dateInfo: { issue: { start: '2020-01-01' } }
		} as unknown as Partial<CollectionItem>),
		makeItem({} as Partial<CollectionItem>) // no date — always included
	];

	it('returns all items when no range is set', () => {
		expect(filterByDateRange(items, null, null)).toHaveLength(4);
	});

	it('respects the start year', () => {
		expect(filterByDateRange(items, 2015, null)).toHaveLength(3);
	});

	it('respects the end year', () => {
		expect(filterByDateRange(items, null, 2015)).toHaveLength(3);
	});

	it('respects both bounds (inclusive)', () => {
		expect(filterByDateRange(items, 2015, 2015)).toHaveLength(2);
	});

	it('keeps items without dates regardless of bounds', () => {
		const result = filterByDateRange(items, 2025, 2030);
		expect(result).toHaveLength(1);
	});
});

describe('filterByResourceType', () => {
	const items = [
		makeItem({ typeOfResource: 'text' }),
		makeItem({ typeOfResource: 'image' }),
		makeItem({ typeOfResource: 'text' })
	];

	it('returns all items when no types are selected', () => {
		expect(filterByResourceType(items, [])).toEqual(items);
	});

	it('returns only items matching the selected types', () => {
		expect(filterByResourceType(items, ['text'])).toHaveLength(2);
	});
});

describe('filterByLanguage', () => {
	const items = [
		makeItem({ language: ['fr'] } as unknown as Partial<CollectionItem>),
		makeItem({ language: ['en', 'fr'] } as unknown as Partial<CollectionItem>),
		makeItem({ language: ['en'] } as unknown as Partial<CollectionItem>)
	];

	it('returns all items when no languages are selected', () => {
		expect(filterByLanguage(items, [])).toEqual(items);
	});

	it('matches items containing any of the selected languages', () => {
		expect(filterByLanguage(items, ['fr'])).toHaveLength(2);
		expect(filterByLanguage(items, ['en'])).toHaveLength(2);
	});
});

describe('getUniqueResourceTypes', () => {
	it('returns sorted unique resource types', () => {
		const items = [
			makeItem({ typeOfResource: 'text' }),
			makeItem({ typeOfResource: 'image' }),
			makeItem({ typeOfResource: 'text' })
		];
		expect(getUniqueResourceTypes(items)).toEqual(['image', 'text']);
	});
});

describe('getUniqueLanguages', () => {
	it('returns sorted unique normalized languages', () => {
		const items = [
			makeItem({ language: ['fr', 'en'] } as unknown as Partial<CollectionItem>),
			makeItem({ language: ['en'] } as unknown as Partial<CollectionItem>)
		];
		const result = getUniqueLanguages(items);
		expect(result).toEqual([...result].sort());
		expect(result).toContain('en');
		expect(result).toContain('fr');
	});
});

describe('getUniqueSubjects', () => {
	it('uses authLabel when present, otherwise origLabel, and returns them sorted', () => {
		const items = [
			{ subject: [{ authLabel: 'Beta' }, { origLabel: 'Alpha' }] },
			{ subject: [{ authLabel: 'Beta' }] }
		] as unknown as CollectionItem[];
		expect(getUniqueSubjects(items)).toEqual(['Alpha', 'Beta']);
	});
});
