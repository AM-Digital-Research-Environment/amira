<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { ChevronDown } from '@lucide/svelte';

	interface Option {
		value: string;
		label: string;
		title?: string;
	}

	interface OptionGroup {
		label: string;
		options: Option[];
	}

	interface Props {
		options?: Option[];
		groups?: OptionGroup[];
		value?: string;
		placeholder?: string;
		class?: string;
		onchange?: (value: string) => void;
	}

	let {
		options = [],
		groups = [],
		value = $bindable(''),
		placeholder = 'Select...',
		class: className = '',
		onchange
	}: Props = $props();

	let inputText = $state('');
	let open = $state(false);
	let inputEl: HTMLInputElement | undefined = $state();
	let listEl: HTMLDivElement | undefined = $state();
	let highlightIndex = $state(-1);

	// Flatten all options
	let allOptions = $derived.by(() => {
		if (groups.length > 0) {
			return [...options, ...groups.flatMap((g) => g.options)];
		}
		return options;
	});

	// Sync display text when value changes externally
	$effect(() => {
		if (!open) {
			const opt = allOptions.find((o) => o.value === value);
			inputText = opt?.label || '';
		}
	});

	// Filter by typed text
	let filteredOptions = $derived.by(() => {
		if (!open) return options;
		const q = inputText.toLowerCase().trim();
		if (!q) return options;
		return options.filter(
			(o) => o.label.toLowerCase().includes(q) || (o.title && o.title.toLowerCase().includes(q))
		);
	});

	let filteredGroups = $derived.by(() => {
		if (!open) return groups;
		const q = inputText.toLowerCase().trim();
		if (!q) return groups;
		return groups
			.map((g) => ({
				...g,
				options: g.options.filter(
					(o) => o.label.toLowerCase().includes(q) || (o.title && o.title.toLowerCase().includes(q))
				)
			}))
			.filter((g) => g.options.length > 0);
	});

	let flatFiltered = $derived.by(() => {
		if (groups.length > 0) {
			return [...filteredOptions, ...filteredGroups.flatMap((g) => g.options)];
		}
		return filteredOptions;
	});

	function selectOption(optionValue: string) {
		value = optionValue;
		onchange?.(optionValue);
		open = false;
		highlightIndex = -1;
		const opt = allOptions.find((o) => o.value === optionValue);
		inputText = opt?.label || '';
	}

	function handleFocus() {
		open = true;
		inputText = '';
		highlightIndex = -1;
	}

	function handleBlur(e: FocusEvent) {
		const related = e.relatedTarget as HTMLElement | null;
		if (listEl?.contains(related)) return;
		setTimeout(() => {
			if (!open) return;
			open = false;
			highlightIndex = -1;
			// Restore display to current selection
			const opt = allOptions.find((o) => o.value === value);
			inputText = opt?.label || '';
		}, 150);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (!open) {
				open = true;
				return;
			}
			highlightIndex = Math.min(highlightIndex + 1, flatFiltered.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightIndex = Math.max(highlightIndex - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (highlightIndex >= 0 && highlightIndex < flatFiltered.length) {
				selectOption(flatFiltered[highlightIndex].value);
			}
		} else if (e.key === 'Escape') {
			open = false;
			highlightIndex = -1;
			const opt = allOptions.find((o) => o.value === value);
			inputText = opt?.label || '';
			inputEl?.blur();
		}
	}

	// Reset highlight when filter changes
	$effect(() => {
		flatFiltered;
		highlightIndex = -1;
	});
</script>

<!-- isolate keeps the dropdown above sibling stacking contexts (stat cards,
	chart cards) that animate with transforms. -->
<div class={cn('relative isolate', className)} style="z-index: 50;">
	<div class="relative">
		<input
			bind:this={inputEl}
			type="text"
			{placeholder}
			bind:value={inputText}
			onfocus={handleFocus}
			onblur={handleBlur}
			onkeydown={handleKeydown}
			class="flex h-10 w-full rounded-lg border border-input bg-background pl-3 pr-8 py-2 text-sm ring-offset-background transition-[border-color,box-shadow] duration-fast ease-out placeholder:text-muted-foreground hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-transparent"
		/>
		<ChevronDown
			class="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
		/>
	</div>

	{#if open}
		<div
			bind:this={listEl}
			class="absolute z-dropdown mt-1 w-full max-h-60 overflow-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
		>
			{#if groups.length > 0}
				{#if filteredOptions.length > 0}
					{#each filteredOptions as option, i (option.value)}
						<button
							type="button"
							onmousedown={(e) => {
								e.preventDefault();
								selectOption(option.value);
							}}
							title={option.title || option.label}
							class="w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors truncate
								{option.value === value ? 'bg-primary/10 text-primary font-medium' : ''}
								{i === highlightIndex ? 'bg-muted' : 'hover:bg-muted'}"
						>
							{option.label}
						</button>
					{/each}
				{/if}
				{#each filteredGroups as group (group.label)}
					<div
						class="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-popover border-b border-border/50"
					>
						{group.label}
					</div>
					{#each group.options as option (option.value)}
						{@const flatIndex = flatFiltered.indexOf(option)}
						<button
							type="button"
							onmousedown={(e) => {
								e.preventDefault();
								selectOption(option.value);
							}}
							title={option.title || option.label}
							class="w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors truncate
								{option.value === value ? 'bg-primary/10 text-primary font-medium' : ''}
								{flatIndex === highlightIndex ? 'bg-muted' : 'hover:bg-muted'}"
						>
							{option.label}
						</button>
					{/each}
				{/each}
			{:else}
				{#each filteredOptions as option, i (option.value)}
					<button
						type="button"
						onmousedown={(e) => {
							e.preventDefault();
							selectOption(option.value);
						}}
						title={option.title || option.label}
						class="w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors truncate
							{option.value === value ? 'bg-primary/10 text-primary font-medium' : ''}
							{i === highlightIndex ? 'bg-muted' : 'hover:bg-muted'}"
					>
						{option.label}
					</button>
				{/each}
			{/if}
			{#if flatFiltered.length === 0}
				<div class="px-3 py-4 text-sm text-muted-foreground text-center">No matches</div>
			{/if}
		</div>
	{/if}
</div>
