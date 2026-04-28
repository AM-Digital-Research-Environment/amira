/**
 * Featured collections registry.
 *
 * Collections surfaced under the /collections tab are curated — not every
 * MongoDB collection is meant to be browsed as a photo archive. This file
 * is the single source of truth: to feature another collection, add an
 * entry here. No other code needs to change.
 */

export interface FeaturedCollection {
	/** URL slug (kebab-case). Used as the [slug] param on /collections/[slug]. */
	slug: string;
	/** MongoDB collection identifier (e.g. "col-01-0003"). */
	identifier: string;
	/** Source ID — a university ID (ubt, unilag, …) OR the literal
	 *  "external" for collections loaded from static/data/external_metadata. */
	source: string;
	/** Project identifier used to cross-check collection membership.
	 *  For UBT collections this is the project file stem (e.g.
	 *  "UBT_preDeath2021"); for external collections it's the virtual
	 *  project id (e.g. "Ext_ILAM"). */
	projectId: string;
	/** Human-readable title shown on cards and the detail hero. */
	title: string;
	/** Short description (1–2 sentences) shown on the index card. */
	description: string;
	/** Optional tagline rendered as a subtitle. */
	tagline?: string;
	/** Optional thumbnail path (relative to static/), e.g.
	 *  "images/spittler-gerd.gif". When set, the index card shows this
	 *  instead of a mosaic of preview images. */
	thumbnail?: string;
	/** Optional partner credit line (e.g. "Published in collaboration
	 *  with Rhodes University"). Rendered under the description. */
	partner?: string;
	/** Opt-in/out of specific view modes. Default: all true. Use this to
	 *  hide views that don't make sense for a given collection — e.g.
	 *  `map: false` when every item shares the same location. */
	views?: {
		masonry?: boolean;
		map?: boolean;
		timeline?: boolean;
	};
	/** When true, collapse items that share the same `previewImage` into
	 *  a single card in masonry / timeline views. Useful for collections
	 *  where many records back the same photo (e.g. ILAM journal issues). */
	dedupePhotos?: boolean;
	/** How a deduped group is presented to the user.
	 *  - `'photo'` (default): the card represents a representative photo;
	 *     clicking opens the existing single-photo lightbox.
	 *  - `'issue'`: the card represents a journal issue (or similar
	 *     compilation); the title is the issue label (e.g. "Vol. 11 No. 4
	 *     (2022)") and clicking opens a table-of-contents modal listing
	 *     every item that shares the cover image, each linking through
	 *     to its research-item page. Has no effect when `dedupePhotos`
	 *     is false. */
	groupingMode?: 'photo' | 'issue';
}

export const FEATURED_COLLECTIONS: FeaturedCollection[] = [
	{
		slug: 'pre-death-bequest-of-gerd-spittler',
		identifier: 'col-01-0003',
		source: 'ubt',
		projectId: 'UBT_preDeath2021',
		title: 'The Pre-Death Bequest of Gerd Spittler',
		description:
			'This project is about the research material of Gerd Spittler collected in West Africa from 1967 onwards. It is not a project outlining a research programme, but a project dedicated to completed research. It is not limited to the Research Section Learning, but concerns the whole Cluster. The material includes texts (field notes, excerpts and copies from African archives), video material (6,000 photos), and audio material in Hausa and Tamacheck (tapes and cassettes).',
		thumbnail: 'images/spittler-gerd.gif'
	},
	{
		slug: 'international-library-of-african-music',
		identifier: 'col-05-0001',
		source: 'external',
		projectId: 'Ext_ILAM',
		title: 'International Library of African Music (ILAM)',
		description:
			'An external collection sourced from the International Library of African Music (ILAM), Africa’s foremost repository of music, covering ethnomusicological recordings, journals and photographic materials from across the continent.',
		partner: 'Published in collaboration with Rhodes University',
		// ILAM items all share the same host location, so a map view would
		// just be a single marker — not useful.
		views: { map: false },
		// Many ILAM records share a single journal-issue cover image; group
		// them so the masonry/timeline show one tile per distinct photo.
		dedupePhotos: true,
		// ILAM records carry DOIs of the form `…vNiM…`, so a shared cover
		// image really represents a journal issue. Render each card as the
		// issue (Vol. N No. M) and open a TOC of articles on click.
		groupingMode: 'issue'
	},
	{
		slug: 'peripheral-memories-capoeira-angola-salvador',
		identifier: 'col-06-0001',
		source: 'ufba',
		projectId: 'UFB_AfroDigital',
		title: 'Memória Periféricas da Capoeira Angola de Salvador',
		description: 'Peripheral Memories of Capoeira Angola in Salvador.',
		partner: 'Part of the Museu Afro-Digital — Universidade Federal da Bahia'
	},
	{
		slug: 'orishas-gregorio-de-mattos-foundation',
		identifier: 'col-06-0003',
		source: 'ufba',
		projectId: 'UFB_AfroDigital',
		title: 'Orixás - Fundação Gregório de Mattos',
		description: 'Orishas — Gregório de Mattos Foundation.',
		partner: 'Part of the Museu Afro-Digital — Universidade Federal da Bahia'
	},
	{
		slug: 'workers-in-from-bahia',
		identifier: 'col-06-0002',
		source: 'ufba',
		projectId: 'UFB_AfroDigital',
		title: 'Trabalhadores na/da Bahia',
		description: 'Workers in/from Bahia.',
		partner: 'Part of the Museu Afro-Digital — Universidade Federal da Bahia'
	}
];

export function getFeaturedCollection(slug: string): FeaturedCollection | undefined {
	return FEATURED_COLLECTIONS.find((c) => c.slug === slug);
}
