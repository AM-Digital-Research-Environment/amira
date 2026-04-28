/**
 * Display formatters for `CollectionItem` date metadata.
 *
 * The MongoDB `dateInfo` shape carries up to 8 categories (created, issue,
 * captured, …) each with optional `start`/`end`. These helpers flatten
 * that into UI-friendly strings.
 */

import type { CollectionItem } from '$lib/types';

const DATE_LABELS: Record<string, string> = {
	created: 'Created',
	issue: 'Issued',
	captured: 'Captured',
	other: 'Other',
	valid: 'Valid',
	mod: 'Modified',
	copy: 'Copied',
	disp: 'Digitised'
};

function fmtDate(date: Date | null | undefined): string {
	if (!date) return '';
	const parsed = new Date(date as unknown as string);
	if (isNaN(parsed.getTime())) return '';
	return parsed.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

export interface DateEntry {
	label: string;
	value: string;
}

/** Return all non-empty date entries for an item. */
export function getAllDates(item: CollectionItem): DateEntry[] {
	if (!item.dateInfo) return [];
	const entries: DateEntry[] = [];
	for (const [key, range] of Object.entries(item.dateInfo)) {
		if (!range || typeof range !== 'object') continue;
		const start = fmtDate(range.start);
		const end = fmtDate(range.end);
		const value = start && end ? `${start} – ${end}` : start || end;
		if (value) {
			entries.push({ label: DATE_LABELS[key] || key, value });
		}
	}
	return entries;
}

/** Backward-compatible: return a single formatted date string (best available). */
export function formatDateInfo(item: CollectionItem): string {
	const dates = getAllDates(item);
	return dates[0]?.value || '';
}
