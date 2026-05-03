<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui';
	import { Heart } from '@lucide/svelte';

	interface Props {
		sponsors: string[];
	}

	let { sponsors }: Props = $props();
</script>

{#if sponsors.length > 0}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}
							<span class="flex items-center gap-2">
								<Heart class="h-5 w-5 text-primary" />
								Sponsors
							</span>
						{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<ul class="space-y-1.5">
						{#each sponsors as sponsor (sponsor)}
							<li class="text-sm text-muted-foreground">{sponsor}</li>
						{/each}
					</ul>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}
