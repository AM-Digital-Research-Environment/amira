<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';

	const SITE_NAME = 'Africa Multiple WissKI Explorer';
	const SITE_URL = 'https://am-digital-research-environment.github.io/WissKI-dashboard';
	const DEFAULT_DESCRIPTION = 'Browse and visualize research data from the Africa Multiple Cluster of Excellence WissKI system';

	interface Props {
		title?: string;
		description?: string;
	}

	let { title = '', description = DEFAULT_DESCRIPTION }: Props = $props();

	let fullTitle = $derived(title ? `${title} | ${SITE_NAME}` : SITE_NAME);
	let canonicalUrl = $derived(`${SITE_URL}${$page.url.pathname}`);
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonicalUrl} />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content="{SITE_URL}{base}/logos/africamultiple.jpg" />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content="{SITE_URL}{base}/logos/africamultiple.jpg" />
</svelte:head>
