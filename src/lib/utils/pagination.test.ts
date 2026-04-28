import { describe, it, expect } from 'vitest';
import { paginate, totalPages } from './pagination';

describe('paginate', () => {
	const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

	it('returns the requested page slice', () => {
		expect(paginate(items, 0, 3)).toEqual([0, 1, 2]);
		expect(paginate(items, 1, 3)).toEqual([3, 4, 5]);
		expect(paginate(items, 2, 3)).toEqual([6, 7, 8]);
	});

	it('returns a partial slice on the final page', () => {
		expect(paginate(items, 3, 3)).toEqual([9]);
	});

	it('returns an empty array when the page is past the end', () => {
		expect(paginate(items, 10, 3)).toEqual([]);
	});

	it('handles an empty input', () => {
		expect(paginate<number>([], 0, 5)).toEqual([]);
	});
});

describe('totalPages', () => {
	it('returns the ceiling of total/perPage', () => {
		expect(totalPages(10, 3)).toBe(4);
		expect(totalPages(9, 3)).toBe(3);
	});

	it('returns at least 1 even when there are no items', () => {
		expect(totalPages(0, 5)).toBe(1);
	});

	it('returns 1 when items fit in a single page', () => {
		expect(totalPages(3, 5)).toBe(1);
	});
});
