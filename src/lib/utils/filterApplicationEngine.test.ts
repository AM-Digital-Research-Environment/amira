import { describe, it, expect } from 'vitest';
import { applyFilters, countActiveFilters, emptyFilterState } from './filterApplicationEngine';
import type { CollectionItem, FilterState } from '$lib/types';

/**
 * Minimal `CollectionItem` factory — only the fields the filter
 * pipeline reads. Casts through `unknown` so we don't have to fill
 * every required field for every test fixture.
 */
function item(overrides: Partial<CollectionItem> & { _id: string }): CollectionItem {
	return {
		dre_id: overrides._id,
		typeOfResource: overrides.typeOfResource ?? '',
		language: overrides.language ?? [],
		subject: overrides.subject ?? [],
		project: overrides.project ?? ({ id: '', name: '' } as CollectionItem['project']),
		university: overrides.university,
		dateInfo: overrides.dateInfo ?? ({} as CollectionItem['dateInfo']),
		...overrides
	} as unknown as CollectionItem;
}

describe('emptyFilterState', () => {
	it('returns a fully-empty FilterState', () => {
		const s = emptyFilterState();
		expect(s).toEqual({
			dateRange: { start: null, end: null },
			universities: [],
			resourceTypes: [],
			locations: [],
			languages: [],
			subjects: [],
			projects: []
		});
	});

	it('returns a fresh object on each call (safe to mutate)', () => {
		const a = emptyFilterState();
		const b = emptyFilterState();
		a.universities.push('ubt');
		expect(b.universities).toEqual([]);
	});
});

describe('countActiveFilters', () => {
	it('returns 0 for an empty state', () => {
		expect(countActiveFilters(emptyFilterState())).toBe(0);
	});

	it('counts each non-empty array facet once', () => {
		const s = emptyFilterState();
		s.universities = ['ubt'];
		s.resourceTypes = ['photograph'];
		s.languages = ['eng'];
		s.subjects = ['Religion'];
		s.projects = ['p-1'];
		expect(countActiveFilters(s)).toBe(5);
	});

	it('counts dateRange as 1 when either bound is set', () => {
		const onlyStart: FilterState = {
			...emptyFilterState(),
			dateRange: { start: new Date('2020-01-01'), end: null }
		};
		const onlyEnd: FilterState = {
			...emptyFilterState(),
			dateRange: { start: null, end: new Date('2025-01-01') }
		};
		const both: FilterState = {
			...emptyFilterState(),
			dateRange: { start: new Date('2020-01-01'), end: new Date('2025-01-01') }
		};
		expect(countActiveFilters(onlyStart)).toBe(1);
		expect(countActiveFilters(onlyEnd)).toBe(1);
		expect(countActiveFilters(both)).toBe(1);
	});

	it('ignores `locations` (reserved facet, see applyFilters)', () => {
		const s = { ...emptyFilterState(), locations: ['Bayreuth'] };
		expect(countActiveFilters(s)).toBe(0);
	});

	it('counts dateRange + array facets together', () => {
		const s: FilterState = {
			...emptyFilterState(),
			dateRange: { start: new Date('2020-01-01'), end: null },
			universities: ['ubt'],
			subjects: ['Religion']
		};
		expect(countActiveFilters(s)).toBe(3);
	});
});

describe('applyFilters', () => {
	// dateInfo is keyed `{ creation: { start, end } }` (or `issue` /
	// `created`). `extractItemYear` checks those categories in order.
	function dateInfo(year: number): CollectionItem['dateInfo'] {
		return {
			creation: { start: `${year}-01-01`, end: `${year}-12-31` }
		} as unknown as CollectionItem['dateInfo'];
	}

	const corpus: CollectionItem[] = [
		item({
			_id: '1',
			university: 'ubt',
			typeOfResource: 'photograph',
			language: ['eng'],
			subject: [{ authLabel: 'Religion' } as CollectionItem['subject'][number]],
			project: { id: 'p-1', name: 'Project One' } as CollectionItem['project'],
			dateInfo: dateInfo(2022)
		}),
		item({
			_id: '2',
			university: 'unilag',
			typeOfResource: 'manuscript',
			// 'fre' normalises to 'fra' via CODE_ALIASES.
			language: ['fre'],
			subject: [{ origLabel: 'Anthropology' } as CollectionItem['subject'][number]],
			project: { id: 'p-2', name: 'Project Two' } as CollectionItem['project'],
			dateInfo: dateInfo(2024)
		}),
		item({
			_id: '3',
			university: 'ubt',
			typeOfResource: 'manuscript',
			// 'ger' normalises to 'deu'; the language filter must use 'deu'.
			language: ['eng', 'ger'],
			subject: [{ authLabel: 'Religion' } as CollectionItem['subject'][number]],
			project: { id: 'p-1', name: 'Project One' } as CollectionItem['project'],
			dateInfo: dateInfo(2025)
		}),
		item({
			_id: '4',
			university: 'rhodes',
			typeOfResource: 'photograph',
			language: [],
			subject: [],
			project: { id: 'p-3', name: 'Project Three' } as CollectionItem['project'],
			dateInfo: {} as CollectionItem['dateInfo']
		})
	];

	it('returns input unchanged when no filters are active', () => {
		const out = applyFilters(corpus, emptyFilterState());
		expect(out.map((i) => i._id)).toEqual(['1', '2', '3', '4']);
	});

	it('filters by university (inclusive across the picked set)', () => {
		const out = applyFilters(corpus, { ...emptyFilterState(), universities: ['ubt'] });
		expect(out.map((i) => i._id).sort()).toEqual(['1', '3']);
	});

	it('filters by multiple universities (OR within facet)', () => {
		const out = applyFilters(corpus, {
			...emptyFilterState(),
			universities: ['ubt', 'rhodes']
		});
		expect(out.map((i) => i._id).sort()).toEqual(['1', '3', '4']);
	});

	it('filters by resourceTypes', () => {
		const out = applyFilters(corpus, {
			...emptyFilterState(),
			resourceTypes: ['photograph']
		});
		expect(out.map((i) => i._id).sort()).toEqual(['1', '4']);
	});

	it('filters by language (matches any in the array, after normalisation)', () => {
		// Item 3 has 'ger' which normalises to 'deu' — filter uses canonical.
		const out = applyFilters(corpus, { ...emptyFilterState(), languages: ['deu'] });
		expect(out.map((i) => i._id)).toEqual(['3']);
	});

	it('language filter normalises B/T variants on the filter side too', () => {
		// Item 2 has 'fre' which normalises to 'fra'. Filter on 'fra' matches.
		const out = applyFilters(corpus, { ...emptyFilterState(), languages: ['fra'] });
		expect(out.map((i) => i._id)).toEqual(['2']);
	});

	it('filters by subject — matches authLabel', () => {
		const out = applyFilters(corpus, { ...emptyFilterState(), subjects: ['Religion'] });
		expect(out.map((i) => i._id).sort()).toEqual(['1', '3']);
	});

	it('filters by subject — matches origLabel when authLabel is missing', () => {
		const out = applyFilters(corpus, { ...emptyFilterState(), subjects: ['Anthropology'] });
		expect(out.map((i) => i._id)).toEqual(['2']);
	});

	it('filters by projects (matches by project.id)', () => {
		const out = applyFilters(corpus, { ...emptyFilterState(), projects: ['p-1'] });
		expect(out.map((i) => i._id).sort()).toEqual(['1', '3']);
	});

	it('filters by dateRange (passes items without dates through)', () => {
		const out = applyFilters(corpus, {
			...emptyFilterState(),
			dateRange: { start: new Date('2024-01-01'), end: new Date('2025-12-31') }
		});
		// '1' is 2022 (out), '2' is 2024 (in), '3' is 2025 (in), '4' has no
		// date (passes through, see filterByDateRange semantics).
		expect(out.map((i) => i._id).sort()).toEqual(['2', '3', '4']);
	});

	it('filters by dateRange — start only', () => {
		const out = applyFilters(corpus, {
			...emptyFilterState(),
			dateRange: { start: new Date('2024-01-01'), end: null }
		});
		expect(out.map((i) => i._id).sort()).toEqual(['2', '3', '4']);
	});

	it('filters by dateRange — end only', () => {
		const out = applyFilters(corpus, {
			...emptyFilterState(),
			dateRange: { start: null, end: new Date('2023-12-31') }
		});
		expect(out.map((i) => i._id).sort()).toEqual(['1', '4']);
	});

	it('combines facets conjunctively (intersection)', () => {
		const out = applyFilters(corpus, {
			...emptyFilterState(),
			universities: ['ubt'],
			resourceTypes: ['manuscript'],
			languages: ['eng']
		});
		expect(out.map((i) => i._id)).toEqual(['3']);
	});

	it('returns empty when nothing matches the intersection', () => {
		const out = applyFilters(corpus, {
			...emptyFilterState(),
			universities: ['ubt'],
			projects: ['p-3']
		});
		expect(out).toEqual([]);
	});

	it('ignores `locations` even when populated (reserved facet)', () => {
		// With nothing else active, populating locations must NOT remove
		// any items — confirms the reserved-facet contract.
		const out = applyFilters(corpus, {
			...emptyFilterState(),
			locations: ['Bayreuth', 'Lagos']
		});
		expect(out.length).toBe(corpus.length);
	});

	it('does not mutate the input array', () => {
		const before = corpus.map((i) => i._id);
		applyFilters(corpus, { ...emptyFilterState(), universities: ['ubt'] });
		expect(corpus.map((i) => i._id)).toEqual(before);
	});

	it('skips items without a university when university filter is active', () => {
		// Only items whose `university` field is set AND included in the
		// filter pass — undefined university values are excluded.
		const noUni = item({ _id: 'n', typeOfResource: 'photograph' });
		const out = applyFilters([...corpus, noUni], {
			...emptyFilterState(),
			universities: ['ubt']
		});
		expect(out.map((i) => i._id).sort()).toEqual(['1', '3']);
	});
});
