<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';
	import { setChartRegistry, type ChartRegistry } from '$lib/components/charts/chart-registry';
	import ChartDownloadButton from '$lib/components/charts/ChartDownloadButton.svelte';

	interface Props {
		title: string;
		subtitle?: string;
		contentHeight?: string;
		class?: string;
		children: Snippet;
		headerExtra?: Snippet;
		/** Show a download-as-PNG button in the header. Defaults to true; set
		 * to false for cards wrapping non-ECharts content (e.g. maps). */
		downloadable?: boolean;
		/** Override the downloaded file name. Defaults to a slug of `title`. */
		downloadFilename?: string;
	}

	let {
		title,
		subtitle,
		contentHeight = 'h-chart-md',
		class: className = '',
		children,
		headerExtra,
		downloadable = true,
		downloadFilename
	}: Props = $props();

	// Reactive registry that a descendant EChart / WordCloud writes into on
	// mount. Svelte 5 tracks the property access below so the download button
	// appears as soon as the chart reports its instance.
	const registry = $state<ChartRegistry>({ instance: null });
	setChartRegistry(registry);
</script>

<div class={cn('chart-card', className)}>
	<div class="chart-card-header">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
			<div>
				<h2 class="chart-card-title">{title}</h2>
				{#if subtitle}
					<p class="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
				{/if}
			</div>
			<div class="flex items-center gap-2 shrink-0">
				{#if headerExtra}
					{@render headerExtra()}
				{/if}
				{#if downloadable && registry.instance}
					<ChartDownloadButton
						getChart={() => registry.instance}
						filename={downloadFilename ?? title}
						{title}
						{subtitle}
					/>
				{/if}
			</div>
		</div>
	</div>
	<div class={cn('chart-card-content', contentHeight)}>
		{@render children()}
	</div>
</div>
