<script lang="ts">
	/** Chips showing the subjects both sides have in common — hidden when
	 * there's no overlap so the page doesn't render an empty card. */
	import { Card, CardHeader, CardTitle, CardContent, Badge } from '$lib/components/ui';

	interface Props {
		shared: string[];
	}

	let { shared }: Props = $props();
</script>

{#if shared.length > 0}
	<Card>
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle>
						{#snippet children()}Shared subjects{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<div class="flex flex-wrap gap-2">
						{#each shared as subject (subject)}
							<Badge variant="secondary">{subject}</Badge>
						{/each}
					</div>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}
