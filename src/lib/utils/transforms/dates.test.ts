import { describe, it, expect } from 'vitest';
import { extractYear, extractItemYear } from './dates';
import type { CollectionItem } from '$lib/types';

describe('extractYear', () => {
	it('returns the year for a Date', () => {
		expect(extractYear(new Date('2021-06-01T00:00:00Z'))).toBe(2021);
	});

	it('parses an ISO string', () => {
		expect(extractYear('2019-01-01')).toBe(2019);
	});

	it('returns null for null/undefined', () => {
		expect(extractYear(null)).toBeNull();
		expect(extractYear(undefined)).toBeNull();
	});

	it('returns null for an invalid string', () => {
		expect(extractYear('not-a-date')).toBeNull();
	});
});

describe('extractItemYear', () => {
	function item(dateInfo: unknown): CollectionItem {
		return { dateInfo } as unknown as CollectionItem;
	}

	it('returns null when dateInfo is missing', () => {
		expect(extractItemYear({} as CollectionItem)).toBeNull();
	});

	it('prefers issue.start over other categories', () => {
		const it = item({
			issue: { start: '2010-01-01', end: '2011-01-01' },
			creation: { start: '2020-01-01' }
		});
		expect(extractItemYear(it)).toBe(2010);
	});

	it('falls back to issue.end when issue.start is empty', () => {
		const it = item({ issue: { start: null, end: '2015-06-01' } });
		expect(extractItemYear(it)).toBe(2015);
	});

	it('walks the category priority issue → creation → created', () => {
		const it = item({
			issue: {},
			creation: { start: '2018-04-01' },
			created: { start: '2022-01-01' }
		});
		expect(extractItemYear(it)).toBe(2018);
	});

	it('returns null when no usable dates exist', () => {
		const it = item({
			issue: { start: 'bad', end: null },
			creation: { start: undefined }
		});
		expect(extractItemYear(it)).toBeNull();
	});
});
