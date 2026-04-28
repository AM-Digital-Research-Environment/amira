/**
 * Shared utilities for photo-centric collection views.
 *
 * All helpers here operate on the generic `CollectionItem` type — no
 * collection-specific logic lives in them. Keeping these in one module
 * lets masonry / map / timeline agree on the same derived fields
 * (preview URL, alternate title, creator, date, location).
 */

import type { CollectionItem, DateRange } from '$lib/types';
import type { ThumbnailManifest } from '$lib/stores/data';

/**
 * Best available preview image URL for an item, or null if none.
 * MongoDB exposes a `previewImage` array — we take the first entry.
 */
export function getPreviewImage(item: CollectionItem): string | null {
	return item.previewImage?.[0] ?? null;
}

/**
 * Resolve a remote preview URL to a locally-served WebP thumbnail when one
 * is available in the manifest. Falls back to the original URL when the
 * manifest hasn't loaded yet, when the URL is absent from it, or when the
 * URL is null. Components subscribe to `$thumbnailManifest` so the resolved
 * URL becomes reactive — once the manifest arrives, masonry / lightbox
 * cards swap from the remote source to the local thumbnail without
 * re-rendering anything else.
 */
export function resolveThumbnailUrl(
	originalUrl: string | null,
	manifest: ThumbnailManifest | null,
	basePath: string
): string | null {
	if (!originalUrl) return null;
	const entry = manifest?.[originalUrl];
	if (!entry) return originalUrl;
	return `${basePath}/thumbnails/${entry.file}`;
}

/**
 * Subset of items that have at least one preview image URL. The photo
 * views operate over this subset; the count difference is surfaced in
 * the UI footer so users know why totals don't match.
 */
export function itemsWithPreview(items: CollectionItem[]): CollectionItem[] {
	return items.filter((item) => !!getPreviewImage(item));
}

/**
 * Alternate/sub title, used when the main title is a placeholder
 * ("Ohne Titel", "Untitled") — common for photo archives where the
 * descriptive title lives under `title_type: "Alternative"`.
 */
export function getDescriptiveTitle(item: CollectionItem): string {
	const main = item.titleInfo?.find((t) => t.title_type === 'main')?.title?.trim();
	const alt = item.titleInfo?.find((t) => t.title_type === 'Alternative')?.title?.trim();
	const placeholderRegex = /^(ohne titel|untitled|no title)$/i;
	if (main && !placeholderRegex.test(main)) return main;
	return alt || main || 'Untitled';
}

/** Role-first lookup in `item.name`. Falls back to first name entry. */
export function getCreator(item: CollectionItem): string | null {
	const creator = item.name?.find((n) => n.role === 'Creator');
	return creator?.name?.label ?? null;
}

/**
 * Earliest meaningful date in the item, preferring `created`, then
 * `captured`, `issue`, `other`. Returns null if no parseable date.
 */
export function getPrimaryDate(item: CollectionItem): Date | null {
	const order: (keyof typeof item.dateInfo)[] = ['created', 'captured', 'issue', 'other'];
	for (const key of order) {
		const range = item.dateInfo?.[key] as DateRange | undefined;
		const d = pickDate(range);
		if (d) return d;
	}
	return null;
}

function pickDate(range: DateRange | undefined): Date | null {
	if (!range) return null;
	const raw = range.end ?? range.start;
	if (!raw || typeof raw === 'number') return null;
	const d = raw instanceof Date ? raw : new Date(raw);
	return isNaN(d.getTime()) ? null : d;
}

/** Short "City, Country" string built from `location.origin[0]`. */
export function getLocationLabel(item: CollectionItem): string | null {
	const origin = item.location?.origin?.[0];
	if (!origin) return null;
	const parts = [origin.l3, origin.l2, origin.l1].filter((p) => p && p.trim());
	return parts.length ? parts.join(', ') : null;
}

/** Subject/tag labels combined, de-duplicated, capped for compact display. */
export function getTopicLabels(item: CollectionItem, max = 6): string[] {
	const subjects = item.subject?.map((s) => s.authLabel || s.origLabel).filter(Boolean) ?? [];
	const tags = item.tags ?? [];
	const combined = Array.from(new Set([...subjects, ...tags]));
	return combined.slice(0, max);
}

/** WissKI URL from `url[0]`, null if absent. */
export function getExternalUrl(item: CollectionItem): string | null {
	return item.url?.[0] ?? null;
}

/**
 * Collapse items that share the same `previewImage[0]` into a single
 * representative (the first one encountered) while preserving the full
 * list of aliases. Useful for archives where many records back a single
 * photo — without this, a masonry or timeline shows the same image over
 * and over.
 */
export interface DedupedPhoto {
	item: CollectionItem;
	/** Total number of items that share this photo (including the rep). */
	count: number;
	/** The other items that share this photo. Excludes `item`. */
	aliases: CollectionItem[];
}

export function dedupeByImage(items: CollectionItem[]): DedupedPhoto[] {
	const groups = new Map<string, DedupedPhoto>();
	const standalone: DedupedPhoto[] = [];
	for (const item of items) {
		const url = getPreviewImage(item);
		if (!url) {
			// Without a preview URL there's nothing to group on — keep
			// standalone so callers that don't filter by preview see it.
			standalone.push({ item, count: 1, aliases: [] });
			continue;
		}
		const existing = groups.get(url);
		if (existing) {
			existing.count += 1;
			existing.aliases.push(item);
		} else {
			groups.set(url, { item, count: 1, aliases: [] });
		}
	}
	return [...groups.values(), ...standalone];
}

/**
 * Volume / issue / year extracted from journal-style metadata. Built from
 * a DOI matching `…vNiM…` (the pattern used by African Music Journal and
 * many other OJS-published journals) plus the item's primary date.
 *
 * Returns null for items that don't carry a DOI in this shape.
 */
export interface IssueInfo {
	volume: number;
	issue: number;
	year: number | null;
	/** "Vol. 11 No. 4 (2022)" — full label including year when known. */
	label: string;
	/** "Vol. 11 No. 4" — without year. */
	shortLabel: string;
}

const ISSUE_DOI_RE = /v(\d+)i(\d+)/i;

export function extractIssueInfo(item: CollectionItem): IssueInfo | null {
	const ids = item.identifier;
	if (!Array.isArray(ids)) return null;
	const doi = ids.find((id) =>
		id?.identifier_type?.toLowerCase().includes('digital object identifier')
	)?.identifier;
	if (!doi || typeof doi !== 'string') return null;
	const m = doi.match(ISSUE_DOI_RE);
	if (!m) return null;
	const volume = Number(m[1]);
	const issue = Number(m[2]);
	if (!Number.isFinite(volume) || !Number.isFinite(issue)) return null;
	// `getPrimaryDate` covers the canonical typed keys; fall back to the
	// raw "issued" key still used by some upstream dumps so we don't lose
	// the year for items that only carry an issuance date.
	const fallback = (item.dateInfo as Record<string, DateRange | undefined> | undefined)?.issued;
	const date = getPrimaryDate(item) ?? pickDate(fallback);
	const year = date?.getFullYear() ?? null;
	const shortLabel = `Vol. ${volume} No. ${issue}`;
	const label = year ? `${shortLabel} (${year})` : shortLabel;
	return { volume, issue, year, label, shortLabel };
}

/** Pick the issue info for a group of items that share an issue. Uses the
 *  first item that yields a parseable result. */
export function extractGroupIssueInfo(items: CollectionItem[]): IssueInfo | null {
	for (const item of items) {
		const info = extractIssueInfo(item);
		if (info) return info;
	}
	return null;
}

/**
 * Page range string (e.g. "95-118") parsed from the item's
 * `physicalDescription.note` entries that look like "pages: 95-118".
 */
export function extractPageRange(item: CollectionItem): string | null {
	const notes = item.physicalDescription?.note;
	if (!Array.isArray(notes)) return null;
	for (const note of notes) {
		if (typeof note !== 'string') continue;
		const m = note.match(/pages?\s*[:-]?\s*([0-9ivxlcdm]+(?:\s*[–-]\s*[0-9ivxlcdm]+)?)/i);
		if (m) return m[1].replace(/\s+/g, '');
	}
	return null;
}

/**
 * Sort items belonging to the same issue by their first page number, when
 * available. Falls back to descriptive title order. Used by the issue TOC
 * so the entries read like a real journal table of contents.
 */
export function sortByIssueOrder(items: CollectionItem[]): CollectionItem[] {
	function startPage(item: CollectionItem): number {
		const range = extractPageRange(item);
		if (!range) return Number.POSITIVE_INFINITY;
		const head = range.split(/[–-]/)[0];
		const n = Number(head);
		return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
	}
	return [...items].sort((a, b) => {
		const pa = startPage(a);
		const pb = startPage(b);
		if (pa !== pb) return pa - pb;
		return getDescriptiveTitle(a).localeCompare(getDescriptiveTitle(b));
	});
}

/**
 * Optional override applied to a card's display labels. Used by callers
 * that group items (e.g. a journal-issue collection) to swap a generic
 * article title for an issue label without baking that knowledge into
 * the card itself.
 */
export interface CardLabels {
	/** Replaces the descriptive title when set. */
	title?: string;
	/** Shown below the title in place of date/location chips when set. */
	subtitle?: string;
}
