import { describe, it, expect } from 'vitest';
import { applyPublicationFilters, hasActiveFilters } from './filterPublications';
import type { Publication, PublicationContributor } from '$lib/types';

function pub(overrides: Partial<Publication> & { id: string }): Publication {
	return {
		source: overrides.source ?? 'eref',
		sources: overrides.sources ?? ['eref'],
		type: overrides.type ?? 'article',
		raw_type: overrides.raw_type ?? 'article',
		title: overrides.title ?? `Pub ${overrides.id}`,
		...overrides
	};
}

function contrib(raw: string, normalized: string): PublicationContributor {
	return { raw, normalized };
}

const allFilters = {
	type: 'all',
	year: 'all',
	language: 'all',
	keyword: '',
	searchQuery: ''
};

describe('applyPublicationFilters', () => {
	const corpus: Publication[] = [
		pub({
			id: '1',
			type: 'article',
			year: 2025,
			language: 'eng',
			title: 'Religion in West Africa',
			keywords: ['religion', 'west-africa']
		}),
		pub({
			id: '2',
			type: 'book',
			year: 2024,
			language: 'fre',
			title: 'Histoire et anthropologie',
			keywords: ['anthropology']
		}),
		pub({
			id: '3',
			type: 'chapter',
			year: 2025,
			language: 'eng',
			booktitle: 'Edited Volume',
			keywords: ['religion']
		}),
		pub({
			id: '4',
			type: 'chapter',
			year: 2023,
			language: 'eng',
			authors: [contrib('Alice', 'Smith, Alice')],
			keywords: ['Religion'] // note capital R — keyword match must lowercase
		}),
		pub({
			id: '5',
			type: 'article',
			year: 2024,
			language: 'ger',
			abstract: 'A study of media representation.',
			doi: '10.1234/media',
			keywords: ['media']
		})
	];

	it('returns the input unchanged when all filters are at their default', () => {
		const out = applyPublicationFilters(corpus, allFilters);
		expect(out.map((p) => p.id)).toEqual(['1', '2', '3', '4', '5']);
	});

	it('filters by type', () => {
		const out = applyPublicationFilters(corpus, { ...allFilters, type: 'article' });
		expect(out.map((p) => p.id).sort()).toEqual(['1', '5']);
	});

	it('filters by year (string-compared against year)', () => {
		const out = applyPublicationFilters(corpus, { ...allFilters, year: '2025' });
		expect(out.map((p) => p.id).sort()).toEqual(['1', '3']);
	});

	it('filters by language', () => {
		const out = applyPublicationFilters(corpus, { ...allFilters, language: 'fre' });
		expect(out.map((p) => p.id)).toEqual(['2']);
	});

	it('filters by keyword (case-insensitive exact match)', () => {
		const out = applyPublicationFilters(corpus, { ...allFilters, keyword: 'religion' });
		// Three pubs tagged 'religion' (in any case): 1, 3, 4.
		expect(out.map((p) => p.id).sort()).toEqual(['1', '3', '4']);
	});

	it('keyword match is exact, not substring', () => {
		const out = applyPublicationFilters(corpus, { ...allFilters, keyword: 'religi' });
		expect(out).toEqual([]);
	});

	it('search matches title (case-insensitive)', () => {
		const out = applyPublicationFilters(corpus, { ...allFilters, searchQuery: 'WEST AFRICA' });
		expect(out.map((p) => p.id)).toEqual(['1']);
	});

	it('search matches abstract', () => {
		const out = applyPublicationFilters(corpus, { ...allFilters, searchQuery: 'media' });
		expect(out.map((p) => p.id)).toEqual(['5']);
	});

	it('search matches booktitle', () => {
		const out = applyPublicationFilters(corpus, { ...allFilters, searchQuery: 'edited volume' });
		expect(out.map((p) => p.id)).toEqual(['3']);
	});

	it('search matches DOI', () => {
		const out = applyPublicationFilters(corpus, { ...allFilters, searchQuery: '10.1234' });
		expect(out.map((p) => p.id)).toEqual(['5']);
	});

	it('search matches contributor normalized name', () => {
		const out = applyPublicationFilters(corpus, { ...allFilters, searchQuery: 'smith' });
		expect(out.map((p) => p.id)).toEqual(['4']);
	});

	it('search matches keyword substring (broader than the keyword filter)', () => {
		const out = applyPublicationFilters(corpus, { ...allFilters, searchQuery: 'anthrop' });
		expect(out.map((p) => p.id)).toEqual(['2']);
	});

	it('trims and lowercases the search query', () => {
		const out = applyPublicationFilters(corpus, { ...allFilters, searchQuery: '   RELIGION   ' });
		// The search runs as substring so it matches anything with 'religion'
		// in title/keywords/etc. (1, 3, 4) — same as the keyword filter would,
		// just via the broader path.
		expect(out.map((p) => p.id).sort()).toEqual(['1', '3', '4']);
	});

	it('empty / whitespace-only search runs as no-op', () => {
		const out = applyPublicationFilters(corpus, { ...allFilters, searchQuery: '   ' });
		expect(out.length).toBe(corpus.length);
	});

	it('combines facets conjunctively (intersection)', () => {
		const out = applyPublicationFilters(corpus, {
			...allFilters,
			type: 'chapter',
			year: '2025',
			language: 'eng'
		});
		expect(out.map((p) => p.id)).toEqual(['3']);
	});

	it('combines facets and search', () => {
		const out = applyPublicationFilters(corpus, {
			...allFilters,
			type: 'article',
			searchQuery: 'media'
		});
		expect(out.map((p) => p.id)).toEqual(['5']);
	});

	it('returns empty when nothing matches the intersection', () => {
		const out = applyPublicationFilters(corpus, {
			...allFilters,
			type: 'article',
			year: '2023'
		});
		expect(out).toEqual([]);
	});
});

describe('hasActiveFilters', () => {
	it('returns false when all filters are at their defaults', () => {
		expect(hasActiveFilters(allFilters)).toBe(false);
	});

	it('returns true when type is set', () => {
		expect(hasActiveFilters({ ...allFilters, type: 'article' })).toBe(true);
	});

	it('returns true when year is set', () => {
		expect(hasActiveFilters({ ...allFilters, year: '2025' })).toBe(true);
	});

	it('returns true when language is set', () => {
		expect(hasActiveFilters({ ...allFilters, language: 'eng' })).toBe(true);
	});

	it('returns true when keyword is set', () => {
		expect(hasActiveFilters({ ...allFilters, keyword: 'religion' })).toBe(true);
	});

	it('returns true when searchQuery is non-empty (after trim)', () => {
		expect(hasActiveFilters({ ...allFilters, searchQuery: 'foo' })).toBe(true);
		expect(hasActiveFilters({ ...allFilters, searchQuery: '   foo   ' })).toBe(true);
	});

	it('returns false for whitespace-only searchQuery', () => {
		expect(hasActiveFilters({ ...allFilters, searchQuery: '   ' })).toBe(false);
	});
});
