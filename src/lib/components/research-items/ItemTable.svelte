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

	function contributorSummary(item: CollectionItem): { display: string; full: string } {
		const c = getContributors(item);
		if (c.length === 0) return { display: '—', full: '' };
		const firstName = c[0].name.split(',')[0];
		const display = c.length > 1 ? `${firstName} +${c.length - 1}` : firstName;
		const full = c.map((x) => x.name).join('; ');
		return { display, full };
	}

	function projectShort(name: string): string {
		if (name.length <= 35) return name;
		const cut = name.lastIndexOf(' ', 35);
		return name.substring(0, cut > 20 ? cut : 35) + '…';
	}
</script>

<div class="overflow-x-auto rounded-lg border border-border -mx-4 sm:mx-0">
	<table class="w-full text-sm" style="min-width: 800px;">
		<thead>
			<tr class="border-b border-border bg-muted/50">
				<th
					class="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap"
					style="width:30%">Title</th
				>
				<th
					class="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap"
					style="width:8%">Type</th
				>
				<th
					class="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap"
					style="width:22%">Project</th
				>
				<th
					class="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap"
					style="width:18%">Contributors</th
				>
				<th
					class="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap"
					style="width:12%">Origin</th
				>
				<th
					class="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap"
					style="width:10%">Date</th
				>
			</tr>
		</thead>
		<tbody>
			{#each items as item (item._id || item.dre_id)}
				{@const contributors = contributorSummary(item)}
				{@const origins = getOrigins(item)}
				{@const projName = item.project?.name || ''}
				<tr
					onclick={() => onSelectItem(item)}
					class="border-b border-border last:border-b-0 hover:bg-muted/40 cursor-pointer transition-colors"
				>
					<td class="px-4 py-3">
						<span class="line-clamp-2 font-medium text-foreground">{getItemTitle(item)}</span>
					</td>
					<td class="px-4 py-3 whitespace-nowrap">
						{#if item.typeOfResource}
							<Badge variant="secondary" class="text-xs whitespace-nowrap">
								{#snippet children()}{item.typeOfResource}{/snippet}
							</Badge>
						{/if}
					</td>
					<td class="px-4 py-3" title={projName}>
						<span class="text-muted-foreground truncate block"
							>{projName ? projectShort(projName) : '—'}</span
						>
					</td>
					<td class="px-4 py-3" title={contributors.full}>
						<span class="text-muted-foreground truncate block">{contributors.display}</span>
					</td>
					<td class="px-4 py-3">
						{#if origins.length > 0}
							<span class="text-muted-foreground truncate block">
								{origins[0].country || origins[0].region || origins[0].city || '—'}
							</span>
						{:else}
							<span class="text-muted-foreground">—</span>
						{/if}
					</td>
					<td class="px-4 py-3">
						<span class="text-muted-foreground whitespace-nowrap"
							>{formatDateInfo(item) || '—'}</span
						>
					</td>
				</tr>
			{/each}
			{#if items.length === 0}
				<tr>
					<td colspan="6" class="px-4 py-8 text-center text-muted-foreground"> No items found </td>
				</tr>
			{/if}
		</tbody>
	</table>
</div>
