<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui';

	interface Props {
		abstract: string;
	}

	let { abstract }: Props = $props();
</script>

{#if abstract}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}Abstract{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<p class="text-sm text-muted-foreground leading-relaxed break-words whitespace-pre-line">
						{abstract}
					</p>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}
