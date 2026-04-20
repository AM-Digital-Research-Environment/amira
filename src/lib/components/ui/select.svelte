<script lang="ts">
	import { cn } from '$lib/utils/cn';

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

	function handleChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		value = target.value;
		onchange?.(target.value);
	}
</script>

<select
	{value}
	onchange={handleChange}
	class={cn(
		'flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-[border-color,box-shadow] duration-fast ease-out placeholder:text-muted-foreground hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
>
	<option value="" disabled>{placeholder}</option>
	{#each options as option (option.value)}
		<option value={option.value} title={option.title}>{option.label}</option>
	{/each}
	{#each groups as group (group.label)}
		<optgroup label={group.label}>
			{#each group.options as option (option.value)}
				<option value={option.value} title={option.title}>{option.label}</option>
			{/each}
		</optgroup>
	{/each}
</select>
