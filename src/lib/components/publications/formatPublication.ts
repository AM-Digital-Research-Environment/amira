import type { Publication, PublicationContributor } from '$lib/types';

/** Return the subset of publications where the given person appears as
 *  author or editor. Matches first by canonical ``person_id`` (set when the
 *  Python fetcher reconciled the BibTeX author against the persons store),
 *  then falls back to a name-string match for unreconciled contributors. */
export function publicationsByContributor(
	pubs: readonly Publication[],
	options: { personId?: string; personName?: string }
): Publication[] {
	const pid = options.personId;
	const pname = options.personName?.toLowerCase();
	if (!pid && !pname) return [];
	return pubs.filter((p) => {
		const all = [...(p.authors ?? []), ...(p.editors ?? [])];
		return all.some((c) => {
			if (pid && c.person_id === pid) return true;
			if (pname && c.normalized.toLowerCase() === pname) return true;
			if (pname && c.person_name && c.person_name.toLowerCase() === pname) return true;
			return false;
		});
	});
}

/** Render a contributor list as a single, plain-text string suitable for a
 *  citation line. Editors get the ``(eds.)`` suffix when no authors exist. */
export function formatContributors(contributors: PublicationContributor[] | undefined): string {
	if (!contributors || contributors.length === 0) return '';
	const names = contributors.map((c) => c.normalized || c.raw);
	if (names.length <= 3) return names.join(', ');
	return `${names.slice(0, 3).join(', ')} et al.`;
}

/** Build a one-line citation tail (venue + volume/issue + pages). Used by
 *  the publication card under the title. Compact, locale-agnostic, no DOI —
 *  link affordances live in the card's button row instead. */
export function formatCitationTail(pub: Publication): string {
	const parts: string[] = [];
	const venue = pub.journal ?? pub.booktitle;
	if (venue) parts.push(venue);
	const volIssue: string[] = [];
	if (pub.volume) volIssue.push(pub.volume);
	if (pub.issue) volIssue.push(`(${pub.issue})`);
	if (volIssue.length) parts.push(volIssue.join(''));
	if (pub.pages) parts.push(pub.pages.replace(/--/g, '–'));
	if (pub.publisher && !venue) {
		// For books with no journal/booktitle, show publisher + place.
		const place = pub.address ? `${pub.address}: ${pub.publisher}` : pub.publisher;
		parts.push(place);
	}
	return parts.join(', ');
}

/** Human-friendly label for the coarse publication type. Falls back to the
 *  raw BibTeX type when we don't have an explicit translation. */
const TYPE_LABEL: Record<string, string> = {
	article: 'Article',
	book: 'Book',
	chapter: 'Chapter',
	conference: 'Conference',
	thesis: 'Thesis',
	report: 'Report',
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
