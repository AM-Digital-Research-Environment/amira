<script lang="ts">
	import { Card, CardHeader, CardTitle, Badge, WissKILink } from '$lib/components/ui';
	import type { Component, Snippet } from 'svelte';

	interface Props {
		title: string;
		icon?: Component;
		iconColorClass?: string;
		subtitle?: string;
		count?: number;
		countLabel?: string;
		percentOfTotal?: number;
		wisskiCategory?: string;
		wisskiKey?: string;
		/** Extra badges rendered between count and WissKI link. */
		badges?: Snippet;
	}

	let {
		title,
		icon: Icon,
		iconColorClass = 'text-primary',
		subtitle,
		count,
		countLabel = 'item',
		percentOfTotal,
		wisskiCategory,
		wisskiKey,
		badges
	}: Props = $props();
</script>

<Card class="overflow-hidden">
	{#snippet children()}
		<CardHeader>
			{#snippet children()}
				<div class="min-w-0">
					<div class="flex items-center gap-2">
						{#if Icon}
							<Icon class="h-6 w-6 shrink-0 {iconColorClass}" />
						{/if}
						<CardTitle class="break-words">
							{#snippet children()}{title}{/snippet}
						</CardTitle>
					</div>
					{#if subtitle}
						<p class="text-sm text-muted-foreground mt-1">{subtitle}</p>
					{/if}
					<div class="flex flex-wrap gap-2 mt-3">
						{#if count !== undefined}
							<Badge variant="secondary">
								{#snippet children()}{count}
									{countLabel}{count !== 1 ? 's' : ''}{/snippet}
							</Badge>
						{/if}
						{#if percentOfTotal !== undefined}
							<Badge variant="outline">
								{#snippet children()}{percentOfTotal.toFixed(1)}% of total{/snippet}
							</Badge>
						{/if}
						{#if badges}
							{@render badges()}
						{/if}
						{#if wisskiCategory && wisskiKey}
							<WissKILink category={wisskiCategory} entityKey={wisskiKey} />
						{/if}
					</div>
				</div>
			{/snippet}
		</CardHeader>
	{/snippet}
</Card>
