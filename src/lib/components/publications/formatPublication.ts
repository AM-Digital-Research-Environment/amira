import type { Publication, PublicationContributor } from '$lib/types';

/** Roles a person can hold in a publication. Mirrors the BibTeX/EP3 split:
 *  chapter authors, volume editors of an `@book`, and volume editors of a
 *  book that contains a chapter authored by someone else. */
export type PublicationRole = 'author' | 'editor' | 'book_editor';

export interface PublicationByContributor {
	publication: Publication;
	role: PublicationRole;
}

function contributorMatches(
	c: PublicationContributor,
	pid: string | undefined,
	pname: string | undefined
): boolean {
	if (pid && c.person_id === pid) return true;
	if (pname && c.normalized.toLowerCase() === pname) return true;
	if (pname && c.person_name && c.person_name.toLowerCase() === pname) return true;
	return false;
}

/** Return publications where the given person appears in *any* role
 *  (author, editor of an edited volume, or book editor of a chapter).
 *  Matches first by canonical ``person_id`` (set when the Python fetcher
 *  reconciled the contributor against the persons store), then falls back
 *  to a name-string match for unreconciled contributors. */
export function publicationsByContributor(
	pubs: readonly Publication[],
	options: { personId?: string; personName?: string }
): Publication[] {
	const pid = options.personId;
	const pname = options.personName?.toLowerCase();
	if (!pid && !pname) return [];
	return pubs.filter((p) => {
		const all = [...(p.authors ?? []), ...(p.editors ?? []), ...(p.book_editors ?? [])];
		return all.some((c) => contributorMatches(c, pid, pname));
	});
}

/** Same lookup, but also reports the role the person played. Useful for
 *  the people-detail UI which wants to label e.g. ``As book editor``
 *  alongside chapters they edited rather than wrote. */
export function publicationsByContributorWithRole(
	pubs: readonly Publication[],
	options: { personId?: string; personName?: string }
): PublicationByContributor[] {
	const pid = options.personId;
	const pname = options.personName?.toLowerCase();
	if (!pid && !pname) return [];
	const out: PublicationByContributor[] = [];
	for (const p of pubs) {
		// Author wins over editor wins over book_editor — the strongest
		// role tied to the publication is what we report.
		if ((p.authors ?? []).some((c) => contributorMatches(c, pid, pname))) {
			out.push({ publication: p, role: 'author' });
			continue;
		}
		if ((p.editors ?? []).some((c) => contributorMatches(c, pid, pname))) {
			out.push({ publication: p, role: 'editor' });
			continue;
		}
		if ((p.book_editors ?? []).some((c) => contributorMatches(c, pid, pname))) {
			out.push({ publication: p, role: 'book_editor' });
		}
	}
	return out;
}

/** Render a contributor list as a single, plain-text string suitable for a
 *  citation line. Editors get the ``(eds.)`` suffix when no authors exist. */
export function formatContributors(contributors: PublicationContributor[] | undefined): string {
	if (!contributors || contributors.length === 0) return '';
	const names = contributors.map((c) => c.normalized || c.raw);
	if (names.length <= 3) return names.join(', ');
	return `${names.slice(0, 3).join(', ')} et al.`;
}

/** Format a contributor list compactly: drop to ``Name1, Name2 et al.``
 *  past three names so the line stays readable inside a citation tail. */
function formatNameList(contributors: PublicationContributor[]): string {
	const names = contributors.map((c) => c.normalized || c.raw);
	if (names.length <= 3) return names.join(', ');
	return `${names.slice(0, 3).join(', ')} et al.`;
}

/** Build a one-line citation tail (venue + volume/issue + pages). Used by
 *  the publication card under the title. Compact, locale-agnostic, no DOI —
 *  link affordances live in the card's button row instead.
 *
 *  Chapters are formatted as ``In: BookTitle, ed. by Editor1, Editor2,
 *  pp. X–Y. Place: Publisher`` so volume editors stay visible — see
 *  https://github.com/AM-Digital-Research-Environment/amira/issues/24. */
export function formatCitationTail(pub: Publication): string {
	const parts: string[] = [];
	const isChapter = !pub.journal && !!pub.booktitle;
	// Working papers / monographs in a series have no journal or booktitle —
	// the series name plays the venue role instead.
	const isSeriesItem = !pub.journal && !pub.booktitle && !!pub.series;

	if (isChapter) {
		let chunk = `In: ${pub.booktitle}`;
		if (pub.book_editors && pub.book_editors.length > 0) {
			chunk += `, ed. by ${formatNameList(pub.book_editors)}`;
		}
		parts.push(chunk);
	} else if (pub.journal) {
		parts.push(pub.journal);
	} else if (isSeriesItem) {
		parts.push(pub.series!);
	}

	const volIssue: string[] = [];
	if (pub.volume) volIssue.push(pub.volume);
	if (pub.issue) volIssue.push(`(${pub.issue})`);
	if (volIssue.length) parts.push(volIssue.join(''));

	if (pub.pages) {
		const pages = pub.pages.replace(/--/g, '–');
		// EP3 stores a single integer for working papers / monographs (total
		// page count); journal articles and chapters carry a range. Render
		// "34 pp." vs "123–145" / "pp. 123–145" accordingly.
		const isPageCount = /^\d+$/.test(pages.trim());
		if (isPageCount) {
			parts.push(`${pages} pp.`);
		} else if (isChapter) {
			parts.push(`pp. ${pages}`);
		} else {
			parts.push(pages);
		}
	}

	if (pub.publisher && (!pub.journal || isChapter)) {
		const place = pub.address ? `${pub.address}: ${pub.publisher}` : pub.publisher;
		parts.push(place);
	} else if (isSeriesItem && pub.address) {
		parts.push(pub.address);
	}

	// Conference venue + dates (EP3 only — BibTeX strips both).
	if (pub.event_location) parts.push(pub.event_location);
	if (pub.event_dates) parts.push(pub.event_dates);

	return parts.join(', ');
}

/** Human-friendly label for the coarse publication type. Falls back to a
 *  title-cased rendering of the raw key when we don't have an explicit
 *  translation. Keep in sync with `EP3_TYPE_MAP` in the Python fetcher. */
const TYPE_LABEL: Record<string, string> = {
	article: 'Article',
	book: 'Book',
	chapter: 'Chapter',
	conference: 'Conference paper',
	thesis: 'Thesis',
	report: 'Report',
	working_paper: 'Working paper',
	periodical: 'Periodical',
	review: 'Review',
	online: 'Online',
	patent: 'Patent',
	other: 'Other'
};

export function publicationTypeLabel(type: string): string {
	return TYPE_LABEL[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

const QUARTER_ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

/** "2025 - III" style label that matches the cluster website's grouping. */
export function quarterLabel(year: number | undefined, quarter: number | undefined): string {
	if (!year) return '';
	if (!quarter) return String(year);
	return `${year} - ${QUARTER_ROMAN[quarter] ?? quarter}`;
}
