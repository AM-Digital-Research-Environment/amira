/**
 * Cluster publications fetched from ERef Bayreuth's projekt-scoped export
 * (see `scripts/fetch_eref_publications.py`). Mirrors the JSON shape written
 * to `static/data/publications.json`.
 *
 * Fields are optional except `id`, `type`, `raw_type`, and `title`: the
 * Python fetcher omits empty strings / null fields to keep the payload
 * compact, so consumers must handle missing data gracefully.
 */

/** A contributor (author or editor) — raw BibTeX value plus, when matched,
 *  a pointer into the persons store so the UI can link to a person page. */
export interface PublicationContributor {
	raw: string;
	normalized: string;
	person_id?: string;
	person_name?: string;
}

/** Coarse taxonomy mapped from raw BibTeX entry types. The frontend filter
 *  surface uses this rather than the BibTeX type so e.g. `incollection` and
 *  `inbook` collapse to a single ``Chapter`` choice. */
export type PublicationType =
	| 'article'
	| 'book'
	| 'chapter'
	| 'conference'
	| 'thesis'
	| 'report'
	| 'other'
	| string;

export interface Publication {
	id: string;
	type: PublicationType;
	raw_type: string;
	title: string;
	year?: number;
	/** Calendar quarter the item was deposited in ERef (1–4). Comes from the
	 *  RSS pubDate, not the publication year — this matches how the cluster
	 *  website's "Recent Publications" page buckets items today. */
	quarter?: number;
	/** ISO timestamp of the ERef deposit. */
	deposited_at?: string;
	authors?: PublicationContributor[];
	editors?: PublicationContributor[];
	/** Volume editors for chapters / book sections. Populated from ERef's
	 *  EP3 XML `<book_editors>` element — distinct from `editors`, which
	 *  carries volume editors for `@book` records that have no chapter
	 *  authors. The BibTeX export drops this entirely for `@incollection`
	 *  entries, so the Python fetcher always enriches from EP3. */
	book_editors?: PublicationContributor[];
	journal?: string;
	booktitle?: string;
	volume?: string;
	issue?: string;
	pages?: string;
	publisher?: string;
	address?: string;
	doi?: string;
	isbn?: string;
	issn?: string;
	keywords?: string[];
	/** Original-language abstract. Sourced from ERef's EP3 XML export
	 *  (~80 % coverage); absent for items where the depositor didn't fill
	 *  the abstract field upstream. */
	abstract?: string;
	/** ISO 639-2/B language code (``eng``, ``ger``, ``fre``…) sourced from
	 *  ERef's EP3 XML ``<language>`` element. The Python fetcher drops
	 *  ``und`` (undetermined) and blanks so consumers never have to
	 *  special-case those. Use ``$lib/utils/languages → languageName(code)``
	 *  for display — it normalises the B/T variants and resolves to the
	 *  English name. */
	language?: string;
	/** Best-of-both-worlds canonical link (DOI when present, else ERef). */
	url?: string;
	/** Always the ERef permalink — useful as a fallback / "view source". */
	eref_url?: string;
	/** Per-eprint BibTeX export endpoint, suitable for direct anchor download. */
	bibtex_url?: string;
	/** Pre-rendered BibTeX entry for offline export without re-fetching. */
	bibtex_raw?: string;
}

export interface PublicationsPayload {
	generated_at: string;
	source: {
		projekt_id: string;
		bibtex_url: string;
		rss_url: string;
	};
	stats: {
		total: number;
		by_type: Record<string, number>;
		matched_contributors: number;
		total_contributors: number;
	};
	publications: Publication[];
}
