import { describe, it, expect } from 'vitest';
import {
	formatContributors,
	formatCitationTail,
	publicationTypeLabel,
	quarterLabel,
	publicationsByContributor,
	publicationsByContributorWithRole
} from './formatPublication';
import type { Publication, PublicationContributor } from '$lib/types';

function pub(overrides: Partial<Publication>): Publication {
	return {
		id: overrides.id ?? 'eref-1',
		source: overrides.source ?? 'eref',
		sources: overrides.sources ?? ['eref'],
		type: overrides.type ?? 'article',
		raw_type: overrides.raw_type ?? 'article',
		title: overrides.title ?? 'Untitled',
		...overrides
	};
}

function contrib(
	raw: string,
	normalized: string,
	extra: Partial<PublicationContributor> = {}
): PublicationContributor {
	return { raw, normalized, ...extra };
}

describe('publicationTypeLabel', () => {
	it('maps known types to human labels', () => {
		expect(publicationTypeLabel('article')).toBe('Article');
		expect(publicationTypeLabel('book')).toBe('Book');
		expect(publicationTypeLabel('chapter')).toBe('Chapter');
		expect(publicationTypeLabel('conference')).toBe('Conference paper');
		expect(publicationTypeLabel('working_paper')).toBe('Working paper');
		expect(publicationTypeLabel('thesis')).toBe('Thesis');
	});

	it('falls back to a title-cased version of the raw key', () => {
		expect(publicationTypeLabel('preprint')).toBe('Preprint');
		expect(publicationTypeLabel('xyz')).toBe('Xyz');
	});

	it('returns empty string unchanged when given empty input', () => {
		// String.prototype.charAt(0) on '' is '' so the fallback is harmless.
		expect(publicationTypeLabel('')).toBe('');
	});
});

describe('quarterLabel', () => {
	it('formats year + Roman quarter', () => {
		expect(quarterLabel(2025, 1)).toBe('2025 - I');
		expect(quarterLabel(2025, 2)).toBe('2025 - II');
		expect(quarterLabel(2025, 3)).toBe('2025 - III');
		expect(quarterLabel(2025, 4)).toBe('2025 - IV');
	});

	it('returns just the year when no quarter is provided', () => {
		expect(quarterLabel(2025, undefined)).toBe('2025');
	});

	it('returns empty string when year is missing', () => {
		expect(quarterLabel(undefined, 1)).toBe('');
		expect(quarterLabel(undefined, undefined)).toBe('');
	});

	it('falls back to numeric quarter when out of range', () => {
		expect(quarterLabel(2025, 5)).toBe('2025 - 5');
	});
});

describe('formatContributors', () => {
	it('returns empty string for missing or empty input', () => {
		expect(formatContributors(undefined)).toBe('');
		expect(formatContributors([])).toBe('');
	});

	it('joins up to three names with commas', () => {
		const list = [contrib('A', 'Smith, A.'), contrib('B', 'Jones, B.'), contrib('C', 'Doe, C.')];
		expect(formatContributors(list)).toBe('Smith, A., Jones, B., Doe, C.');
	});

	it('truncates past three names with et al.', () => {
		const list = [
			contrib('A', 'Smith, A.'),
			contrib('B', 'Jones, B.'),
			contrib('C', 'Doe, C.'),
			contrib('D', 'Lee, D.')
		];
		expect(formatContributors(list)).toBe('Smith, A., Jones, B., Doe, C. et al.');
	});

	it('falls back to the raw value when normalized is empty', () => {
		const list = [contrib('Raw Name', '')];
		expect(formatContributors(list)).toBe('Raw Name');
	});
});

describe('formatCitationTail', () => {
	it('formats a journal article with volume, issue, and pages', () => {
		const p = pub({
			type: 'article',
			journal: 'Journal of African Studies',
			volume: '12',
			issue: '3',
			pages: '45--67'
		});
		expect(formatCitationTail(p)).toBe('Journal of African Studies, 12(3), 45–67');
	});

	it('formats a chapter with In: BookTitle and ed. by', () => {
		const p = pub({
			type: 'chapter',
			booktitle: 'Edited Volume',
			book_editors: [contrib('A', 'Smith, A.'), contrib('B', 'Jones, B.')],
			pages: '12--34',
			publisher: 'Routledge',
			address: 'London'
		});
		expect(formatCitationTail(p)).toBe(
			'In: Edited Volume, ed. by Smith, A., Jones, B., pp. 12–34, London: Routledge'
		);
	});

	it('omits ed. by when there are no book editors', () => {
		const p = pub({
			type: 'chapter',
			booktitle: 'Edited Volume',
			pages: '12--34',
			publisher: 'Routledge'
		});
		expect(formatCitationTail(p)).toBe('In: Edited Volume, pp. 12–34, Routledge');
	});

	it('formats a working paper with series + page count', () => {
		// Working papers carry a series name (no journal / booktitle) and a
		// single integer for total page count rather than a range.
		const p = pub({
			type: 'working_paper',
			series: 'University of Bayreuth African Studies Working Papers',
			pages: '34',
			address: 'Bayreuth'
		});
		expect(formatCitationTail(p)).toBe(
			'University of Bayreuth African Studies Working Papers, 34 pp., Bayreuth'
		);
	});

	it('formats a conference paper with event_location and event_dates', () => {
		const p = pub({
			type: 'conference',
			booktitle: 'Proceedings of XYZ',
			event_location: 'Glasgow, United Kingdom',
			event_dates: '20–23 July 2025'
		});
		expect(formatCitationTail(p)).toBe(
			'In: Proceedings of XYZ, Glasgow, United Kingdom, 20–23 July 2025'
		);
	});

	it('emits volume alone without issue', () => {
		const p = pub({ type: 'article', journal: 'X', volume: '7' });
		expect(formatCitationTail(p)).toBe('X, 7');
	});

	it('emits issue in parens alone when volume is missing', () => {
		const p = pub({ type: 'article', journal: 'X', issue: '4' });
		expect(formatCitationTail(p)).toBe('X, (4)');
	});

	it('returns empty string when nothing publishable is present', () => {
		const p = pub({ type: 'other' });
		expect(formatCitationTail(p)).toBe('');
	});

	it('preserves publisher for journal articles only when also a chapter', () => {
		// Journal articles drop the publisher (the journal IS the venue).
		const p1 = pub({
			type: 'article',
			journal: 'Some Journal',
			publisher: 'Acme Press',
			pages: '10--20'
		});
		expect(formatCitationTail(p1)).toBe('Some Journal, 10–20');
	});
});

describe('publicationsByContributor', () => {
	const alice = contrib('Alice', 'Smith, A.', { person_id: 'p-1', person_name: 'Alice Smith' });
	const bob = contrib('Bob', 'Jones, B.', { person_id: 'p-2', person_name: 'Bob Jones' });
	const carol = contrib('Carol', 'Doe, C.'); // unreconciled

	const aliceArticle = pub({ id: '1', authors: [alice] });
	const bobArticle = pub({ id: '2', authors: [bob] });
	const aliceEditedBook = pub({ id: '3', editors: [alice] });
	const carolChapter = pub({ id: '4', authors: [carol], book_editors: [alice] });

	const all = [aliceArticle, bobArticle, aliceEditedBook, carolChapter];

	it('returns publications matching by canonical person_id', () => {
		const found = publicationsByContributor(all, { personId: 'p-1' });
		expect(found.map((p) => p.id).sort()).toEqual(['1', '3', '4']);
	});

	it('returns publications matching by case-insensitive person_name', () => {
		const found = publicationsByContributor(all, { personName: 'ALICE SMITH' });
		expect(found.map((p) => p.id).sort()).toEqual(['1', '3', '4']);
	});

	it('matches by normalized name when person_id is absent', () => {
		// Carol has no person_id; she matches by the normalized form.
		const found = publicationsByContributor(all, { personName: 'doe, c.' });
		expect(found.map((p) => p.id)).toEqual(['4']);
	});

	it('returns empty when neither id nor name is provided', () => {
		expect(publicationsByContributor(all, {})).toEqual([]);
	});

	it('returns empty when nothing matches', () => {
		expect(publicationsByContributor(all, { personId: 'p-999' })).toEqual([]);
	});
});

describe('publicationsByContributorWithRole', () => {
	const alice = contrib('Alice', 'Smith, A.', { person_id: 'p-1', person_name: 'Alice Smith' });
	const bob = contrib('Bob', 'Jones, B.', { person_id: 'p-2', person_name: 'Bob Jones' });

	const authored = pub({ id: '1', authors: [alice] });
	const edited = pub({ id: '2', editors: [alice] });
	const bookEdited = pub({ id: '3', authors: [bob], book_editors: [alice] });
	const unrelated = pub({ id: '4', authors: [bob] });

	const all = [authored, edited, bookEdited, unrelated];

	it('reports the strongest role for each match', () => {
		const found = publicationsByContributorWithRole(all, { personId: 'p-1' });
		const byId = Object.fromEntries(found.map((e) => [e.publication.id, e.role]));
		expect(byId).toEqual({
			'1': 'author',
			'2': 'editor',
			'3': 'book_editor'
		});
	});

	it('prefers author over editor when the same person fills both roles', () => {
		// A pathological case but worth pinning: if Alice is both author
		// and editor of the same record, she shows as author.
		const dual = pub({ id: '5', authors: [alice], editors: [alice] });
		const found = publicationsByContributorWithRole([dual], { personId: 'p-1' });
		expect(found).toEqual([{ publication: dual, role: 'author' }]);
	});

	it('returns empty when neither id nor name is provided', () => {
		expect(publicationsByContributorWithRole(all, {})).toEqual([]);
	});
});
