<script lang="ts" generics="T extends string">
	import { cn } from '$lib/utils/cn';
	import type { Component } from 'svelte';

	interface Mode {
		id: string;
		label: string;
		icon?: Component;
	}

	interface Props {
		modes: Mode[];
		active: T;
		onChange: (id: T) => void;
	}

	let { modes, active, onChange }: Props = $props();
</script>

<div class="view-tabs" role="tablist">
	{#each modes as mode (mode.id)}
		{@const Icon = mode.icon}
		<button
			type="button"
			role="tab"
			aria-selected={mode.id === active}
			class={cn('view-tab', mode.id === active && 'view-tab-active')}
			onclick={() => onChange(mode.id as T)}
		>
			{#if Icon}
				<Icon class="h-4 w-4" />
			{/if}
			{mode.label}
		</button>
	{/each}
</div>

<style>
	.view-tabs {
		display: inline-flex;
		gap: 0.25rem;
		padding: 0.25rem;
		border-radius: var(--radius);
		background: hsl(var(--muted));
		border: 1px solid hsl(var(--border));
	}

	.view-tab {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.875rem;
		border-radius: calc(var(--radius) - 2px);
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: hsl(var(--muted-foreground));
		background: transparent;
		border: none;
		cursor: pointer;
		transition:
			background 160ms ease,
			color 160ms ease,
			box-shadow 160ms ease;
	}
	.view-tab:hover {
		color: hsl(var(--foreground));
	}
	.view-tab-active {
		background: hsl(var(--card));
		color: hsl(var(--foreground));
		box-shadow: 0 1px 2px hsl(var(--foreground) / 0.05);
	}
</style>
