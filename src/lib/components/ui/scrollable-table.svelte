<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** The table markup — pass as children snippet. The component wraps it
		 *  in a horizontally-scrollable container so wide tables scroll inside
		 *  themselves rather than forcing the whole page to scroll on mobile. */
		children: Snippet;
		/** Minimum table width in px. Below this, horizontal scroll kicks in. */
		minWidth?: number;
		/** Maximum container height. When set, adds vertical scroll inside the
		 *  wrapper so long tables don't drag the whole app page along. `none`
		 *  (default) disables the cap and the table grows naturally. */
		maxHeight?: string;
		/** Extra classes on the outer wrapper. */
		class?: string;
	}

	let { children, minWidth = 800, maxHeight = 'none', class: className = '' }: Props = $props();

	let scrollEl: HTMLDivElement | undefined = $state();
	let atStart = $state(true);
	let atEnd = $state(false);

	function updateEdgeHints() {
		if (!scrollEl) return;
		const max = scrollEl.scrollWidth - scrollEl.clientWidth;
		atStart = scrollEl.scrollLeft <= 1;
		atEnd = scrollEl.scrollLeft >= max - 1 || max <= 0;
	}
</script>

<div
	class="scrollable-table {className}"
	class:at-start={atStart}
	class:at-end={atEnd}
	style:--min-width="{minWidth}px"
	style:--max-height={maxHeight}
>
	<div
		bind:this={scrollEl}
		class="scrollable-table-inner"
		onscroll={updateEdgeHints}
		onwheel={updateEdgeHints}
	>
		{@render children()}
	</div>
</div>

<style>
	.scrollable-table {
		position: relative;
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
		background: hsl(var(--card));
		margin-left: -1rem;
		margin-right: -1rem;
		overflow: hidden;
	}

	@media (min-width: 640px) {
		.scrollable-table {
			margin-left: 0;
			margin-right: 0;
		}
	}

	.scrollable-table-inner {
		overflow-x: auto;
		overflow-y: auto;
		max-height: var(--max-height, none);
		/* Touch devices: preserve momentum scrolling inside the wrapper rather
		   than bubbling the pan to the page scroller. */
		-webkit-overflow-scrolling: touch;
		overscroll-behavior-inline: contain;
	}

	.scrollable-table-inner :global(table) {
		min-width: var(--min-width, 800px);
		width: 100%;
		border-collapse: collapse;
	}

	/* Soft edge gradients signal that more content is scrollable sideways.
	   Hidden at the corresponding end so the cue disappears when the user
	   has scrolled as far as they can go. Kept behind pointer events so
	   taps pass through to the table. */
	.scrollable-table::before,
	.scrollable-table::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1.25rem;
		pointer-events: none;
		transition: opacity 180ms ease;
		z-index: 1;
	}
	.scrollable-table::before {
		left: 0;
		background: linear-gradient(to right, hsl(var(--card)), hsl(var(--card) / 0));
	}
	.scrollable-table::after {
		right: 0;
		background: linear-gradient(to left, hsl(var(--card)), hsl(var(--card) / 0));
	}
	.scrollable-table.at-start::before {
		opacity: 0;
	}
	.scrollable-table.at-end::after {
		opacity: 0;
	}
</style>
