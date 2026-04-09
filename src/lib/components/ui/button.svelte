<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
		size?: 'default' | 'sm' | 'lg' | 'icon';
		class?: string;
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		children: Snippet;
		onclick?: (e: MouseEvent) => void;
		'aria-label'?: string;
		title?: string;
	}

	let {
		variant = 'default',
		size = 'default',
		class: className = '',
		disabled = false,
		type = 'button',
		children,
		onclick,
		'aria-label': ariaLabel,
		title
	}: Props = $props();

	const variants = {
		default:
			'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm hover:shadow-md active:shadow-sm transition-all duration-200',
		destructive:
			'bg-destructive text-destructive-foreground hover:bg-destructive-hover shadow-sm hover:shadow-md',
		outline:
			'border border-border bg-transparent hover:bg-accent hover:text-accent-foreground transition-colors',
		secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover transition-colors',
		ghost: 'hover:bg-accent/80 hover:text-accent-foreground transition-colors',
		link: 'text-primary underline-offset-4 hover:underline'
	};

	const sizes = {
		default: 'h-10 px-5 py-2',
		sm: 'h-9 rounded-lg px-3 text-sm',
		lg: 'h-12 rounded-xl px-8 text-base',
		icon: 'h-10 w-10'
	};
</script>

<button
	{type}
	{disabled}
	{onclick}
	aria-label={ariaLabel}
	{title}
	class={cn(
		'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
		variants[variant],
		sizes[size],
		className
	)}
>
	{@render children()}
</button>
