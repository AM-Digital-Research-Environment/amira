<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui';
	import { MapPin } from '@lucide/svelte';
	import { locationUrl } from '$lib/utils/urls';

	interface Origin {
		city?: string;
		region?: string;
		country?: string;
	}

	interface Props {
		origins: Origin[];
		currentLocations: string[];
	}

	let { origins, currentLocations }: Props = $props();
</script>

{#if origins.length > 0 || currentLocations.length > 0}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}
							<span class="flex items-center gap-2">
								<MapPin class="h-5 w-5 text-primary" />
								Location
							</span>
						{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<div class="space-y-4">
						{#if origins.length > 0}
							{#each origins as origin, i (i)}
								<div class="space-y-1.5">
									{#if origins.length > 1}
										<p class="text-xs font-semibold text-muted-foreground">Origin {i + 1}</p>
									{/if}
									{#if origin.country}
										<div class="flex items-center gap-2 text-sm">
											<span class="text-muted-foreground min-w-[80px] shrink-0">Country</span>
											<a
												href={locationUrl(origin.country)}
												class="text-foreground hover:text-primary transition-colors"
												>{origin.country}</a
											>
										</div>
									{/if}
									{#if origin.region}
										<div class="flex items-center gap-2 text-sm">
											<span class="text-muted-foreground min-w-[80px] shrink-0">Region</span>
											<a
												href={locationUrl(origin.region)}
												class="text-foreground hover:text-primary transition-colors"
												>{origin.region}</a
											>
										</div>
									{/if}
									{#if origin.city}
										<div class="flex items-center gap-2 text-sm">
											<span class="text-muted-foreground min-w-[80px] shrink-0">Subregion</span>
											<a
												href={locationUrl(origin.city)}
												class="text-foreground hover:text-primary transition-colors"
												>{origin.city}</a
											>
										</div>
									{/if}
								</div>
							{/each}
						{/if}
						{#if currentLocations.length > 0}
							<div class="space-y-1">
								<p class="text-xs font-semibold text-muted-foreground">Located at</p>
								{#each currentLocations as loc (loc)}
									<p class="text-sm text-foreground">{loc}</p>
								{/each}
							</div>
						{/if}
					</div>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}
