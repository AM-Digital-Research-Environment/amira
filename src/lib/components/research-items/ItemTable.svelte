<script lang="ts">
	import { Badge, ScrollableTable } from '$lib/components/ui';
	import type { CollectionItem } from '$lib/types';
	import { getItemTitle } from '$lib/utils/helpers';
	import { getContributors, getOrigins, formatDateInfo } from './itemHelpers';
	import { Calendar, MapPin, Briefcase, Users } from '@lucide/svelte';

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

	function originLabel(item: CollectionItem): string | null {
		const origins = getOrigins(item);
		if (!origins.length) return null;
		const o = origins[0];
		return o.country || o.region || o.city || null;
	}
</script>

<!--
	Two presentations of the same data, switched by the `sm` breakpoint:

	  • < 640 px   — vertical stack of cards. Each card is a tap target with
	    title, type badge, project line, and a meta row (contributors, origin,
	    date). No horizontal scroll, no hidden columns, no scroll-affordance
	    cues to misread. Industry-standard pattern for data tables on phones.

	  • ≥ 640 px   — the original 6-column table inside ScrollableTable, which
	    horizontally-scrolls inside its own wrapper if the viewport is still
	    narrower than the table's natural width.
-->

<!-- Mobile cards -->
<div class="sm:hidden space-y-2">
	{#each items as item (item._id || item.dre_id)}
		{@const contributors = contributorSummary(item)}
		{@const projName = item.project?.name || ''}
		{@const origin = originLabel(item)}
		{@const date = formatDateInfo(item)}
		<button
			type="button"
			onclick={() => onSelectItem(item)}
			class="w-full text-left rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-muted/30 transition-colors p-3 flex flex-col gap-2"
		>
			<div class="flex items-start justify-between gap-2">
				<h3 class="font-medium text-foreground text-sm leading-snug line-clamp-2">
					{getItemTitle(item)}
				</h3>
				{#if item.typeOfResource}
					<Badge variant="secondary" class="text-2xs whitespace-nowrap shrink-0">
						{#snippet children()}{item.typeOfResource}{/snippet}
					</Badge>
				{/if}
			</div>
			{#if projName}
				<div class="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
					<Briefcase class="h-3 w-3 shrink-0" />
					<span class="truncate">{projectShort(projName)}</span>
				</div>
			{/if}
			<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
				{#if contributors.display !== '—'}
					<span class="inline-flex items-center gap-1 min-w-0">
						<Users class="h-3 w-3 shrink-0" />
						<span class="truncate">{contributors.display}</span>
					</span>
				{/if}
				{#if origin}
					<span class="inline-flex items-center gap-1 min-w-0">
						<MapPin class="h-3 w-3 shrink-0" />
						<span class="truncate">{origin}</span>
					</span>
				{/if}
				{#if date}
					<span class="inline-flex items-center gap-1 whitespace-nowrap">
						<Calendar class="h-3 w-3 shrink-0" />
						{date}
					</span>
				{/if}
			</div>
		</button>
	{/each}
	{#if items.length === 0}
		<div
			class="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground"
		>
			No items found
		</div>
	{/if}
</div>

<!-- Desktop / tablet table -->
<div class="hidden sm:block">
	<ScrollableTable minWidth={800}>
		{#snippet children()}
			<table class="text-sm">
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
							<td colspan="6" class="px-4 py-8 text-center text-muted-foreground">
								No items found
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		{/snippet}
	</ScrollableTable>
</div>
