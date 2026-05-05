import type { Publication } from '$lib/types';

/** RIS type codes per LoC's specification, mapped from our coarse taxonomy. */
const RIS_TYPE_MAP: Record<string, string> = {
	article: 'JOUR',
	book: 'BOOK',
	chapter: 'CHAP',
	conference: 'CONF',
	thesis: 'THES',
	report: 'RPRT',
	other: 'GEN'
};

/** Build a RIS record from a normalized Publication. We assemble it
 *  ourselves rather than fetching the upstream RIS export — bulk RIS
 *  appeared truncated when probed (see issue #24, comment 2). */
export function buildRis(pub: Publication): string {
	const ty = RIS_TYPE_MAP[pub.type] ?? 'GEN';
	const lines: string[] = [`TY  - ${ty}`];
	const authors = pub.authors ?? [];
	for (const a of authors) lines.push(`AU  - ${a.normalized || a.raw}`);
	const editors = pub.editors ?? [];
	for (const e of editors) lines.push(`ED  - ${e.normalized || e.raw}`);
	if (pub.title) lines.push(`TI  - ${pub.title}`);
	if (pub.year) lines.push(`PY  - ${pub.year}`);
	if (pub.journal) lines.push(`JO  - ${pub.journal}`);
	if (pub.booktitle) lines.push(`T2  - ${pub.booktitle}`);
	if (pub.volume) lines.push(`VL  - ${pub.volume}`);
	if (pub.issue) lines.push(`IS  - ${pub.issue}`);
	if (pub.pages) {
		const [start, end] = pub.pages.replace(/--/g, '-').split('-');
		if (start) lines.push(`SP  - ${start.trim()}`);
		if (end) lines.push(`EP  - ${end.trim()}`);
	}
	if (pub.publisher) lines.push(`PB  - ${pub.publisher}`);
	if (pub.address) lines.push(`CY  - ${pub.address}`);
	if (pub.doi) lines.push(`DO  - ${pub.doi}`);
	if (pub.isbn) lines.push(`SN  - ${pub.isbn}`);
	if (pub.issn && !pub.isbn) lines.push(`SN  - ${pub.issn}`);
	for (const kw of pub.keywords ?? []) lines.push(`KW  - ${kw}`);
	if (pub.url) lines.push(`UR  - ${pub.url}`);
	lines.push('ER  - ');
	lines.push('');
	return lines.join('\n');
}

function downloadBlob(text: string, filename: string, mime: string): void {
	const blob = new Blob([text], { type: `${mime};charset=utf-8` });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

function safeFilename(pub: Publication, ext: string): string {
	const base =
		(pub.authors?.[0]?.normalized ?? pub.editors?.[0]?.normalized ?? 'publication')
			.split(',')[0]
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '') || 'publication';
	// pub.id already encodes the source (e.g. "eref-96022", "epub-8670").
	return `${pub.id}-${base}.${ext}`;
}

/** Per-publication BibTeX export. Uses the pre-rendered ``bibtex_raw``
 *  shipped in publications.json so this works fully offline. */
export function downloadBibtex(pub: Publication): void {
	if (!pub.bibtex_raw) return;
	downloadBlob(pub.bibtex_raw, safeFilename(pub, 'bib'), 'application/x-bibtex');
}

/** Per-publication RIS export. */
export function downloadRis(pub: Publication): void {
	downloadBlob(buildRis(pub), safeFilename(pub, 'ris'), 'application/x-research-info-systems');
}

/** Bulk export of an arbitrary publication set as a single .bib file. */
export function downloadBibtexBulk(
	pubs: Publication[],
	filename = 'cluster-publications.bib'
): void {
	const body = pubs
		.map((p) => p.bibtex_raw)
		.filter((s): s is string => Boolean(s))
		.join('\n');
	downloadBlob(body, filename, 'application/x-bibtex');
}

/** Bulk export of an arbitrary publication set as a single .ris file. */
export function downloadRisBulk(pubs: Publication[], filename = 'cluster-publications.ris'): void {
	const body = pubs.map((p) => buildRis(p)).join('\n');
	downloadBlob(body, filename, 'application/x-research-info-systems');
}
