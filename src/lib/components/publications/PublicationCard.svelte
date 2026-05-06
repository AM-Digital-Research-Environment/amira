<script lang="ts">
	import { Card, CardContent, Badge } from '$lib/components/ui';
	import { ChevronDown, Download, ExternalLink, Link as LinkIcon } from '@lucide/svelte';
	import { base } from '$app/paths';
	import type { Publication, PublicationContributor } from '$lib/types';
	import { formatCitationTail, publicationTypeLabel } from './formatPublication';
	import { downloadBibtex, downloadRis } from './zoteroExport';
	import { languageName } from '$lib/utils/languages';

	interface Props {
		publication: Publication;
		/** When provided, keyword chips render as buttons that invoke this
		 *  callback. Lets the /publications page wire chips into its
		 *  keyword filter; pages that don't filter (e.g. person detail)
		 *  omit it and chips stay static. */
		onKeywordClick?: (keyword: string) => void;
	}

	let { publication, onKeywordClick }: Props = $props();

	let primaryContributors = $derived<PublicationContributor[]>(
		publication.authors && publication.authors.length > 0
			? publication.authors
			: (publication.editors ?? [])
	);

	let contributorRole = $derived(
		publication.authors && publication.authors.length > 0 ? '' : 'eds.'
	);

	let citationTail = $derived(formatCitationTail(publication));

	// Long abstracts collapse to a 3-line snippet by default and expand on
	// click. The threshold is intentionally generous (450 chars ≈ 3 lines at
	// our type scale) so anything shorter shows in full without UI chrome.
	const ABSTRACT_THRESHOLD = 450;
	let abstractExpanded = $state(false);
	let abstractIsLong = $derived((publication.abstract?.length ?? 0) > ABSTRACT_THRESHOLD);
</script>

<Card class="hover:shadow-md transition-shadow animate-slide-in-up">
	<CardContent class="p-5 space-y-3">
		<!-- Header row: type + year/quarter -->
		<div class="flex items-center gap-2 flex-wrap">
			<Badge variant="secondary">{publicationTypeLabel(publication.type)}</Badge>
			{#if publication.year}
				<span class="text-xs text-muted-foreground tabular-nums">{publication.year}</span>
			{/if}
			{#if publication.language}
				<span
					class="text-xs text-muted-foreground"
					title="Publication language: {languageName(publication.language)}"
				>
					· {languageName(publication.language)}
				</span>
			{/if}
		</div>

		<!-- Title -->
		<h3 class="text-base font-semibold leading-snug">
			{publication.title}
		</h3>

		<!-- Contributors -->
		{#if primaryContributors.length > 0}
			<p class="text-sm text-muted-foreground">
				{#each primaryContributors as c, i (c.raw + i)}
					{#if i > 0},
					{/if}
					{#if c.person_id}
						<a
							href="{base}/people?name={encodeURIComponent(c.person_name ?? c.normalized)}"
							class="hover:text-foreground hover:underline transition-colors"
						>
							{c.normalized}
						</a>
					{:else}
						<span>{c.normalized}</span>
					{/if}
				{/each}
				{#if contributorRole}
					<span class="text-xs ml-1">({contributorRole})</span>
				{/if}
			</p>
		{/if}

		<!-- Citation tail -->
		{#if citationTail}
			<p class="text-sm text-foreground/80 italic">{citationTail}</p>
		{/if}

		<!-- Abstract (collapsible when long) -->
		{#if publication.abstract}
			<div class="text-sm text-foreground/85 leading-relaxed">
				{#if abstractIsLong && !abstractExpanded}
					<p class="line-clamp-3">{publication.abstract}</p>
					<button
						type="button"
						onclick={() => (abstractExpanded = true)}
						class="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						<ChevronDown class="h-3 w-3" /> Show abstract
					</button>
				{:else}
					<p>{publication.abstract}</p>
					{#if abstractIsLong}
						<button
							type="button"
							onclick={() => (abstractExpanded = false)}
							class="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
						>
							<ChevronDown class="h-3 w-3 rotate-180" /> Hide abstract
						</button>
					{/if}
				{/if}
			</div>
		{/if}

		<!-- Keywords -->
		{#if publication.keywords && publication.keywords.length > 0}
			<div class="flex flex-wrap gap-1.5">
				{#each publication.keywords as kw (kw)}
					{#if onKeywordClick}
						<button
							type="button"
							onclick={() => onKeywordClick?.(kw)}
							class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-normal text-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							title="Filter by keyword: {kw}"
						>
							{kw}
						</button>
					{:else}
						<Badge variant="outline" class="text-xs font-normal">{kw}</Badge>
					{/if}
				{/each}
			</div>
		{/if}

		<!-- Footer: links + export -->
		<div class="flex items-center gap-3 flex-wrap pt-2 border-t border-border/40 text-xs">
			{#if publication.doi}
				<a
					href="https://doi.org/{publication.doi}"
					target="_blank"
					rel="noopener"
					class="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
				>
					<LinkIcon class="h-3 w-3" /> DOI
				</a>
			{/if}
			{#if publication.eref_url}
				<a
					href={publication.eref_url}
					target="_blank"
					rel="noopener"
					class="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
				>
					<ExternalLink class="h-3 w-3" /> ERef
				</a>
			{/if}
			{#if publication.epub_url}
				<a
					href={publication.epub_url}
					target="_blank"
					rel="noopener"
					class="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
				>
					<ExternalLink class="h-3 w-3" /> EPub
				</a>
			{/if}
			{#if publication.url && publication.url !== publication.eref_url && publication.url !== publication.epub_url && !publication.url.includes('doi.org')}
				<a
					href={publication.url}
					target="_blank"
					rel="noopener"
					class="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
				>
					<ExternalLink class="h-3 w-3" /> Publisher
				</a>
			{/if}
			<span class="ml-auto inline-flex items-center gap-2">
				<button
					type="button"
					onclick={() => downloadBibtex(publication)}
					class="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
					title="Export to BibTeX (Zotero)"
				>
					<Download class="h-3 w-3" /> BibTeX
				</button>
				<button
					type="button"
					onclick={() => downloadRis(publication)}
					class="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
					title="Export to RIS (Zotero / EndNote)"
				>
					<Download class="h-3 w-3" /> RIS
				</button>
			</span>
		</div>
	</CardContent>
</Card>
