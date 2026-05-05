<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent, Badge } from '$lib/components/ui';
	import { Library } from '@lucide/svelte';
	import type { Publication } from '$lib/types';
	import PublicationCard from './PublicationCard.svelte';
	import { downloadBibtexBulk, downloadRisBulk } from './zoteroExport';
	import type { PublicationRole, PublicationByContributor } from './formatPublication';

	interface Props {
		/** Publications to render. Caller is responsible for filtering. Pass
		 *  either raw publications or `{ publication, role }` tuples. The
		 *  role variant lets the people-detail view distinguish between
		 *  authoring and editing a chapter / volume. */
		publications?: Publication[];
		entries?: PublicationByContributor[];
		/** Section title (e.g. ``Publications``, ``Cluster publications``). */
		title?: string;
		/** Maximum visible by default; the rest collapse behind a "Show all" toggle. */
		initialLimit?: number;
		/** When true, exposes BibTeX/RIS bulk-export buttons in the header. */
		showBulkExport?: boolean;
		/** File name for bulk export — defaults to ``publications`` if absent. */
		exportBaseName?: string;
	}

	let {
		publications,
		entries,
		title = 'Publications',
		initialLimit = 5,
		showBulkExport = true,
		exportBaseName = 'publications'
	}: Props = $props();

	const ROLE_LABEL: Record<PublicationRole, string> = {
		author: '',
		editor: 'as editor',
		book_editor: 'as book editor'
	};

	// Normalise both Props shapes into a single role-tagged list. When the
	// caller passed plain `publications`, we tag them all as ``author``
	// (the role label suppresses output for ``author`` so the UI is
	// indistinguishable from before).
	let resolvedEntries = $derived<PublicationByContributor[]>(
		entries ?? (publications ?? []).map((p) => ({ publication: p, role: 'author' as const }))
	);

	let total = $derived(resolvedEntries.length);
	let expanded = $state(false);
	let visibleEntries = $derived(
		expanded ? resolvedEntries : resolvedEntries.slice(0, initialLimit)
	);
	let hiddenCount = $derived(total - visibleEntries.length);

	let resolvedPublications = $derived(resolvedEntries.map((e) => e.publication));
	let exportBibtexName = $derived(`${exportBaseName}.bib`);
	let exportRisName = $derived(`${exportBaseName}.ris`);
</script>

{#if total > 0}
	<Card>
		<CardHeader>
			<div class="flex flex-wrap items-center gap-2 justify-between">
				<CardTitle>
					<span class="inline-flex items-center gap-2">
						<Library class="h-4 w-4" />
						{title}
						<span class="text-sm font-normal text-muted-foreground">
							({total})
						</span>
					</span>
				</CardTitle>
				{#if showBulkExport}
					<div class="flex items-center gap-2 text-xs">
						<button
							type="button"
							onclick={() => downloadBibtexBulk(resolvedPublications, exportBibtexName)}
							class="text-muted-foreground hover:text-foreground transition-colors"
						>
							Export BibTeX
						</button>
						<span class="text-muted-foreground">·</span>
						<button
							type="button"
							onclick={() => downloadRisBulk(resolvedPublications, exportRisName)}
							class="text-muted-foreground hover:text-foreground transition-colors"
						>
							Export RIS
						</button>
					</div>
				{/if}
			</div>
		</CardHeader>
		<CardContent class="space-y-3">
			{#each visibleEntries as entry (entry.publication.id)}
				<div class="space-y-1">
					{#if ROLE_LABEL[entry.role]}
						<Badge variant="outline" class="text-2xs uppercase tracking-wide">
							{ROLE_LABEL[entry.role]}
						</Badge>
					{/if}
					<PublicationCard publication={entry.publication} />
				</div>
			{/each}
			{#if hiddenCount > 0}
				<button
					type="button"
					onclick={() => (expanded = true)}
					class="w-full text-center text-sm text-muted-foreground hover:text-foreground py-2 rounded-lg hover:bg-muted/50 transition-colors"
				>
					Show {hiddenCount} more publication{hiddenCount === 1 ? '' : 's'}
				</button>
			{:else if total > initialLimit}
				<button
					type="button"
					onclick={() => (expanded = false)}
					class="w-full text-center text-sm text-muted-foreground hover:text-foreground py-2 rounded-lg hover:bg-muted/50 transition-colors"
				>
					Show fewer
				</button>
			{/if}
		</CardContent>
	</Card>
{/if}
