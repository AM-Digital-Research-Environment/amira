<script lang="ts">
	import type { CollectionItem } from '$lib/types';
	import { onDestroy } from 'svelte';
	import { fade, scale, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { X, ChevronLeft, ChevronRight, MapPin, Calendar, ExternalLink } from '@lucide/svelte';
	import {
		getPreviewImage,
		getDescriptiveTitle,
		getCreator,
		getPrimaryDate,
		getLocationLabel,
		getTopicLabels,
		getExternalUrl
	} from './photoHelpers';

	interface Props {
		items: CollectionItem[];
		/** Index into `items` of the currently open photo, or null to close. */
		index: number | null;
		onClose: () => void;
		onPrev: () => void;
		onNext: () => void;
		/** Optional map from item._id → number of deduped records sharing
		 *  the current photo. Shown as a "× N records" line in the meta. */
		countsById?: Map<string, number> | null;
	}

	let { items, index, onClose, onPrev, onNext, countsById = null }: Props = $props();

	let current = $derived(index !== null ? items[index] : null);
	let previewUrl = $derived(current ? getPreviewImage(current) : null);
	let title = $derived(current ? getDescriptiveTitle(current) : '');
	let creator = $derived(current ? getCreator(current) : null);
	let date = $derived(current ? getPrimaryDate(current) : null);
	let location = $derived(current ? getLocationLabel(current) : null);
	let topics = $derived(current ? getTopicLabels(current, 12) : []);
	let externalUrl = $derived(current ? getExternalUrl(current) : null);
	let aliasCount = $derived(current && countsById ? (countsById.get(current._id) ?? 1) : 1);

	function handleKey(e: KeyboardEvent) {
		if (index === null) return;
		if (e.key === 'Escape') onClose();
		else if (e.key === 'ArrowLeft') onPrev();
		else if (e.key === 'ArrowRight') onNext();
	}

	$effect(() => {
		if (typeof document === 'undefined') return;
		if (index !== null) {
			document.addEventListener('keydown', handleKey);
			document.body.style.overflow = 'hidden';
		}
		return () => {
			document.removeEventListener('keydown', handleKey);
			document.body.style.overflow = '';
		};
	});

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
	});
</script>

{#if current && previewUrl}
	<div
		class="lightbox-backdrop"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		onclick={(e) => {
			if (e.target === e.currentTarget) onClose();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
		tabindex="-1"
		transition:fade={{ duration: 180 }}
	>
		<button type="button" class="lightbox-close" onclick={onClose} aria-label="Close (Esc)">
			<X class="h-5 w-5" />
		</button>

		<button
			type="button"
			class="lightbox-nav lightbox-nav-prev"
			onclick={onPrev}
			aria-label="Previous (←)"
		>
			<ChevronLeft class="h-6 w-6" />
		</button>

		<button
			type="button"
			class="lightbox-nav lightbox-nav-next"
			onclick={onNext}
			aria-label="Next (→)"
		>
			<ChevronRight class="h-6 w-6" />
		</button>

		<div class="lightbox-frame" transition:scale={{ duration: 220, start: 0.96, easing: cubicOut }}>
			{#key current._id}
				<div class="lightbox-image" in:fade={{ duration: 180, delay: 60 }}>
					<img src={previewUrl} alt={title} draggable="false" />
				</div>
			{/key}
			<aside class="lightbox-meta">
				{#key current._id}
					<div
						class="lightbox-meta-inner"
						in:fly={{ duration: 220, x: 12, easing: cubicOut, delay: 40 }}
					>
						<h2 class="lightbox-title">{title}</h2>
						{#if creator}
							<p class="lightbox-creator">{creator}</p>
						{/if}
						{#if aliasCount > 1}
							<p class="lightbox-alias-note">
								This photo is shared by
								<strong>{aliasCount}</strong> records in this collection.
							</p>
						{/if}

						<dl class="lightbox-facts">
							{#if date}
								<div>
									<dt><Calendar class="h-3.5 w-3.5" /> Date</dt>
									<dd>
										{date.toLocaleDateString('en-GB', {
											year: 'numeric',
											month: 'long',
											day: 'numeric'
										})}
									</dd>
								</div>
							{/if}
							{#if location}
								<div>
									<dt><MapPin class="h-3.5 w-3.5" /> Location</dt>
									<dd>{location}</dd>
								</div>
							{/if}
						</dl>

						{#if topics.length > 0}
							<div class="lightbox-topics">
								{#each topics as topic (topic)}
									<span class="lightbox-topic">{topic}</span>
								{/each}
							</div>
						{/if}

						{#if externalUrl}
							<a href={externalUrl} target="_blank" rel="noopener noreferrer" class="lightbox-link">
								<ExternalLink class="h-3.5 w-3.5" />
								View in Collections@UBT
							</a>
						{/if}
					</div>
				{/key}
			</aside>
		</div>
	</div>
{/if}

<style>
	.lightbox-backdrop {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: 80;
		background: hsl(var(--background) / 0.92);
		backdrop-filter: blur(6px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		/* On mobile the backdrop itself scrolls so a tall metadata card
		   never clips off the bottom of the viewport. The frame grows
		   naturally; the backdrop is the scroll container. */
		overflow-y: auto;
		transition: left var(--duration-slow) var(--ease-expo-out);
	}

	@media (max-width: 900px) {
		.lightbox-backdrop {
			padding: 1rem;
			align-items: flex-start;
		}
	}

	/* Desktop: inset by the current sidebar width so the lightbox frame
	   is centered within the visible content area, not the raw viewport.
	   The `--sidebar-offset` variable comes from +layout.svelte and
	   updates live when the user collapses / expands the rail. */
	@media (min-width: 1024px) {
		.lightbox-backdrop {
			left: var(--sidebar-offset, 0px);
		}
	}

	.lightbox-close,
	.lightbox-nav {
		position: absolute;
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
		transition:
			background 160ms ease,
			color 160ms ease;
	}
	.lightbox-close:hover,
	.lightbox-nav:hover {
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
	}

	.lightbox-close {
		top: 1rem;
		right: 1rem;
		z-index: 2;
	}

	.lightbox-nav-prev {
		left: 1rem;
		top: 50%;
		transform: translateY(-50%);
	}
	.lightbox-nav-next {
		right: 1rem;
		top: 50%;
		transform: translateY(-50%);
	}

	.lightbox-frame {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
		gap: 1.5rem;
		width: 100%;
		max-width: 1200px;
		max-height: 100%;
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
		overflow: hidden;
	}

	@media (max-width: 900px) {
		.lightbox-frame {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto;
			max-height: none;
			overflow: visible;
		}
	}

	.lightbox-image {
		background: hsl(var(--muted));
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
	}
	.lightbox-image :global(img) {
		max-width: 100%;
		max-height: 80vh;
		object-fit: contain;
		display: block;
	}

	/* On mobile — especially portrait phones — tall photos previously filled
	   the screen and pushed the metadata card below the fold. Cap the image
	   at roughly half the viewport so title, date, topics etc. are visible
	   without scrolling inside the modal. */
	@media (max-width: 900px) {
		.lightbox-image :global(img) {
			max-height: 55vh;
		}
	}
	@media (max-width: 640px) and (orientation: portrait) {
		.lightbox-image :global(img) {
			max-height: 50vh;
		}
	}

	.lightbox-meta {
		padding: 1.5rem;
		overflow-y: auto;
	}

	/* On mobile meta flows naturally and the backdrop scrolls the whole
	   modal — nested scrollers inside a scrollable backdrop are awkward
	   on touch devices. */
	@media (max-width: 900px) {
		.lightbox-meta {
			overflow-y: visible;
		}
	}

	.lightbox-meta-inner {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.lightbox-title {
		font-family: var(--font-display);
		font-size: var(--font-size-xl);
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		line-height: var(--line-height-tight);
		color: hsl(var(--foreground));
	}

	.lightbox-creator {
		font-size: var(--font-size-sm);
		color: hsl(var(--chart-2));
		font-weight: 500;
	}

	.lightbox-alias-note {
		font-size: var(--font-size-xs);
		color: hsl(var(--muted-foreground));
		padding: 0.375rem 0.625rem;
		background: hsl(var(--muted));
		border-radius: calc(var(--radius) - 2px);
	}
	.lightbox-alias-note strong {
		color: hsl(var(--foreground));
	}

	.lightbox-facts {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: 0;
	}
	.lightbox-facts div {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.lightbox-facts dt {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
		color: hsl(var(--muted-foreground));
	}
	.lightbox-facts dd {
		font-size: var(--font-size-sm);
		color: hsl(var(--foreground));
	}

	.lightbox-topics {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}
	.lightbox-topic {
		font-size: var(--font-size-xs);
		color: hsl(var(--muted-foreground));
		background: hsl(var(--muted));
		border-radius: 999px;
		padding: 0.125rem 0.625rem;
	}

	.lightbox-link {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: var(--font-size-sm);
		color: hsl(var(--primary));
		text-decoration: none;
		font-weight: 500;
	}
	.lightbox-link:hover {
		text-decoration: underline;
	}
</style>
