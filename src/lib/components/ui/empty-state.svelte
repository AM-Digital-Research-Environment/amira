<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { Component } from 'svelte';

	interface Props {
		message?: string;
		icon?: Component;
		class?: string;
	}

	let { message = 'No data available', icon, class: className = '' }: Props = $props();
</script>

<div class={cn('h-full flex items-center justify-center text-muted-foreground', className)}>
	<div class="text-center">
		{#if icon}
			{@const Icon = icon}
			<Icon class="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" strokeWidth={1.5} />
		{/if}
		<p>{message}</p>
	</div>
</div>
