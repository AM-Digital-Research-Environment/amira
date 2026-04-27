<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { Component } from 'svelte';

	interface Props {
		value: string | number;
		label: string;
		subtitle?: string;
		icon?: Component;
		iconBgClass?: string;
		class?: string;
		animationDelay?: string;
	}

	let {
		value,
		label,
		subtitle,
		icon,
		iconBgClass = 'bg-primary/10',
		class: className = '',
		animationDelay
	}: Props = $props();
</script>

<div
	class={cn('stat-card animate-slide-in-up', className)}
	style={animationDelay ? `animation-delay: ${animationDelay}` : undefined}
>
	<div class="flex items-start justify-between gap-2">
		<div class="min-w-0 flex-1">
			<p class="text-sm font-medium text-muted-foreground">{label}</p>
			<p class="stat-value mt-2">{value}</p>
			{#if subtitle}
				<p class="text-xs text-muted-foreground mt-1">{subtitle}</p>
			{/if}
		</div>
		{#if icon}
			{@const Icon = icon}
			<div
				class={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', iconBgClass)}
			>
				<Icon class="h-5 w-5" />
			</div>
		{/if}
	</div>
</div>
