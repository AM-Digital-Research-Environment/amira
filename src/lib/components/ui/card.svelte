<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		id?: string;
		style?: string;
		variant?: 'default' | 'elevated' | 'accent';
		children: Snippet;
	}

	let { class: className = '', id, style, variant = 'default', children }: Props = $props();

	const variants = {
		default:
			'rounded-xl border border-border/60 bg-card text-card-foreground shadow-xs hover:shadow-sm transition-shadow duration-normal ease-expo-out',
		elevated: 'card-elevated text-card-foreground',
		accent: 'rounded-xl border border-border/60 bg-card text-card-foreground shadow-xs card-accent'
	};
</script>

<div {id} {style} class={cn(variants[variant], className)}>
	{@render children()}
</div>
