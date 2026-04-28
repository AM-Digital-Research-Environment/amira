<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { AlertTriangle, Info, CheckCircle2, AlertCircle } from '@lucide/svelte';
	import type { Component, Snippet } from 'svelte';

	type Tone = 'info' | 'warning' | 'success' | 'danger';

	interface Props {
		tone?: Tone;
		title?: string;
		/** Override the default tone icon. Pass `null` to hide the icon entirely. */
		icon?: Component | null;
		/** When set, wrap the body in a `<details>` element so it can collapse. */
		collapsible?: boolean;
		/** Initial open state when `collapsible` is true. */
		open?: boolean;
		class?: string;
		children: Snippet;
	}

	let {
		tone = 'info',
		title,
		icon,
		collapsible = false,
		open = false,
		class: className = '',
		children
	}: Props = $props();

	const tones: Record<Tone, { container: string; iconClass: string; defaultIcon: Component }> = {
		info: {
			container: 'border-chart-2/30 bg-chart-2/5',
			iconClass: 'text-chart-2',
			defaultIcon: Info
		},
		warning: {
			container: 'border-amber-500/30 bg-amber-500/5',
			iconClass: 'text-amber-500',
			defaultIcon: AlertTriangle
		},
		success: {
			container: 'border-chart-1/30 bg-chart-1/5',
			iconClass: 'text-chart-1',
			defaultIcon: CheckCircle2
		},
		danger: {
			container: 'border-destructive/30 bg-destructive/5',
			iconClass: 'text-destructive',
			defaultIcon: AlertCircle
		}
	};

	let resolvedIcon = $derived(icon === undefined ? tones[tone].defaultIcon : icon);
</script>

<div class={cn('rounded-lg border p-4', tones[tone].container, className)}>
	{#if collapsible}
		<details {open} class="callout-details">
			<summary class="flex items-start gap-3 cursor-pointer list-none">
				{#if resolvedIcon}
					{@const Icon = resolvedIcon}
					<Icon class={cn('h-5 w-5 shrink-0 mt-0.5', tones[tone].iconClass)} />
				{/if}
				<div class="flex-1 min-w-0">
					{#if title}
						<p class="font-semibold text-foreground">{title}</p>
					{/if}
				</div>
				<span class="callout-chevron text-muted-foreground" aria-hidden="true">▾</span>
			</summary>
			<div class="callout-body mt-3 text-sm text-muted-foreground leading-relaxed">
				{@render children()}
			</div>
		</details>
	{:else}
		<div class="flex items-start gap-3">
			{#if resolvedIcon}
				{@const Icon = resolvedIcon}
				<Icon class={cn('h-5 w-5 shrink-0 mt-0.5', tones[tone].iconClass)} />
			{/if}
			<div class="flex-1 min-w-0 space-y-1">
				{#if title}
					<p class="font-semibold text-foreground">{title}</p>
				{/if}
				<div class="text-sm text-muted-foreground leading-relaxed">
					{@render children()}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.callout-chevron {
		display: inline-block;
		transition: transform 160ms ease;
	}
	.callout-details[open] .callout-chevron {
		transform: rotate(180deg);
	}
	.callout-details summary::-webkit-details-marker {
		display: none;
	}
</style>
