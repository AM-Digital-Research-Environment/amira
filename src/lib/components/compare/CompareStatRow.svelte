<script lang="ts">
	/**
	 * Three stat cards that head every compare view: items, a middle metric
	 * the caller picks (resource types or unique languages), and the subject
	 * overlap percentage. Replaces the three inline `<Card>`s that lived
	 * verbatim in `/compare-projects` and `/compare/[type]`.
	 */
	import { Card, CardContent } from '$lib/components/ui';
	import type { SubjectOverlap } from './compareProfile';

	interface Props {
		leftName: string;
		rightName: string;
		leftItems: number;
		rightItems: number;
		middleLabel: string;
		leftMiddle: number;
		rightMiddle: number;
		/** Caption beneath the middle metric numbers (e.g. "unique"). */
		middleCaption?: string;
		overlap: SubjectOverlap;
	}

	let {
		leftName,
		rightName,
		leftItems,
		rightItems,
		middleLabel,
		leftMiddle,
		rightMiddle,
		middleCaption,
		overlap
	}: Props = $props();
</script>

<div class="grid gap-4 md:grid-cols-3">
	<Card>
		{#snippet children()}
			<CardContent class="pt-6">
				{#snippet children()}
					<div class="text-center">
						<p class="text-sm text-muted-foreground mb-2">Items</p>
						<div class="flex items-center justify-center gap-4">
							<div>
								<div class="text-2xl font-bold text-chart-1">{leftItems}</div>
								<p class="text-xs text-muted-foreground max-w-[140px] truncate">{leftName}</p>
							</div>
							<span class="text-muted-foreground">vs</span>
							<div>
								<div class="text-2xl font-bold text-chart-2">{rightItems}</div>
								<p class="text-xs text-muted-foreground max-w-[140px] truncate">{rightName}</p>
							</div>
						</div>
					</div>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>

	<Card>
		{#snippet children()}
			<CardContent class="pt-6">
				{#snippet children()}
					<div class="text-center">
						<p class="text-sm text-muted-foreground mb-2">{middleLabel}</p>
						<div class="flex items-center justify-center gap-4">
							<div>
								<div class="text-2xl font-bold text-chart-1">{leftMiddle}</div>
								<p class="text-xs text-muted-foreground max-w-[140px] truncate">
									{middleCaption ?? leftName}
								</p>
							</div>
							<span class="text-muted-foreground">vs</span>
							<div>
								<div class="text-2xl font-bold text-chart-2">{rightMiddle}</div>
								<p class="text-xs text-muted-foreground max-w-[140px] truncate">
									{middleCaption ?? rightName}
								</p>
							</div>
						</div>
					</div>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>

	<Card>
		{#snippet children()}
			<CardContent class="pt-6">
				{#snippet children()}
					<div class="text-center">
						<p class="text-sm text-muted-foreground mb-2">Subject Overlap</p>
						<div class="text-3xl font-bold text-primary">{overlap.percentage}%</div>
						<p class="text-xs text-muted-foreground">
							{overlap.overlap} shared of {overlap.total} total
						</p>
					</div>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
</div>
