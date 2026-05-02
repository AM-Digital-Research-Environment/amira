<script lang="ts">
	import EntityDetailHeader from './EntityDetailHeader.svelte';

	interface Props {
		title: string;
		count?: number;
		useContent?: boolean;
		useBadges?: boolean;
	}

	let { title, count, useContent = false, useBadges = false }: Props = $props();
</script>

<EntityDetailHeader {title} {count}>
	{#snippet badges()}
		{#if useBadges}
			<span data-testid="extra-badge">Custom badge</span>
		{/if}
	{/snippet}
	{#snippet content()}
		{#if useContent}
			<div data-testid="extra-content">Extra content rows</div>
		{/if}
	{/snippet}
</EntityDetailHeader>
