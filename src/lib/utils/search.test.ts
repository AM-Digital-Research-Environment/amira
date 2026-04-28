import { describe, it, expect } from 'vitest';
import { createSearchFilter } from './search';

interface Item {
	name: string;
	description?: string | null;
}

describe('createSearchFilter', () => {
	const items: Item[] = [
		{ name: 'Alice', description: 'Researcher' },
		{ name: 'Bob', description: 'Coordinator' },
		{ name: 'Carol', description: null },
		{ name: 'Diana' }
	];
	const filter = createSearchFilter<Item>([(i) => i.name, (i) => i.description]);

	it('returns all items for an empty query', () => {
		expect(filter(items, '')).toEqual(items);
	});

	it('returns all items for a whitespace-only query', () => {
		expect(filter(items, '   ')).toEqual(items);
	});

	it('matches case-insensitively against any field', () => {
		expect(filter(items, 'COORD')).toEqual([{ name: 'Bob', description: 'Coordinator' }]);
		expect(filter(items, 'alice')).toEqual([{ name: 'Alice', description: 'Researcher' }]);
	});

	it('handles null and undefined fields without throwing', () => {
		expect(filter(items, 'carol')).toEqual([{ name: 'Carol', description: null }]);
		expect(filter(items, 'diana')).toEqual([{ name: 'Diana' }]);
	});

	it('returns an empty array when nothing matches', () => {
		expect(filter(items, 'xyz')).toEqual([]);
	});

	it('trims surrounding whitespace before searching', () => {
		expect(filter(items, '  alice  ')).toEqual([{ name: 'Alice', description: 'Researcher' }]);
	});
});
