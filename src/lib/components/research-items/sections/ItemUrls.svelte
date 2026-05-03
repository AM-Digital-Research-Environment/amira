<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui';
	import { Link, ExternalLink } from '@lucide/svelte';

	interface Props {
		urls: string[];
	}

	let { urls }: Props = $props();
</script>

{#if urls.length > 0}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}
							<span class="flex items-center gap-2">
								<Link class="h-5 w-5 text-primary" />
								Links
							</span>
						{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<div class="space-y-2">
						{#each urls as url (url)}
							<a
								href={url}
								target="_blank"
								rel="noopener noreferrer"
								class="text-sm text-primary hover:underline break-all flex items-center gap-1.5"
							>
								<ExternalLink class="h-3.5 w-3.5 shrink-0" />
								{url}
							</a>
						{/each}
					</div>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}
