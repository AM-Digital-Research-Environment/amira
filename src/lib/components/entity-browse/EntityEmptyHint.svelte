<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui';
	import type { Component } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		icon: Component;
	}

	let { title, description, icon: Icon }: Props = $props();
</script>

<Card class="overflow-hidden">
	{#snippet children()}
		<CardContent>
			{#snippet children()}
				<div class="flex flex-col items-center justify-center py-16 text-center">
					<Icon class="h-12 w-12 text-muted-foreground/50 mb-4" strokeWidth={1.5} />
					<p class="text-lg font-medium text-muted-foreground">{title}</p>
					{#if description}
						<p class="text-sm text-muted-foreground/70 mt-1 max-w-md">{description}</p>
					{/if}
				</div>
			{/snippet}
		</CardContent>
	{/snippet}
</Card>
