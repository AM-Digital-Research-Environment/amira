<script lang="ts">
	import { X } from '@lucide/svelte';
	import { FILTER_THEMES, type FilterThemeName } from './filterThemes';

	interface Props {
		/** Selected facet values (raw form — pass `formatLabel` if a transform
		 *  like `languageName(code)` should be applied at render time). */
		selected: string[];
		theme: FilterThemeName;
		onToggle: (value: string) => void;
		onClear: () => void;
		formatLabel?: (value: string) => string;
	}

	let { selected, theme, onToggle, onClear, formatLabel }: Props = $props();

	const pillClass = $derived(FILTER_THEMES[theme].pillClass);
</script>

{#if selected.length > 0}
	<div class="flex flex-wrap gap-1.5 mt-2">
		{#each selected as value (value)}
			<button
				onclick={() => onToggle(value)}
				class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors {pillClass}"
			>
				{formatLabel ? formatLabel(value) : value}
				<X class="h-3 w-3" />
			</button>
		{/each}
		<button
			onclick={onClear}
			class="text-2xs text-muted-foreground hover:text-foreground transition-colors px-1"
		>
			Clear
		</button>
	</div>
{/if}
