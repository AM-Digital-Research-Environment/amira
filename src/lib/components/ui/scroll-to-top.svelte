<script lang="ts">
	import { ArrowUp } from '@lucide/svelte';
	import { onDestroy, onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	interface Props {
		/** CSS selector for the scroll container. Defaults to `main`, which is
		 *  the scroller in the dashboard root layout. Falls back to window if
		 *  the selector resolves to something that isn't actually scrollable. */
		target?: string;
		/** Distance from the top of the scroller (px) before the button appears. */
		threshold?: number;
	}

	let { target = 'main', threshold = 400 }: Props = $props();

	let visible = $state(false);
	let scroller: HTMLElement | Window = $state() as HTMLElement | Window;

	function currentTop(): number {
		if (scroller instanceof Window) return scroller.scrollY;
		return scroller?.scrollTop ?? 0;
	}

	function onScroll() {
		visible = currentTop() > threshold;
	}

	function scrollToTop() {
		if (scroller instanceof Window) {
			scroller.scrollTo({ top: 0, behavior: 'smooth' });
		} else {
			scroller.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	onMount(() => {
		const el = document.querySelector(target) as HTMLElement | null;
		// If the selected element has its own scroll, target it; otherwise fall
		// back to window so the button works on pages without an inner scroller.
		const hasOwnScroll = el && el.scrollHeight > el.clientHeight;
		scroller = hasOwnScroll ? el : window;
		scroller.addEventListener('scroll', onScroll, { passive: true });
		onScroll();
	});

	onDestroy(() => {
		scroller?.removeEventListener('scroll', onScroll);
	});
</script>

{#if visible}
	<button
		type="button"
		class="scroll-top-btn"
		onclick={scrollToTop}
		aria-label="Scroll to top"
		transition:fly={{ y: 16, duration: 180 }}
	>
		<ArrowUp class="h-5 w-5" />
	</button>
{/if}

<style>
	.scroll-top-btn {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		z-index: 40;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 999px;
		border: 1px solid hsl(var(--border));
		background: hsl(var(--card));
		color: hsl(var(--card-foreground));
		box-shadow: 0 10px 30px -10px hsl(var(--foreground) / 0.25);
		cursor: pointer;
		transition:
			background 160ms ease,
			color 160ms ease,
			transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
	}
	.scroll-top-btn:hover,
	.scroll-top-btn:focus-visible {
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		outline: none;
		transform: translateY(-2px);
	}

	/* Hide when a modal dialog (e.g. the photo lightbox) is open — the
	   translucent backdrop lets the button bleed through otherwise. */
	:global(body:has([role='dialog'][aria-modal='true'])) .scroll-top-btn {
		display: none;
	}

	@media (min-width: 640px) {
		.scroll-top-btn {
			right: 1.5rem;
			bottom: 1.5rem;
		}
	}
</style>
