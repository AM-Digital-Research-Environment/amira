import { error } from '@sveltejs/kit';
import { getFeaturedCollection, FEATURED_COLLECTIONS } from '$lib/utils/collectionsRegistry';
import type { EntryGenerator } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => {
	return FEATURED_COLLECTIONS.map((c) => ({ slug: c.slug }));
};

export function load({ params }: { params: { slug: string } }) {
	const meta = getFeaturedCollection(params.slug);
	if (!meta) {
		throw error(404, 'Collection not found');
	}
	return { meta };
}
