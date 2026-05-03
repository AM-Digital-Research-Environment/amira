<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui';
	import { Hash, ExternalLink } from '@lucide/svelte';
	import type { Identifier } from '$lib/utils/transforms/itemExtractors';

	interface Props {
		identifiers: Identifier[];
	}

	let { identifiers }: Props = $props();
</script>

{#if identifiers.length > 0}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}
							<span class="flex items-center gap-2">
								<Hash class="h-5 w-5 text-primary" />
								Identifiers
							</span>
						{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<div class="space-y-2">
						{#each identifiers as id (id.type + id.value)}
							<div class="flex items-baseline gap-3 text-sm">
								<span class="text-muted-foreground shrink-0 min-w-[80px]">{id.type}</span>
								{#if id.url}
									<a
										href={id.url}
										target="_blank"
										rel="noopener noreferrer"
										class="text-primary hover:underline font-mono text-xs break-all inline-flex items-center gap-1"
									>
										{id.value}<ExternalLink class="h-3 w-3 shrink-0" />
									</a>
								{:else}
									<span class="text-foreground font-mono text-xs break-all">{id.value}</span>
								{/if}
							</div>
						{/each}
					</div>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}
