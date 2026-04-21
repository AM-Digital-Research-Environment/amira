/**
 * Featured-collection data joiner.
 *
 * Given a `FeaturedCollection` registry entry, filters the globally
 * loaded `allCollections` store down to just that collection's items.
 * Kept in a standalone module so the index page and detail page share
 * the same filtering rule.
 */

import type { CollectionItem } from '$lib/types';
import { FEATURED_COLLECTIONS, type FeaturedCollection } from './collectionsRegistry';
import { getPreviewImage } from '$lib/components/collections/photoHelpers';

export function filterItemsForCollection(
	all: CollectionItem[],
	meta: FeaturedCollection
): CollectionItem[] {
	const wantedIdentifier = meta.identifier;
	const wantedSource = meta.source;
	const wantedProjectId = meta.projectId;
	return all.filter((item) => {
		// Collection identifier is the strongest signal (e.g. col-01-0003).
		if (item.collection?.includes(wantedIdentifier)) return true;
		// Fall back to source + project.id pairing so items whose
		// MongoDB record lists the project but whose collection array
		// is empty still match.
		if (item.university === wantedSource && item.project?.id === wantedProjectId) return true;
		return false;
	});
}

/** One registry entry enriched with live counts + a few cover URLs. */
export interface CollectionCardData {
	meta: FeaturedCollection;
	itemCount: number;
	photoCount: number;
	coverUrls: string[];
}

/**
 * Build card data for every featured collection, joined against the
 * currently-loaded items. Kept here so the /collections index page and
 * the overview sneak-peek stay in lockstep — no stats drift.
 *
 * `coverLimit` caps the cover mosaic size. The function dedupes preview
 * URLs so a mosaic never shows the same image twice.
 */
export function buildCollectionCards(all: CollectionItem[], coverLimit = 4): CollectionCardData[] {
	const byId = new Map<string, CollectionItem[]>();
	for (const item of all) {
		for (const ident of item.collection ?? []) {
			if (!byId.has(ident)) byId.set(ident, []);
			byId.get(ident)!.push(item);
		}
	}
	return FEATURED_COLLECTIONS.map((meta) => {
		const items = byId.get(meta.identifier) ?? [];
		const photos = items.filter((it) => !!getPreviewImage(it));
		// Track every unique preview URL — used for both the cover mosaic
		// and, when the collection opts into dedupe, the photo count that
		// gets surfaced on the card footer.
		const uniqueUrls: string[] = [];
		const seen = new Set<string>();
		for (const item of photos) {
			const url = getPreviewImage(item);
			if (!url || seen.has(url)) continue;
			seen.add(url);
			if (uniqueUrls.length < coverLimit) uniqueUrls.push(url);
		}
		// When dedupe is on, a photo represents one or more records — the
		// "photos" count should reflect unique images, not records, so the
		// user isn't misled (ILAM: 1,032 records → ~a dozen unique covers).
		const photoCount = meta.dedupePhotos ? seen.size : photos.length;
		return {
			meta,
			itemCount: items.length,
			photoCount,
			coverUrls: uniqueUrls
		};
	});
}
