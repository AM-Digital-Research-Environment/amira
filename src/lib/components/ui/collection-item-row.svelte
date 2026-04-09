<script lang="ts">
	import { FileText } from '@lucide/svelte';
	import type { CollectionItem } from '$lib/types';
	import { getItemTitle } from '$lib/utils/helpers';
	import { researchItemUrl } from '$lib/utils/urls';
	import type { Snippet } from 'svelte';

	let {
		item,
		showType = true,
		showProject = false,
		extraMetadata
	}: {
		item: CollectionItem;
		showType?: boolean;
		showProject?: boolean;
		extraMetadata?: Snippet;
	} = $props();
</script>

<li class="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
	<FileText class="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
	<div class="min-w-0">
		<a
			href={researchItemUrl(item._id || item.dre_id)}
			class="text-sm font-medium text-foreground hover:text-primary transition-colors break-words"
		>
			{getItemTitle(item)}
		</a>
		{#if showType || showProject || extraMetadata}
			<div class="flex flex-wrap items-center gap-2 mt-0.5">
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
			</div>
		{/if}
	</div>
</li>
