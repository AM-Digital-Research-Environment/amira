<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		contentHeight?: string;
		class?: string;
		children: Snippet;
		headerExtra?: Snippet;
	}

	let {
		title,
		subtitle,
		contentHeight = 'h-chart-md',
		class: className = '',
		children,
		headerExtra
	}: Props = $props();
</script>

<div class={cn('chart-card', className)}>
	<div class="chart-card-header">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
			<div>
				<h3 class="chart-card-title">{title}</h3>
				{#if subtitle}
					<p class="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
				{/if}
			</div>
			{#if headerExtra}
				{@render headerExtra()}
			{/if}
		</div>
	</div>
	<div class={cn('chart-card-content', contentHeight)}>
		{@render children()}
	</div>
</div>
