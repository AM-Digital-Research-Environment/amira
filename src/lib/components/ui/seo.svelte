<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';

	// Canonical site name (used in `og:site_name`, the `<title>` suffix and
	// the `WebSite` JSON-LD `name`). AMIRA is exposed as the short
	// `alternateName` so Google can surface either form.
	// Google's site-name docs: the `WebSite` `name` should be the canonical,
	// concise brand name — not the page title.
	// https://developers.google.com/search/docs/appearance/site-names
	const SITE_NAME = 'Africa Multiple Interactive Research Atlas';
	const SITE_ALTERNATE_NAMES = ['AMIRA', 'Africa Multiple Atlas'];
	// SITE_URL already includes the base path (/amira), so when we build the
	// canonical URL we strip the same base from $page.url.pathname to avoid
	// duplicating it (e.g. /amira/amira/people).
	const SITE_URL = 'https://am-digital-research-environment.github.io/amira';
	const DEFAULT_DESCRIPTION =
		'Research metadata from the Africa Multiple Cluster of Excellence — an international research consortium at the University of Bayreuth linking partner centres across Africa, Brazil, and Germany.';
	// Baseline keywords applied to every page, augmented per route by the
	// `keywords` prop. Kept short and topical so search engines can blend
	// them with the page-specific tags without diluting relevance.
	const DEFAULT_KEYWORDS = [
		'Africa Multiple',
		'University of Bayreuth',
		'African studies',
		'research dashboard',
		'digital humanities',
		'cluster of excellence',
		'AMIRA'
	];
	const AUTHOR = 'Frédérick Madore';
	// Publisher org for the cluster — emitted as a stable `Organization` node
	// in the JSON-LD `@graph` so Google can attach a brand entity (logo,
	// `sameAs`) to the site.
	const ORG_NAME = 'Africa Multiple Cluster of Excellence';
	const ORG_ALT_NAME = 'Africa Multiple';
	const ORG_URL = 'https://www.africamultiple.uni-bayreuth.de/';
	const ORG_LOGO = `${SITE_URL}/logos/africamultiple.webp`;
	// Stable `@id` URIs so cross-references (`isPartOf`, `publisher`, `about`)
	// resolve inside the same `@graph`.
	const WEBSITE_ID = `${SITE_URL}/#website`;
	const ORGANIZATION_ID = `${SITE_URL}/#organization`;

	interface Props {
		title?: string;
		description?: string;
		/** Page-specific keywords. Combined with DEFAULT_KEYWORDS (deduped). */
		keywords?: string[];
		/** Override OG image — defaults to the cluster logo. */
		image?: string;
		/** og:type — defaults to "website"; entity detail pages should pass
		 * "article" so search engines rank them as primary content. */
		type?: 'website' | 'article' | 'profile';
		/** Optional ISO date for `article:published_time` / structured data. */
		publishedTime?: string;
		/** Optional ISO date for `article:modified_time`. */
		modifiedTime?: string;
		/** JSON-LD structured data — gets serialised inside a
		 *  `<script type="application/ld+json">` block. Pass an object or an
		 *  array of objects. */
		structuredData?: Record<string, unknown> | Record<string, unknown>[];
	}

	let {
		title = '',
		description = DEFAULT_DESCRIPTION,
		keywords = [],
		image,
		type = 'website',
		publishedTime,
		modifiedTime,
		structuredData
	}: Props = $props();

	let fullTitle = $derived(title ? `${title} | ${SITE_NAME}` : SITE_NAME);

	let canonicalUrl = $derived.by(() => {
		let path: string = $page.url.pathname;
		if (base && path.startsWith(base)) path = path.slice(base.length);
		if (!path.startsWith('/')) path = '/' + path;
		// Preserve query strings on canonical URLs for entity detail pages
		// like `/people?name=John%20Smith` — they're distinct documents.
		const search = $page.url.search ?? '';
		return SITE_URL + (path === '/' ? '/' : path) + search;
	});

	let imageUrl = $derived(image ?? `${SITE_URL}${base}/logos/africamultiple.webp`);
	let mergedKeywords = $derived(Array.from(new Set([...keywords, ...DEFAULT_KEYWORDS])));

	// Schema.org type for the per-page node. WebPage is the right default —
	// `WebSite` is reserved for the (single) site-level node in the graph.
	let pageEntityType = $derived(
		type === 'article' ? 'Article' : type === 'profile' ? 'ProfilePage' : 'WebPage'
	);

	// Stable site-level node. Emitted on every page so Google has consistent
	// site-name signals regardless of which URL it crawls first. The
	// canonical brand name lives in `name`; the acronym + variants are
	// listed under `alternateName` per Google's site-name guidance.
	const websiteNode: Record<string, unknown> = {
		'@type': 'WebSite',
		'@id': WEBSITE_ID,
		name: SITE_NAME,
		alternateName: SITE_ALTERNATE_NAMES,
		url: `${SITE_URL}/`,
		description: DEFAULT_DESCRIPTION,
		inLanguage: 'en',
		publisher: { '@id': ORGANIZATION_ID }
	};

	// Brand entity with a crawlable logo. Helps Google associate the
	// favicon / knowledge-panel image with this site rather than inheriting
	// a generic GitHub Pages signal from the parent hostname.
	const organizationNode: Record<string, unknown> = {
		'@type': 'Organization',
		'@id': ORGANIZATION_ID,
		name: ORG_NAME,
		alternateName: ORG_ALT_NAME,
		url: ORG_URL,
		logo: {
			'@type': 'ImageObject',
			url: ORG_LOGO,
			contentUrl: ORG_LOGO
		},
		sameAs: ['https://www.africamultiple.uni-bayreuth.de/']
	};

	let pageNode = $derived<Record<string, unknown>>({
		'@type': pageEntityType,
		'@id': `${canonicalUrl}#webpage`,
		name: fullTitle,
		headline: title || SITE_NAME,
		description,
		url: canonicalUrl,
		image: imageUrl,
		inLanguage: 'en',
		isPartOf: { '@id': WEBSITE_ID },
		about: { '@id': ORGANIZATION_ID },
		publisher: { '@id': ORGANIZATION_ID },
		author: {
			'@type': 'Person',
			name: AUTHOR,
			url: 'https://www.frederickmadore.com/'
		},
		...(publishedTime ? { datePublished: publishedTime } : {}),
		...(modifiedTime ? { dateModified: modifiedTime } : {}),
		...(mergedKeywords.length > 0 ? { keywords: mergedKeywords.join(', ') } : {})
	});

	let structuredDataJson = $derived.by(() => {
		const extras = structuredData
			? Array.isArray(structuredData)
				? structuredData
				: [structuredData]
			: [];
		// Strip a top-level @context from each user-supplied node so the
		// graph carries a single context at the root.
		const extraNodes = extras.map((node) => {
			const { '@context': _ctx, ...rest } = node as Record<string, unknown>;
			return rest;
		});
		return JSON.stringify({
			'@context': 'https://schema.org',
			'@graph': [websiteNode, organizationNode, pageNode, ...extraNodes]
		});
	});
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	{#if mergedKeywords.length > 0}
		<meta name="keywords" content={mergedKeywords.join(', ')} />
	{/if}
	<link rel="canonical" href={canonicalUrl} />

	<!-- Open Graph -->
	<meta property="og:type" content={type} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content={imageUrl} />
	<meta property="og:locale" content="en_US" />
	{#if publishedTime}
		<meta property="article:published_time" content={publishedTime} />
	{/if}
	{#if modifiedTime}
		<meta property="article:modified_time" content={modifiedTime} />
	{/if}

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={imageUrl} />

	<!-- Structured Data. Wrapped in `<svelte:element>` so the script source is
	     bound through Svelte's reactive system, and content is JSON-stringified
	     above so it can never contain executable HTML. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html '<scr' + 'ipt type="application/ld+json">' + structuredDataJson + '</scr' + 'ipt>'}
</svelte:head>
