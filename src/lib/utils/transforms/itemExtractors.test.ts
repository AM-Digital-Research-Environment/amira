import { describe, it, expect } from 'vitest';
import { getSubjects } from './itemExtractors';
import type { CollectionItem } from '$lib/types';

function item(subject: CollectionItem['subject']): CollectionItem {
	return { subject } as unknown as CollectionItem;
}

describe('getSubjects', () => {
	it('extracts authLabel preferentially', () => {
		const out = getSubjects(
			item([
				{ authLabel: 'Religion', origLabel: 'rel' },
				{ authLabel: 'Politics', origLabel: 'pol' }
			] as CollectionItem['subject'])
		);
		expect(out).toEqual(['Religion', 'Politics']);
	});

	it('falls back to origLabel when authLabel is missing', () => {
		const out = getSubjects(
			item([
				{ authLabel: '', origLabel: 'Anthropology' },
				{ origLabel: 'Sociology' }
			] as CollectionItem['subject'])
		);
		expect(out).toEqual(['Anthropology', 'Sociology']);
	});

	it('skips entries with no usable label', () => {
		const out = getSubjects(
			item([
				{ authLabel: '', origLabel: '' },
				{ authLabel: 'Religion' }
			] as CollectionItem['subject'])
		);
		expect(out).toEqual(['Religion']);
	});

	it('dedupes labels (the bug that crashed ItemSubjects keyed each)', () => {
		// Items occasionally carry the same label twice — once via
		// authLabel, once via origLabel, or two raw entries with the
		// same authLabel after authority normalisation. Downstream
		// consumers (keyed `each`, frequency tallies) assume
		// uniqueness, so the extractor enforces it.
		const out = getSubjects(
			item([
				{ authLabel: 'Economic development', origLabel: 'econ' },
				{ authLabel: 'Politics' },
				{ authLabel: 'Religion' },
				{ authLabel: 'Economic development', origLabel: 'eco. dev.' },
				{ origLabel: 'Politics' }
			] as CollectionItem['subject'])
		);
		expect(out).toEqual(['Economic development', 'Politics', 'Religion']);
	});

	it('returns an empty array for missing or non-array subject', () => {
		expect(getSubjects({} as CollectionItem)).toEqual([]);
		expect(getSubjects(item(null as unknown as CollectionItem['subject']))).toEqual([]);
		expect(getSubjects(item(undefined as unknown as CollectionItem['subject']))).toEqual([]);
	});

	it('preserves first-seen order across duplicates', () => {
		const out = getSubjects(
			item([
				{ authLabel: 'C' },
				{ authLabel: 'A' },
				{ authLabel: 'B' },
				{ authLabel: 'A' },
				{ authLabel: 'C' }
			] as CollectionItem['subject'])
		);
		expect(out).toEqual(['C', 'A', 'B']);
	});
});
