<script lang="ts">
	import { Badge } from '$lib/components/ui';
	import type { CollectionItem } from '$lib/types';
	import { getItemTitle } from '$lib/utils/helpers';
	import { getContributors, getOrigins, formatDateInfo } from './itemHelpers';

	interface Props {
		items: CollectionItem[];
		onSelectItem: (item: CollectionItem) => void;
	}

	let { items, onSelectItem }: Props = $props();
</script>

<div class="overflow-x-auto rounded-lg border border-border">
	<table class="w-full text-sm">
		<thead>
			<tr class="border-b border-border bg-muted/50">
				<th class="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
				<th class="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
				<th class="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Project</th>
				<th class="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Contributors</th>
				<th class="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Origin</th>
				<th class="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Date</th>
			</tr>
		</thead>
		<tbody>
			{#each items as item}
				{@const contributors = getContributors(item)}
				{@const origins = getOrigins(item)}
				<tr
					onclick={() => onSelectItem(item)}
					class="border-b border-border last:border-b-0 hover:bg-muted/40 cursor-pointer transition-colors"
				>
					<td class="px-4 py-3">
						<span class="line-clamp-2 font-medium text-foreground">{getItemTitle(item)}</span>
					</td>
					<td class="px-4 py-3 hidden sm:table-cell">
						{#if item.typeOfResource}
							<Badge variant="secondary" class="text-xs whitespace-nowrap">
								{#snippet children()}{item.typeOfResource}{/snippet}
							</Badge>
						{/if}
					</td>
					<td class="px-4 py-3 hidden lg:table-cell">
						<span class="text-muted-foreground truncate max-w-[150px] block">{item.project?.name || '—'}</span>
					</td>
					<td class="px-4 py-3 hidden md:table-cell">
						{#if contributors.length > 0}
							<span class="text-muted-foreground">
								{contributors[0].name}{#if contributors.length > 1}<span class="text-xs ml-1 opacity-60">+{contributors.length - 1}</span>{/if}
							</span>
						{:else}
							<span class="text-muted-foreground">—</span>
						{/if}
					</td>
					<td class="px-4 py-3 hidden xl:table-cell">
						{#if origins.length > 0}
							<span class="text-muted-foreground truncate max-w-[120px] block">
								{origins[0].country || origins[0].region || origins[0].city || '—'}
							</span>
						{:else}
							<span class="text-muted-foreground">—</span>
						{/if}
					</td>
					<td class="px-4 py-3 hidden lg:table-cell">
						<span class="text-muted-foreground whitespace-nowrap">{formatDateInfo(item) || '—'}</span>
					</td>
				</tr>
			{/each}
			{#if items.length === 0}
				<tr>
					<td colspan="6" class="px-4 py-8 text-center text-muted-foreground">
						No items found
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</div>
