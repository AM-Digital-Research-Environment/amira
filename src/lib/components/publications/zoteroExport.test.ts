import { describe, it, expect } from 'vitest';
import { buildRis } from './zoteroExport';
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

function contrib(raw: string, normalized: string): PublicationContributor {
	return { raw, normalized };
}

function risLines(pub: Publication): string[] {
	return buildRis(pub).split('\n');
}

describe('buildRis', () => {
	it('starts with TY and ends with ER + blank line', () => {
		const out = buildRis(pub({ type: 'article' }));
		const lines = out.split('\n');
		expect(lines[0]).toBe('TY  - JOUR');
		expect(lines.at(-2)).toBe('ER  - ');
		expect(lines.at(-1)).toBe('');
	});

	it('maps publication types to RIS codes', () => {
		expect(risLines(pub({ type: 'article' }))[0]).toBe('TY  - JOUR');
		expect(risLines(pub({ type: 'book' }))[0]).toBe('TY  - BOOK');
		expect(risLines(pub({ type: 'chapter' }))[0]).toBe('TY  - CHAP');
		expect(risLines(pub({ type: 'conference' }))[0]).toBe('TY  - CONF');
		expect(risLines(pub({ type: 'thesis' }))[0]).toBe('TY  - THES');
		expect(risLines(pub({ type: 'report' }))[0]).toBe('TY  - RPRT');
		expect(risLines(pub({ type: 'working_paper' }))[0]).toBe('TY  - RPRT');
	});

	it('falls back to GEN for unknown types', () => {
		expect(risLines(pub({ type: 'preprint' }))[0]).toBe('TY  - GEN');
		expect(risLines(pub({ type: 'other' }))[0]).toBe('TY  - GEN');
	});

	it('emits AU lines for authors and ED lines for editors', () => {
		const lines = risLines(
			pub({
				authors: [contrib('A', 'Smith, A.'), contrib('B', 'Jones, B.')],
				editors: [contrib('C', 'Doe, C.')]
			})
		);
		expect(lines).toContain('AU  - Smith, A.');
		expect(lines).toContain('AU  - Jones, B.');
		expect(lines).toContain('ED  - Doe, C.');
	});

	it('falls back to raw value when normalized is empty', () => {
		const lines = risLines(pub({ authors: [contrib('Raw Name', '')] }));
		expect(lines).toContain('AU  - Raw Name');
	});

	it('emits TI for title, PY for year, JO for journal', () => {
		const lines = risLines(
			pub({ title: 'A Paper', year: 2025, journal: 'Some Journal', type: 'article' })
		);
		expect(lines).toContain('TI  - A Paper');
		expect(lines).toContain('PY  - 2025');
		expect(lines).toContain('JO  - Some Journal');
	});

	it('emits T2 for booktitle on chapters', () => {
		const lines = risLines(
			pub({ type: 'chapter', booktitle: 'Edited Volume', title: 'Chapter 1' })
		);
		expect(lines).toContain('T2  - Edited Volume');
	});

	it('emits T2 for series when no booktitle is present', () => {
		const lines = risLines(
			pub({ type: 'working_paper', series: 'Working Papers Series', title: 'WP 1' })
		);
		expect(lines).toContain('T2  - Working Papers Series');
	});

	it('does not emit T2 for series when booktitle already filled the slot', () => {
		const lines = risLines(
			pub({
				type: 'chapter',
				booktitle: 'Edited Volume',
				series: 'Some Series',
				title: 'Chapter'
			})
		);
		expect(lines).toContain('T2  - Edited Volume');
		expect(lines).not.toContain('T2  - Some Series');
	});

	it('parses page ranges into SP/EP', () => {
		const lines = risLines(pub({ pages: '12--34' }));
		expect(lines).toContain('SP  - 12');
		expect(lines).toContain('EP  - 34');
	});

	it('emits only SP for a single page count', () => {
		const lines = risLines(pub({ pages: '34' }));
		expect(lines).toContain('SP  - 34');
		expect(lines.find((l) => l.startsWith('EP  -'))).toBeUndefined();
	});

	it('emits VL/IS for volume/issue', () => {
		const lines = risLines(pub({ volume: '7', issue: '3' }));
		expect(lines).toContain('VL  - 7');
		expect(lines).toContain('IS  - 3');
	});

	it('emits PB for publisher and CY for address', () => {
		const lines = risLines(pub({ publisher: 'Acme Press', address: 'Bayreuth' }));
		expect(lines).toContain('PB  - Acme Press');
		expect(lines).toContain('CY  - Bayreuth');
	});

	it('falls back to event_location for CY when address is missing', () => {
		const lines = risLines(pub({ event_location: 'Glasgow, UK' }));
		expect(lines).toContain('CY  - Glasgow, UK');
	});

	it('prefers address over event_location for CY', () => {
		const lines = risLines(pub({ address: 'Bayreuth', event_location: 'Glasgow, UK' }));
		expect(lines).toContain('CY  - Bayreuth');
		expect(lines).not.toContain('CY  - Glasgow, UK');
	});

	it('emits C1 for event_dates (RIS conference notes slot)', () => {
		const lines = risLines(pub({ event_dates: '20–23 July 2025' }));
		expect(lines).toContain('C1  - 20–23 July 2025');
	});

	it('emits DO for DOI', () => {
		const lines = risLines(pub({ doi: '10.1234/abc' }));
		expect(lines).toContain('DO  - 10.1234/abc');
	});

	it('emits SN for ISBN, falls back to ISSN when no ISBN', () => {
		const withIsbn = risLines(pub({ isbn: '978-0-12345-678-9', issn: '1234-5678' }));
		expect(withIsbn).toContain('SN  - 978-0-12345-678-9');
		expect(withIsbn).not.toContain('SN  - 1234-5678');

		const withIssnOnly = risLines(pub({ issn: '1234-5678' }));
		expect(withIssnOnly).toContain('SN  - 1234-5678');
	});

	it('emits one KW per keyword', () => {
		const lines = risLines(pub({ keywords: ['African studies', 'media', 'religion'] }));
		expect(lines.filter((l) => l.startsWith('KW  -'))).toEqual([
			'KW  - African studies',
			'KW  - media',
			'KW  - religion'
		]);
	});

	it('emits UR for url', () => {
		const lines = risLines(pub({ url: 'https://example.org/paper' }));
		expect(lines).toContain('UR  - https://example.org/paper');
	});

	it('handles a fully-populated publication end-to-end', () => {
		const out = buildRis(
			pub({
				type: 'chapter',
				title: 'A Chapter',
				year: 2025,
				authors: [contrib('A', 'Smith, A.')],
				book_editors: [contrib('B', 'Jones, B.')],
				booktitle: 'Edited Volume',
				volume: '1',
				pages: '12--34',
				publisher: 'Routledge',
				address: 'London',
				doi: '10.1234/xyz',
				keywords: ['religion', 'media'],
				url: 'https://doi.org/10.1234/xyz'
			})
		);
		const lines = out.split('\n');
		expect(lines[0]).toBe('TY  - CHAP');
		expect(lines).toContain('AU  - Smith, A.');
		expect(lines).toContain('TI  - A Chapter');
		expect(lines).toContain('PY  - 2025');
		expect(lines).toContain('T2  - Edited Volume');
		expect(lines).toContain('VL  - 1');
		expect(lines).toContain('SP  - 12');
		expect(lines).toContain('EP  - 34');
		expect(lines).toContain('PB  - Routledge');
		expect(lines).toContain('CY  - London');
		expect(lines).toContain('DO  - 10.1234/xyz');
		expect(lines).toContain('KW  - religion');
		expect(lines).toContain('UR  - https://doi.org/10.1234/xyz');
		expect(lines.at(-2)).toBe('ER  - ');
	});
});
