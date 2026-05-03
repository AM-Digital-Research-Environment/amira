<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui';
	import { StickyNote } from '@lucide/svelte';

	interface Props {
		note: string;
	}

	let { note }: Props = $props();
</script>

{#if note}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}
							<span class="flex items-center gap-2">
								<StickyNote class="h-5 w-5 text-primary" />
								Note
							</span>
						{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<p class="text-sm text-muted-foreground whitespace-pre-line break-words">{note}</p>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}
