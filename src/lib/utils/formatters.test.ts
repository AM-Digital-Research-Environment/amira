import { describe, it, expect } from 'vitest';
import { formatDate, getItemTitle, getProjectTitle } from './formatters';
import type { CollectionItem, Project } from '$lib/types';

describe('formatDate', () => {
	it('formats a Date into a UK long-day display', () => {
		expect(formatDate(new Date('2024-03-15T00:00:00Z'))).toMatch(/15.*Mar.*2024/);
	});

	it('returns "N/A" for null', () => {
		expect(formatDate(null)).toBe('N/A');
	});

	it('returns "N/A" for an invalid Date', () => {
		expect(formatDate(new Date('not-a-date'))).toBe('N/A');
	});
});

describe('getItemTitle', () => {
	it('returns the first titleInfo title when present', () => {
		const item = { titleInfo: [{ title: 'A study' }] } as unknown as CollectionItem;
		expect(getItemTitle(item)).toBe('A study');
	});

	it('returns "Untitled" when titleInfo is missing or empty', () => {
		expect(getItemTitle({} as CollectionItem)).toBe('Untitled');
		expect(getItemTitle({ titleInfo: [] } as unknown as CollectionItem)).toBe('Untitled');
	});

	it('returns "Untitled" when the first entry has no title', () => {
		const item = { titleInfo: [{}] } as unknown as CollectionItem;
		expect(getItemTitle(item)).toBe('Untitled');
	});
});

describe('getProjectTitle', () => {
	it('returns name when present', () => {
		expect(getProjectTitle({ name: 'My Project', idShort: 'mp' } as Project)).toBe('My Project');
	});

	it('falls back to idShort when name is missing', () => {
		expect(getProjectTitle({ idShort: 'mp' } as Project)).toBe('mp');
	});

	it('returns "Untitled" when both are missing', () => {
		expect(getProjectTitle({} as Project)).toBe('Untitled');
	});
});
