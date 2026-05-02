<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent, Badge, WissKILink } from '$lib/components/ui';
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
		/** Hide the auto-rendered top-right WissKILink even when category/key are set
		 *  — useful when the caller wants to embed a `<WissKILink>` inside `content`
		 *  alongside other entity metadata (project header pattern). */
		hideWisskiLink?: boolean;
		/** Extra badges rendered after count / percent, before the WissKILink. */
		badges?: Snippet;
		/** Additional structured content rendered as a `<CardContent>` block beneath
		 *  the header — for entity-specific metadata rows (e.g. project identifier,
		 *  duration, links). */
		content?: Snippet;
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
		hideWisskiLink = false,
		badges,
		content
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
					{#if count !== undefined || percentOfTotal !== undefined || badges || (wisskiCategory && wisskiKey && !hideWisskiLink)}
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
							{#if wisskiCategory && wisskiKey && !hideWisskiLink}
								<WissKILink category={wisskiCategory} entityKey={wisskiKey} />
							{/if}
						</div>
					{/if}
				</div>
			{/snippet}
		</CardHeader>
		{#if content}
			<CardContent>
				{#snippet children()}{@render content()}{/snippet}
			</CardContent>
		{/if}
	{/snippet}
</Card>
