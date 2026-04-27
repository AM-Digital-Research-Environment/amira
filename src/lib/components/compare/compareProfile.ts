/**
 * Shared shape + helpers for the side-by-side compare pages.
 *
 * Both `ProjectsCompare` (raw items, on-the-fly aggregation) and
 * `EntityCompare` (precomputed JSON) reduce their selection to this same
 * `Profile` so the radar overlay and overlap card are identical across
 * compare types.
 */

export interface Profile {
	items: number;
	subjects: number;
	languages: number;
	types: number;
	yearSpan: number;
	contributors: number;
}

export interface NamedValue {
	name: string;
	value: number;
}

/** Per-axis indicator for the 6-axis radar. Per-axis max = larger of the
 * two sides so shapes are comparable rather than auto-scaled per side. */
export function buildRadarIndicator(left: Profile, right: Profile) {
	return [
		{ name: 'Items', max: Math.max(left.items, right.items, 1) },
		{ name: 'Subjects', max: Math.max(left.subjects, right.subjects, 1) },
		{ name: 'Languages', max: Math.max(left.languages, right.languages, 1) },
		{ name: 'Types', max: Math.max(left.types, right.types, 1) },
		{ name: 'Year span', max: Math.max(left.yearSpan, right.yearSpan, 1) },
		{ name: 'Contributors', max: Math.max(left.contributors, right.contributors, 1) }
	];
}

/** Two-series radar payload, ordered to match `buildRadarIndicator`. */
export function buildRadarSeries(
	leftName: string,
	leftProfile: Profile,
	rightName: string,
	rightProfile: Profile
) {
	const seriesValues = (p: Profile) => [
		p.items,
		p.subjects,
		p.languages,
		p.types,
		p.yearSpan,
		p.contributors
	];
	return [
		{ name: leftName, values: seriesValues(leftProfile) },
		{ name: rightName, values: seriesValues(rightProfile) }
	];
}

export interface SubjectOverlap {
	overlap: number;
	total: number;
	percentage: number;
	shared: string[];
}

/** Jaccard-style subject overlap. Caller passes the top-N subject lists
 * each side already aggregated (`extractSubjects` for projects, the
 * precomputed `subjects` array for entities). */
export function computeSubjectOverlap(
	leftSubjects: NamedValue[],
	rightSubjects: NamedValue[],
	maxShared = 12
): SubjectOverlap {
	const leftSet = new Set(leftSubjects.map((s) => s.name));
	const rightSet = new Set(rightSubjects.map((s) => s.name));
	const intersection = new Set([...leftSet].filter((x) => rightSet.has(x)));
	const union = new Set([...leftSet, ...rightSet]);
	return {
		overlap: intersection.size,
		total: union.size,
		percentage: union.size > 0 ? Math.round((intersection.size / union.size) * 100) : 0,
		shared: Array.from(intersection).slice(0, maxShared)
	};
}
