import { describe, it, expect } from 'vitest';
import { buildFacetOptions } from './facets';

interface Sample {
	type: string;
	year?: number | null;
	lang?: string;
}

const items: Sample[] = [
	{ type: 'article', year: 2025, lang: 'eng' },
	{ type: 'article', year: 2024, lang: 'eng' },
	{ type: 'article', year: 2024, lang: 'fre' },
	{ type: 'book', year: 2023 },
	{ type: 'chapter', year: 2025, lang: 'eng' },
	{ type: 'chapter', year: 2022, lang: '' },
	{ type: 'chapter', year: undefined, lang: undefined }
];

describe('buildFacetOptions', () => {
	it('tallies counts and sorts by frequency by default', () => {
		const opts = buildFacetOptions(items, {
			getKey: (i) => i.type,
			formatLabel: (k, count) => `${k} (${count})`
		});
		expect(opts).toEqual([
			{ value: 'article', label: 'article (3)' },
			{ value: 'chapter', label: 'chapter (3)' },
			{ value: 'book', label: 'book (1)' }
		]);
	});

	it('sorts by key descending', () => {
		const opts = buildFacetOptions(items, {
			getKey: (i) => i.year ?? null,
			formatLabel: (year, count) => `${year} (${count})`,
			sort: 'key-desc'
		});
		expect(opts.map((o) => o.value)).toEqual(['2025', '2024', '2023', '2022']);
	});

	it('sorts by key ascending', () => {
		const opts = buildFacetOptions(items, {
			getKey: (i) => i.year ?? null,
			formatLabel: (year, count) => `${year} (${count})`,
			sort: 'key-asc'
		});
		expect(opts.map((o) => o.value)).toEqual(['2022', '2023', '2024', '2025']);
	});

	it('skips null, undefined, and empty-string keys', () => {
		const opts = buildFacetOptions(items, {
			getKey: (i) => i.lang,
			formatLabel: (k, count) => `${k} (${count})`
		});
		// Three items have no lang or empty lang — they're skipped.
		expect(opts).toEqual([
			{ value: 'eng', label: 'eng (3)' },
			{ value: 'fre', label: 'fre (1)' }
		]);
	});

	it('uses formatValue when provided', () => {
		const opts = buildFacetOptions(items, {
			getKey: (i) => i.type,
			formatLabel: (k) => k,
			formatValue: (k) => `type:${k}`
		});
		expect(opts.map((o) => o.value).sort()).toEqual(['type:article', 'type:book', 'type:chapter']);
	});

	it('passes the count to formatLabel', () => {
		const opts = buildFacetOptions(items, {
			getKey: (i) => i.type,
			formatLabel: (key, count) => `${key.toUpperCase()} – ${count} item${count === 1 ? '' : 's'}`
		});
		expect(opts.map((o) => o.label)).toEqual([
			'ARTICLE – 3 items',
			'CHAPTER – 3 items',
			'BOOK – 1 item'
		]);
	});

	it('returns an empty array when no items contribute', () => {
		const opts = buildFacetOptions([], {
			getKey: (i: Sample) => i.type,
			formatLabel: (k) => k
		});
		expect(opts).toEqual([]);
	});

	it('returns an empty array when all keys are skipped', () => {
		const onlyEmpty: Sample[] = [
			{ type: 'a', lang: '' },
			{ type: 'a', lang: undefined }
		];
		const opts = buildFacetOptions(onlyEmpty, {
			getKey: (i) => i.lang,
			formatLabel: (k) => k
		});
		expect(opts).toEqual([]);
	});
});
