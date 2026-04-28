<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		type?: string;
		placeholder?: string;
		value?: string;
		class?: string;
		disabled?: boolean;
		id?: string;
		name?: string;
		autocomplete?: HTMLInputElement['autocomplete'];
		'aria-label'?: string;
		oninput?: (e: Event) => void;
	}

	let {
		type = 'text',
		placeholder = '',
		value = $bindable(''),
		class: className = '',
		disabled = false,
		id,
		name,
		autocomplete,
		'aria-label': ariaLabel,
		oninput
	}: Props = $props();

	const autoId = $props.id();
	const inputId = $derived(id ?? autoId);
	const inputName = $derived(name ?? autoId);
</script>

<input
	id={inputId}
	name={inputName}
	{type}
	{placeholder}
	{autocomplete}
	aria-label={ariaLabel}
	bind:value
	{disabled}
	{oninput}
	class={cn(
		'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-[border-color,box-shadow] duration-fast ease-out file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
/>
