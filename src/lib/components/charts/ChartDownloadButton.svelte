<script lang="ts">
	import { Download } from '@lucide/svelte';
	import type { EChartsType } from 'echarts/core';
	import { theme } from '$lib/stores/data';
	import { THEME_COLORS, FONT_FAMILY } from '$lib/styles';
	import { cn } from '$lib/utils/cn';

	interface Props {
		/** Lazy accessor for the chart instance. Called at click time so we
		 * always read the latest instance (charts can be re-init'd on
		 * theme/option changes). Return null if the chart isn't ready. */
		getChart: () => EChartsType | null;
		/** Used for the downloaded file name (auto-slugified). */
		filename: string;
		/** Rendered at the top of the exported PNG. */
		title: string;
		/** Optional second line rendered under the title in the exported PNG. */
		subtitle?: string;
		class?: string;
	}

	let { getChart, filename, title, subtitle = '', class: className = '' }: Props = $props();

	let busy = $state(false);

	function slugify(value: string): string {
		const cleaned = value
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 120);
		return cleaned || 'chart';
	}

	/**
	 * Compose the chart PNG together with the card's title + subtitle onto
	 * one canvas so the exported image is self-contained. ECharts' own
	 * getDataURL() only captures what's inside the chart container, so we
	 * have to draw the header text ourselves.
	 */
	async function handleDownload() {
		if (busy) return;
		const chart = getChart();
		if (!chart) return;

		busy = true;
		try {
			const isDark = $theme === 'dark';
			const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
			const pixelRatio = 2;

			// Canvas text rendering falls back to a system font if a web font
			// (Fraunces / Plus Jakarta Sans) isn't loaded when measureText
			// runs. Waiting on document.fonts.ready — and eagerly loading the
			// two sizes we'll paint — guarantees the exported PNG uses the
			// same typography as the live page.
			if (typeof document !== 'undefined' && document.fonts) {
				try {
					await Promise.all([
						document.fonts.load(`600 22px ${FONT_FAMILY.display}`),
						document.fonts.load(`400 14px ${FONT_FAMILY.sans}`)
					]);
					await document.fonts.ready;
				} catch {
					// Non-fatal — fall through and let canvas pick a fallback.
				}
			}

			const chartDataUrl = chart.getDataURL({
				type: 'png',
				pixelRatio,
				backgroundColor: colors.card,
				excludeComponents: ['toolbox']
			});

			const chartImage = new Image();
			await new Promise<void>((resolve, reject) => {
				chartImage.onload = () => resolve();
				chartImage.onerror = () => reject(new Error('Failed to load chart image'));
				chartImage.src = chartDataUrl;
			});

			// Layout in CSS pixels, scaled by pixelRatio at draw time to keep
			// the composite sharp at the chart's native 2x resolution.
			const paddingX = 32 * pixelRatio;
			const paddingTop = 28 * pixelRatio;
			const paddingBottom = 20 * pixelRatio;
			const titleFontPx = 22 * pixelRatio;
			const subtitleFontPx = 14 * pixelRatio;
			const titleGap = 8 * pixelRatio;
			const footerFontPx = 11 * pixelRatio;
			const footerBlock = 28 * pixelRatio;

			const headerHeight =
				paddingTop + titleFontPx + (subtitle ? titleGap + subtitleFontPx : 0) + paddingBottom;

			const width = chartImage.naturalWidth;
			const height = chartImage.naturalHeight + headerHeight + footerBlock;

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('Canvas 2D context unavailable');

			ctx.fillStyle = colors.card;
			ctx.fillRect(0, 0, width, height);

			// Title — matches .chart-card-title: display serif (Fraunces),
			// semibold, tight tracking. Canvas2D has no letter-spacing API,
			// so we approximate the tracking with font weight alone.
			ctx.textBaseline = 'top';
			ctx.textAlign = 'left';
			ctx.fillStyle = colors.foreground;
			ctx.font = `600 ${titleFontPx}px ${FONT_FAMILY.display}`;
			ctx.fillText(title, paddingX, paddingTop, width - paddingX * 2);

			// Subtitle
			if (subtitle) {
				ctx.fillStyle = colors.mutedForeground;
				ctx.font = `400 ${subtitleFontPx}px ${FONT_FAMILY.sans}`;
				ctx.fillText(subtitle, paddingX, paddingTop + titleFontPx + titleGap, width - paddingX * 2);
			}

			// Thin divider between header and chart
			ctx.fillStyle = colors.border;
			ctx.fillRect(paddingX, headerHeight - 1, width - paddingX * 2, 1);

			ctx.drawImage(chartImage, 0, headerHeight);

			// Footer: export date, right-aligned
			const stamp = new Date().toISOString().slice(0, 10);
			ctx.fillStyle = colors.chartTextMuted;
			ctx.font = `400 ${footerFontPx}px ${FONT_FAMILY.sans}`;
			ctx.textAlign = 'right';
			ctx.textBaseline = 'middle';
			ctx.fillText(stamp, width - paddingX, height - footerBlock / 2);

			const link = document.createElement('a');
			link.href = canvas.toDataURL('image/png');
			link.download = `${slugify(filename || title)}.png`;
			document.body.appendChild(link);
			link.click();
			link.remove();
		} catch (err) {
			console.error('Chart download failed:', err);
		} finally {
			busy = false;
		}
	}
</script>

<button
	type="button"
	onclick={handleDownload}
	disabled={busy}
	class={cn(
		'inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground',
		'hover:bg-secondary hover:text-foreground transition-colors',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
		'disabled:opacity-60 disabled:cursor-not-allowed',
		className
	)}
	aria-label="Download chart as PNG"
	title="Download chart as PNG"
>
	<Download class="h-4 w-4" aria-hidden="true" />
</button>
