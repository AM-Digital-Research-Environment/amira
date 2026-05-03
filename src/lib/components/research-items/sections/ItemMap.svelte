<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui';
	import { MiniMap } from '$lib/components/charts';
	import { MapPin } from '@lucide/svelte';

	export interface ItemMapMarker {
		latitude: number;
		longitude: number;
		label: string;
		color?: string;
		kind?: 'origin' | 'current';
	}

	interface Props {
		markers: ItemMapMarker[];
	}

	let { markers }: Props = $props();

	let originCount = $derived(markers.filter((m) => m.kind !== 'current').length);
	let currentCount = $derived(markers.filter((m) => m.kind === 'current').length);
</script>

{#if markers.length > 0}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}
							<span class="flex items-center gap-2">
								<MapPin class="h-5 w-5 text-primary" />
								Location Map
							</span>
						{/snippet}
					</CardTitle>
					<div
						class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1"
					>
						{#if originCount > 0}
							<span class="inline-flex items-center gap-1.5">
								<span
									class="inline-block w-2.5 h-2.5 rounded-full border border-background"
									style="background-color: hsl(var(--chart-1))"
								></span>
								Origin{originCount > 1 ? 's' : ''} ({originCount})
							</span>
						{/if}
						{#if currentCount > 0}
							<span class="inline-flex items-center gap-1.5">
								<span
									class="inline-block w-2.5 h-2.5 rounded-full border border-background"
									style="background-color: hsl(var(--chart-2))"
								></span>
								Located at ({currentCount})
							</span>
						{/if}
					</div>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<MiniMap {markers} />
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}
