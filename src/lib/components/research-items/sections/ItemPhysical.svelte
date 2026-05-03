<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui';
	import { HardDrive } from '@lucide/svelte';
	import { base } from '$app/paths';
	import type { PhysicalInfo } from '$lib/utils/transforms/itemExtractors';

	interface Props {
		physicalDesc: PhysicalInfo | null;
	}

	let { physicalDesc }: Props = $props();
</script>

{#if physicalDesc}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}
							<span class="flex items-center gap-2">
								<HardDrive class="h-5 w-5 text-primary" />
								Physical Description
							</span>
						{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<div class="space-y-2 text-sm">
						{#if physicalDesc.type}
							<div class="flex gap-2">
								<span class="text-muted-foreground shrink-0 min-w-[80px]">Type</span>
								<span class="text-foreground">{physicalDesc.type}</span>
							</div>
						{/if}
						{#if physicalDesc.method}
							<div class="flex gap-2">
								<span class="text-muted-foreground shrink-0 min-w-[80px]">Method</span>
								<a
									href="{base}/research-items?method={encodeURIComponent(physicalDesc.method)}"
									class="text-foreground hover:text-primary transition-colors"
									>{physicalDesc.method}</a
								>
							</div>
						{/if}
						{#if physicalDesc.descriptions.length > 0}
							<div class="flex gap-2">
								<span class="text-muted-foreground shrink-0 min-w-[80px]">Format</span>
								<span class="text-foreground">{physicalDesc.descriptions.join(', ')}</span>
							</div>
						{/if}
						{#if physicalDesc.technical.length > 0}
							<div class="flex gap-2">
								<span class="text-muted-foreground shrink-0 min-w-[80px]">Technical property</span>
								<span class="text-foreground">{physicalDesc.technical.join(', ')}</span>
							</div>
						{/if}
						{#if physicalDesc.notes.length > 0}
							<div class="flex gap-2">
								<span class="text-muted-foreground shrink-0 min-w-[80px]">Notes</span>
								<span class="text-foreground">{physicalDesc.notes.join(', ')}</span>
							</div>
						{/if}
					</div>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}
