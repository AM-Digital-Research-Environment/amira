<script lang="ts">
	import { onDestroy } from 'svelte';
	import { X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		/** Whether the modal is currently open. */
		open: boolean;
		/** Called when the user dismisses the modal (Escape, backdrop click, close button). */
		onClose: () => void;
		/** ID of an element inside the modal that names it for assistive tech. */
		'aria-labelledby'?: string;
		/** Plain-text label when no labelling element is available. */
		'aria-label'?: string;
		/** Vertical alignment of the modal frame on the backdrop. */
		align?: 'center' | 'start';
		/** Show the built-in top-right close button. */
		showClose?: boolean;
		/** Extra classes merged onto the backdrop element. */
		class?: string;
		/** Modal contents (frame, body, etc.). */
		children: Snippet;
	}

	let {
		open,
		onClose,
		'aria-labelledby': ariaLabelledBy,
		'aria-label': ariaLabel,
		align = 'center',
		showClose = true,
		class: className = '',
		children
	}: Props = $props();

	let backdrop: HTMLDivElement | null = $state(null);
	let lastActive: HTMLElement | null = null;

	const FOCUSABLE_SELECTOR =
		'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

	function focusableInside(el: HTMLElement): HTMLElement[] {
		return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
			(node) => !node.hasAttribute('disabled') && node.tabIndex !== -1
		);
	}

	function handleKey(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			e.stopPropagation();
			onClose();
			return;
		}
		if (e.key === 'Tab' && backdrop) {
			const items = focusableInside(backdrop);
			if (items.length === 0) {
				e.preventDefault();
				backdrop.focus();
				return;
			}
			const first = items[0];
			const last = items[items.length - 1];
			const active = document.activeElement as HTMLElement | null;
			if (e.shiftKey && (active === first || !backdrop.contains(active))) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && (active === last || !backdrop.contains(active))) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	$effect(() => {
		if (typeof document === 'undefined') return;
		if (!open) return;

		lastActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		document.addEventListener('keydown', handleKey);

		// Move focus into the dialog so the focus-trap has somewhere to anchor.
		queueMicrotask(() => {
			if (!backdrop) return;
			const items = focusableInside(backdrop);
			(items[0] ?? backdrop).focus();
		});

		return () => {
			document.removeEventListener('keydown', handleKey);
			document.body.style.overflow = prevOverflow;
			// Defer focus restoration so it lands after the {#if open}
			// block has unmounted — focusing the trigger element while the
			// dialog is still being torn down has triggered subtle
			// re-render glitches in dev.
			const target = lastActive;
			if (target && typeof target.focus === 'function') {
				queueMicrotask(() => target.focus());
			}
		};
	});

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
	});
</script>

{#if open}
	<div
		bind:this={backdrop}
		class={cn(
			'modal-backdrop',
			align === 'start' ? 'modal-backdrop--start' : 'modal-backdrop--center',
			className
		)}
		role="dialog"
		aria-modal="true"
		aria-label={ariaLabelledBy ? undefined : ariaLabel}
		aria-labelledby={ariaLabelledBy}
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) onClose();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
	>
		{#if showClose}
			<button type="button" class="modal-close" onclick={onClose} aria-label="Close (Esc)">
				<X class="h-5 w-5" />
			</button>
		{/if}
		{@render children()}
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: 80;
		background: hsl(var(--background) / 0.92);
		backdrop-filter: blur(6px);
		display: flex;
		justify-content: center;
		padding: 2rem;
		overflow-y: auto;
		transition: left var(--duration-slow) var(--ease-expo-out);
		animation: modal-backdrop-fade-in 180ms ease-out;
	}
	@keyframes modal-backdrop-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.modal-backdrop {
			animation: none;
		}
	}
	.modal-backdrop:focus {
		outline: none;
	}
	.modal-backdrop--center {
		align-items: center;
	}
	.modal-backdrop--start {
		align-items: flex-start;
	}

	@media (max-width: 900px) {
		.modal-backdrop {
			padding: 1rem;
		}
		.modal-backdrop--center {
			align-items: flex-start;
		}
	}

	/* Inset by the live sidebar width so the dialog is centered in the
	   visible content area, not the raw viewport. The variable is set by
	   +layout.svelte and updates as the rail collapses / expands. */
	@media (min-width: 1024px) {
		.modal-backdrop {
			left: var(--sidebar-offset, 0px);
		}
	}

	.modal-close {
		position: absolute;
		top: 1rem;
		right: 1rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 999px;
		background: hsl(var(--card));
		color: hsl(var(--card-foreground));
		border: 1px solid hsl(var(--border));
		cursor: pointer;
		z-index: 2;
		transition:
			background 160ms ease,
			color 160ms ease;
	}
	.modal-close:hover {
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
	}
</style>
