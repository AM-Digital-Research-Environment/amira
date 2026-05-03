<script lang="ts">
	import { FILTER_THEMES, type FilterThemeName } from './filterThemes';

	interface Option {
		name: string;
		count: number;
	}

	interface Props {
		options: Option[];
		selected: string[];
		theme: FilterThemeName;
		onToggle: (value: string) => void;
		formatLabel?: (value: string) => string;
	}

	let { options, selected, theme, onToggle, formatLabel }: Props = $props();

	const activeClass = $derived(FILTER_THEMES[theme].optionActiveClass);
</script>

<div class="space-y-0.5 max-h-32 overflow-y-auto">
	{#each options as opt (opt.name)}
		{@const isActive = selected.includes(opt.name)}
		<button
			onclick={() => onToggle(opt.name)}
			class="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted transition-colors flex items-center justify-between gap-2 {isActive
				? activeClass
				: ''}"
		>
			<span class="truncate">{formatLabel ? formatLabel(opt.name) : opt.name}</span>
			<span class="text-muted-foreground shrink-0">{opt.count}</span>
		</button>
	{/each}
</div>
