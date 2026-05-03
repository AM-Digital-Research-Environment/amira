<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent, Badge } from '$lib/components/ui';
	import { Tag } from '@lucide/svelte';
	import { subjectUrl } from '$lib/utils/urls';

	interface Props {
		subjects: string[];
	}

	let { subjects }: Props = $props();
</script>

{#if subjects.length > 0}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}
							<span class="flex items-center gap-2">
								<Tag class="h-5 w-5 text-primary" />
								Subjects
							</span>
						{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<div class="flex flex-wrap gap-2">
						{#each subjects as subject (subject)}
							<a href={subjectUrl(subject)} class="hover:opacity-80 transition-opacity">
								<Badge variant="secondary" class="hover:bg-primary/20 transition-colors">
									{#snippet children()}{subject}{/snippet}
								</Badge>
							</a>
						{/each}
					</div>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}
