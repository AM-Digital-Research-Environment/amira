<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent, Badge } from '$lib/components/ui';
	import { Tag } from '@lucide/svelte';
	import { tagUrl } from '$lib/utils/urls';

	interface Props {
		tags: string[];
	}

	let { tags }: Props = $props();
</script>

{#if tags.length > 0}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}
							<span class="flex items-center gap-2">
								<Tag class="h-5 w-5 text-primary" />
								Tags
							</span>
						{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<div class="flex flex-wrap gap-1.5">
						{#each tags as tag (tag)}
							<a href={tagUrl(tag)} class="hover:opacity-80 transition-opacity">
								<Badge variant="outline" class="text-xs hover:bg-accent/20 transition-colors">
									{#snippet children()}{tag}{/snippet}
								</Badge>
							</a>
						{/each}
					</div>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}
