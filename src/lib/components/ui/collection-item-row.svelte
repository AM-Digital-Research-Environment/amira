<script lang="ts">
	import { FileText, Calendar } from '@lucide/svelte';
	import type { CollectionItem } from '$lib/types';
	import { getItemTitle } from '$lib/utils/helpers';
	import { formatDateInfo } from '$lib/utils/transforms/itemFormatters';
	import { researchItemUrl } from '$lib/utils/urls';
	import type { Snippet } from 'svelte';

	let {
		item,
		showType = true,
		showProject = false,
		showDate = true,
		extraMetadata
	}: {
		item: CollectionItem;
		showType?: boolean;
		showProject?: boolean;
		showDate?: boolean;
		extraMetadata?: Snippet;
	} = $props();

	let dateLabel = $derived(showDate ? formatDateInfo(item) : '');
	let hasMeta = $derived(
		Boolean(extraMetadata) ||
			(showType && Boolean(item.typeOfResource)) ||
			(showProject && Boolean(item.project?.name)) ||
			Boolean(dateLabel)
	);
</script>

<li
	class="group flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-transparent transition-all duration-fast ease-out hover:bg-muted/60 hover:border-border/60"
>
	<FileText
		class="h-4 w-4 mt-0.5 text-muted-foreground shrink-0 transition-colors group-hover:text-primary"
	/>
	<div class="min-w-0">
		<a
			href={researchItemUrl(item._id || item.dre_id)}
			class="text-sm font-medium text-foreground hover:text-primary transition-colors break-words"
		>
			{getItemTitle(item)}
		</a>
		{#if hasMeta}
			<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
				{#if extraMetadata}
					{@render extraMetadata()}
				{/if}
				{#if showType && item.typeOfResource}
					<span class="text-xs text-muted-foreground">{item.typeOfResource}</span>
				{/if}
				{#if showProject && item.project?.name}
					<span class="text-xs text-muted-foreground"
						>{showType && item.typeOfResource ? '·' : ''} {item.project.name}</span
					>
				{/if}
				{#if dateLabel}
					<span
						class="inline-flex items-center gap-1 text-xs text-muted-foreground"
						title="Item date"
					>
						<Calendar class="h-3 w-3" />
						{dateLabel}
					</span>
				{/if}
			</div>
		{/if}
	</div>
</li>
