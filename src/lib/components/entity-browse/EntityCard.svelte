<script lang="ts">
	import type { Snippet, Component } from 'svelte';

	interface Props {
		name: string;
		count?: number;
		/** Label paired with count, e.g. "items", "projects". Pluralized automatically. */
		countLabel?: string;
		/** Short descriptor shown under the name, e.g. language code or country. */
		subtitle?: string;
		/** Longer description shown after the subtitle, e.g. "Subject heading". */
		description?: string;
		icon?: Component;
		iconColorClass?: string;
		active?: boolean;
		onclick: () => void;
		/** Extra chips / metadata row beneath the main text. */
		meta?: Snippet;
	}

	let {
		name,
		count,
		countLabel = 'item',
		subtitle,
		description,
		icon: Icon,
		iconColorClass = 'text-muted-foreground group-hover:text-primary',
		active = false,
		onclick,
		meta
	}: Props = $props();

	let countText = $derived(
		count === undefined ? '' : `${count.toLocaleString()} ${countLabel}${count === 1 ? '' : 's'}`
	);
</script>

<button
	type="button"
	{onclick}
	class="group text-left rounded-xl border bg-card p-4 h-full flex flex-col transition-all duration-fast ease-out hover:shadow-sm hover:bg-muted/30 {active
		? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
		: 'border-border/60 hover:border-primary/40'}"
>
	<div class="flex items-start gap-3 min-w-0">
		{#if Icon}
			<div
				class="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0 transition-colors group-hover:bg-primary/10"
			>
				<Icon class="h-4 w-4 transition-colors {active ? 'text-primary' : iconColorClass}" />
			</div>
		{/if}
		<div class="min-w-0 flex-1">
			<h3 class="font-medium text-sm text-foreground break-words leading-snug">{name}</h3>
			{#if subtitle || description}
				<p class="text-xs text-muted-foreground mt-0.5 truncate">
					{subtitle ?? ''}{subtitle && description ? ' · ' : ''}{description ?? ''}
				</p>
			{/if}
		</div>
	</div>

	{#if count !== undefined || meta}
		<div class="mt-3 pt-3 border-t border-border/50 space-y-1.5">
			{#if count !== undefined}
				<p class="text-xs font-medium text-muted-foreground">{countText}</p>
			{/if}
			{#if meta}
				<div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					{@render meta()}
				</div>
			{/if}
		</div>
	{/if}
</button>
