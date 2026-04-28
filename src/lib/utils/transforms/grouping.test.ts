import { describe, it, expect } from 'vitest';
import {
	groupByYear,
	groupByYearAndType,
	getResourceTypesFromStackedData,
	groupProjectsByYear,
	type StackedTimelineDataPoint
} from './grouping';
import type { CollectionItem, Project } from '$lib/types';

describe('groupByYear', () => {
	it('groups items by extracted year and sorts ascending', () => {
		const items = [
			{ dateInfo: { issue: { start: '2010-01-01' } } },
			{ dateInfo: { issue: { start: '2010-06-01' } } },
			{ dateInfo: { issue: { start: '2015-01-01' } } }
		] as unknown as CollectionItem[];
		const result = groupByYear(items);
		expect(result).toHaveLength(2);
		expect(result[0].year).toBe(2010);
		expect(result[0].count).toBe(2);
		expect(result[1].year).toBe(2015);
		expect(result[1].count).toBe(1);
	});

	it('drops items with no extractable year', () => {
		const items = [{ dateInfo: { issue: { start: 'bad' } } }] as unknown as CollectionItem[];
		expect(groupByYear(items)).toEqual([]);
	});
});

describe('groupByYearAndType', () => {
	it('counts each year/type combination and totals per year', () => {
		const items = [
			{ dateInfo: { issue: { start: '2020-01-01' } }, typeOfResource: 'text' },
			{ dateInfo: { issue: { start: '2020-01-01' } }, typeOfResource: 'image' },
			{ dateInfo: { issue: { start: '2020-01-01' } }, typeOfResource: 'text' },
			{ dateInfo: { issue: { start: '2021-01-01' } }, typeOfResource: 'image' }
		] as unknown as CollectionItem[];
		const result = groupByYearAndType(items);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ year: 2020, total: 3, byType: { text: 2, image: 1 } });
		expect(result[1]).toEqual({ year: 2021, total: 1, byType: { image: 1 } });
	});

	it('uses "Unknown" when typeOfResource is missing', () => {
		const items = [{ dateInfo: { issue: { start: '2020-01-01' } } }] as unknown as CollectionItem[];
		const result = groupByYearAndType(items);
		expect(result[0].byType.Unknown).toBe(1);
	});
});

describe('getResourceTypesFromStackedData', () => {
	it('returns the union of types across years, sorted', () => {
		const data: StackedTimelineDataPoint[] = [
			{ year: 2020, total: 3, byType: { text: 2, image: 1 } },
			{ year: 2021, total: 2, byType: { audio: 2 } }
		];
		expect(getResourceTypesFromStackedData(data)).toEqual(['audio', 'image', 'text']);
	});
});

describe('groupProjectsByYear', () => {
	it('counts projects per start year', () => {
		const projects = [
			{ date: { start: '2018-01-01' } },
			{ date: { start: '2018-06-01' } },
			{ date: { start: '2020-01-01' } }
		] as unknown as Project[];
		const result = groupProjectsByYear(projects);
		expect(result).toEqual([
			{ year: 2018, count: 2 },
			{ year: 2020, count: 1 }
		]);
	});

	it('skips projects without a parseable start date', () => {
		const projects = [{ date: {} }, { date: { start: '2020-01-01' } }] as unknown as Project[];
		const result = groupProjectsByYear(projects);
		expect(result).toEqual([{ year: 2020, count: 1 }]);
	});
});
