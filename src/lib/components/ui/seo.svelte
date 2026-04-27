<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';

	const SITE_NAME = 'Africa Multiple Interactive Research Atlas (AMIRA)';
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

	let baseStructuredData = $derived<Record<string, unknown>>({
		'@context': 'https://schema.org',
		'@type': type === 'article' ? 'Article' : type === 'profile' ? 'ProfilePage' : 'WebSite',
		name: fullTitle,
		headline: title || SITE_NAME,
		description,
		url: canonicalUrl,
		image: imageUrl,
		inLanguage: 'en',
		publisher: {
			'@type': 'Organization',
			name: 'Africa Multiple Cluster of Excellence',
			url: 'https://www.africamultiple.uni-bayreuth.de/'
		},
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
		const extra = structuredData
			? Array.isArray(structuredData)
				? structuredData
				: [structuredData]
			: [];
		const all = [baseStructuredData, ...extra];
		return JSON.stringify(all.length === 1 ? all[0] : all);
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
