<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent, Badge } from '$lib/components/ui';
	import { Target } from '@lucide/svelte';
	import { base } from '$app/paths';

	interface Props {
		audience: string[];
	}

	let { audience }: Props = $props();
</script>

{#if audience.length > 0}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}
							<span class="flex items-center gap-2">
								<Target class="h-5 w-5 text-primary" />
								Target Audience
							</span>
						{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<div class="flex flex-wrap gap-2">
						{#each audience as a (a)}
							<a
								href="{base}/research-items?audience={encodeURIComponent(a)}"
								class="hover:opacity-80 transition-opacity"
							>
								<Badge
									variant="secondary"
									class="hover:bg-primary/20 transition-colors cursor-pointer"
								>
									{#snippet children()}{a}{/snippet}
								</Badge>
							</a>
						{/each}
					</div>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}
