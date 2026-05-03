<script lang="ts">
	import { Badge, Input } from '$lib/components/ui';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import ItemFilterPills from './ItemFilterPills.svelte';
	import ItemFilterOptionList from './ItemFilterOptionList.svelte';
	import type { FilterThemeName } from './filterThemes';

	interface Option {
		name: string;
		count: number;
	}

	interface Props {
		title: string;
		icon: Component;
		theme: FilterThemeName;
		/** All options for this facet (pre-trimmed by the caller — usually
		 *  filtered against `searchValue` and capped at 30). */
		options: Option[];
		/** Total option count, pre-search. Drives `searchHideThreshold` so the
		 *  search input only appears when there are enough options to warrant
		 *  it (e.g. ≥10 for languages). Defaults to `options.length`. */
		totalOptionCount?: number;
		selected: string[];
		expanded: boolean;
		onToggleExpanded: () => void;
		onToggle: (value: string) => void;
		onClear: () => void;
		/** Local search input value. */
		searchValue: string;
		onSearchChange: (value: string) => void;
		/** When `false`, hide the search input entirely (used by the methods
		 *  facet which has a small fixed list). */
		searchEnabled?: boolean;
		searchPlaceholder?: string;
		/** Show the search input only when the total option count ≥ this. */
		searchHideThreshold?: number;
		/** Optional label transform — used by languages to render BCP-47 codes
		 *  as human-readable names. */
		formatLabel?: (value: string) => string;
	}

	let {
		title,
		icon: Icon,
		theme,
		options,
		totalOptionCount,
		selected,
		expanded,
		onToggleExpanded,
		onToggle,
		onClear,
		searchValue,
		onSearchChange,
		searchEnabled = true,
		searchPlaceholder = 'Search...',
		searchHideThreshold = 0,
		formatLabel
	}: Props = $props();

	const total = $derived(totalOptionCount ?? options.length);
	const showSearch = $derived(searchEnabled && total >= searchHideThreshold);
</script>

<div class="border-t border-border pt-2">
	<button
		onclick={onToggleExpanded}
		class="flex items-center justify-between w-full text-xs font-medium text-muted-foreground"
	>
		<span class="flex items-center gap-1.5">
			<Icon class="h-3 w-3" />
			{title}
			{#if selected.length > 0}
				<Badge variant="secondary" class="text-2xs px-1.5 py-0">
					{#snippet children()}{selected.length}{/snippet}
				</Badge>
			{/if}
		</span>
		{#if expanded}
			<ChevronUp class="h-3.5 w-3.5" />
		{:else}
			<ChevronDown class="h-3.5 w-3.5" />
		{/if}
	</button>

	<ItemFilterPills {selected} {theme} {onToggle} {onClear} {formatLabel} />

	{#if expanded}
		<div class="mt-2 space-y-2">
			{#if showSearch}
				<Input
					placeholder={searchPlaceholder}
					value={searchValue}
					oninput={(e) => onSearchChange((e.currentTarget as HTMLInputElement).value)}
				/>
			{/if}
			<ItemFilterOptionList {options} {selected} {theme} {onToggle} {formatLabel} />
		</div>
	{/if}
</div>
