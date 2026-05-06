/**
 * Cluster publications fetched from ERef Bayreuth's projekt-scoped export
 * **and** EPub Bayreuth's Africa Multiple division view, deduplicated and
 * merged (see `scripts/fetch_publications.py`). Mirrors the JSON shape
 * written to `static/data/publications.json`.
 *
 * Fields are optional except `id`, `source`, `sources`, `type`, `raw_type`,
 * and `title`: the Python fetcher omits empty strings / null fields to keep
 * the payload compact, so consumers must handle missing data gracefully.
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

/** Identifier of the upstream Bayreuth repository a record was harvested
 *  from. Records cross-listed in both repos appear once with both URLs
 *  populated and ``sources: ['eref', 'epub']``. */
export type PublicationSource = 'eref' | 'epub';

export interface Publication {
	/** Composite ID — ``eref-<eprintid>`` or ``epub-<eprintid>``. The prefix
	 *  reflects the *primary* source: for cross-listed records this is the
	 *  source whose metadata won during merge (ERef wins by default). */
	id: string;
	/** Primary source the record was anchored to during dedup. */
	source: PublicationSource;
	/** All sources that carry this record. Length 1 for source-exclusive
	 *  items, length 2 when the same paper is deposited in both repos. */
	sources: PublicationSource[];
	type: PublicationType;
	raw_type: string;
	title: string;
	year?: number;
	/** Calendar quarter the item was deposited in the upstream repo (1–4).
	 *  Comes from the RSS pubDate, not the publication year — this matches
	 *  how the cluster website's "Recent Publications" page buckets items
	 *  today. Sourced from the primary repo when cross-listed. */
	quarter?: number;
	/** ISO timestamp of the upstream deposit (primary source). */
	deposited_at?: string;
	authors?: PublicationContributor[];
	editors?: PublicationContributor[];
	/** Volume editors for chapters / book sections. Populated from EP3 XML's
	 *  `<book_editors>` element — distinct from `editors`, which carries
	 *  volume editors for `@book` records that have no chapter authors.
	 *  The BibTeX export drops this entirely for `@incollection` entries,
	 *  so the Python fetcher always enriches from EP3. */
	book_editors?: PublicationContributor[];
	journal?: string;
	booktitle?: string;
	/** Series the item belongs to (e.g. "University of Bayreuth African Studies
	 *  Working Papers"). Populated for working papers, monographs in a series,
	 *  and some chapters. Sourced from the BibTeX `series` field, falling back
	 *  to the EP3 XML `<series>` element. */
	series?: string;
	volume?: string;
	issue?: string;
	/** Page range (`123-145`) for journal articles and chapters, or page count
	 *  (`34`) for working papers and monographs. The citation formatter
	 *  detects which form is present and renders accordingly. */
	pages?: string;
	publisher?: string;
	address?: string;
	/** Conference venue city/country (e.g. "Glasgow, United Kingdom").
	 *  Sourced from the EP3 `<event_location>` element — absent from the
	 *  BibTeX export. Populated for `conference_item` records. */
	event_location?: string;
	/** Conference dates as a free-form string (e.g. "20-23 July 2025").
	 *  Sourced from the EP3 `<event_dates>` element. */
	event_dates?: string;
	doi?: string;
	isbn?: string;
	issn?: string;
	keywords?: string[];
	/** Original-language abstract. Sourced from EP3 XML (~80 % coverage on
	 *  ERef; thinner on EPub); absent for items where the depositor didn't
	 *  fill the abstract field upstream. */
	abstract?: string;
	/** ISO 639-2/B language code (``eng``, ``ger``, ``fre``…) sourced from
	 *  the EP3 XML ``<language>`` element. The Python fetcher drops ``und``
	 *  (undetermined) and blanks so consumers never have to special-case
	 *  those. Use ``$lib/utils/languages → languageName(code)`` for display —
	 *  it normalises the B/T variants and resolves to the English name. */
	language?: string;
	/** Best-of-both-worlds canonical link (DOI when present, else upstream
	 *  permalink). Use this when you want a single "open this paper" link. */
	url?: string;
	/** ERef Bayreuth permalink. Present when ``sources`` includes ``eref``. */
	eref_url?: string;
	/** EPub Bayreuth permalink. Present when ``sources`` includes ``epub``. */
	epub_url?: string;
	/** Per-eprint BibTeX export endpoint of the primary source, suitable for
	 *  direct anchor download. */
	bibtex_url?: string;
	/** Pre-rendered BibTeX entry for offline export without re-fetching.
	 *  Sourced from the primary repo when cross-listed. */
	bibtex_raw?: string;
}

export interface PublicationsPayloadSource {
	name: PublicationSource;
	label: string;
	bibtex_url: string;
	rss_url: string;
	view_url: string;
	fetched_count: number;
}

export interface PublicationsPayload {
	generated_at: string;
	sources: PublicationsPayloadSource[];
	stats: {
		total: number;
		by_type: Record<string, number>;
		/** Per-source counts. Cross-listed records contribute to both. */
		by_source: Record<string, number>;
		/** Mutually exclusive bucket counts: ``{ eref: <ERef-only>, epub:
		 *  <EPub-only>, both: <cross-listed> }``. Sums to ``total``. */
		by_source_only: Record<string, number>;
		cross_listed: number;
		matched_contributors: number;
		total_contributors: number;
	};
	publications: Publication[];
}
