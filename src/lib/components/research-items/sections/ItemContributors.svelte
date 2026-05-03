<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent, Badge } from '$lib/components/ui';
	import { Users } from '@lucide/svelte';
	import { institutionUrl } from '$lib/utils/urls';
	import { contributorUrl } from '$lib/utils/transforms/itemExtractors';
	import type { ContributorFull } from '$lib/utils/transforms/itemExtractors';

	interface Props {
		contributors: ContributorFull[];
	}

	let { contributors }: Props = $props();
</script>

{#if contributors.length > 0}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}
							<span class="flex items-center gap-2">
								<Users class="h-5 w-5 text-primary" />
								Contributors
							</span>
						{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<ul class="space-y-2">
						{#each contributors as contributor (contributor.name + (contributor.role ?? ''))}
							<li class="p-2 rounded-lg bg-muted/30">
								<div class="flex items-center justify-between gap-2">
									<a
										href={contributorUrl(contributor)}
										class="text-sm font-medium text-foreground hover:text-primary transition-colors"
									>
										{contributor.name}
									</a>
									<div class="flex items-center gap-1.5 shrink-0">
										{#if contributor.qualifier !== 'person'}
											<Badge variant="secondary" class="text-2xs">
												{#snippet children()}{contributor.qualifier}{/snippet}
											</Badge>
										{/if}
										{#if contributor.role}
											<Badge variant="outline" class="text-2xs">
												{#snippet children()}{contributor.role}{/snippet}
											</Badge>
										{/if}
									</div>
								</div>
								{#if contributor.affiliations.length > 0}
									<div class="mt-1">
										{#each contributor.affiliations as affl (affl)}
											<a
												href={institutionUrl(affl)}
												class="text-xs text-muted-foreground hover:text-primary transition-colors block"
											>
												{affl}
											</a>
										{/each}
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}
