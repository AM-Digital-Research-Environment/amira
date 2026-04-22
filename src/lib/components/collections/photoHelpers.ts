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
