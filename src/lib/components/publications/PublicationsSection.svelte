<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui';
	import { Library } from '@lucide/svelte';
	import type { Publication } from '$lib/types';
	import PublicationCard from './PublicationCard.svelte';
	import { downloadBibtexBulk, downloadRisBulk } from './zoteroExport';

	interface Props {
		/** Publications to render. Caller is responsible for filtering. */
		publications: Publication[];
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
		title = 'Publications',
		initialLimit = 5,
		showBulkExport = true,
		exportBaseName = 'publications'
	}: Props = $props();

	let expanded = $state(false);
	let visible = $derived(expanded ? publications : publications.slice(0, initialLimit));
	let hiddenCount = $derived(publications.length - visible.length);

	let exportBibtexName = $derived(`${exportBaseName}.bib`);
	let exportRisName = $derived(`${exportBaseName}.ris`);
</script>

{#if publications.length > 0}
	<Card>
		<CardHeader>
			<div class="flex flex-wrap items-center gap-2 justify-between">
				<CardTitle>
					<span class="inline-flex items-center gap-2">
						<Library class="h-4 w-4" />
						{title}
						<span class="text-sm font-normal text-muted-foreground">
							({publications.length})
						</span>
					</span>
				</CardTitle>
				{#if showBulkExport}
					<div class="flex items-center gap-2 text-xs">
						<button
							type="button"
							onclick={() => downloadBibtexBulk(publications, exportBibtexName)}
							class="text-muted-foreground hover:text-foreground transition-colors"
						>
							Export BibTeX
						</button>
						<span class="text-muted-foreground">·</span>
						<button
							type="button"
							onclick={() => downloadRisBulk(publications, exportRisName)}
							class="text-muted-foreground hover:text-foreground transition-colors"
						>
							Export RIS
						</button>
					</div>
				{/if}
			</div>
		</CardHeader>
		<CardContent class="space-y-3">
			{#each visible as pub (pub.id)}
				<PublicationCard publication={pub} />
			{/each}
			{#if hiddenCount > 0}
				<button
					type="button"
					onclick={() => (expanded = true)}
					class="w-full text-center text-sm text-muted-foreground hover:text-foreground py-2 rounded-lg hover:bg-muted/50 transition-colors"
				>
					Show {hiddenCount} more publication{hiddenCount === 1 ? '' : 's'}
				</button>
			{:else if publications.length > initialLimit}
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
