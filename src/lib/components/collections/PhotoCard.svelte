<script lang="ts">
	import type { CollectionItem } from '$lib/types';
	import {
		getPreviewImage,
		getDescriptiveTitle,
		getPrimaryDate,
		getLocationLabel
	} from './photoHelpers';
	import { MapPin, Calendar } from '@lucide/svelte';

	interface Props {
		item: CollectionItem;
		onSelect?: (item: CollectionItem) => void;
		/** Metadata shown below the image. "compact" hides location / date. */
		density?: 'default' | 'compact';
		/** When >1, the card represents `count` deduped records sharing the
		 *  same preview image. A badge is rendered on the frame. */
		count?: number;
	}

	let { item, onSelect, density = 'default', count = 1 }: Props = $props();

	let previewUrl = $derived(getPreviewImage(item));
	let title = $derived(getDescriptiveTitle(item));
	let date = $derived(getPrimaryDate(item));
	let location = $derived(getLocationLabel(item));

	let failed = $state(false);

	function handleClick() {
		onSelect?.(item);
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick();
		}
	}
</script>

<button type="button" class="photo-card" onclick={handleClick} onkeydown={handleKey}>
	<div class="photo-card-frame">
		{#if previewUrl && !failed}
			<img
				src={previewUrl}
				alt={title}
				loading="lazy"
				draggable="false"
				onerror={() => (failed = true)}
			/>
		{:else}
			<div class="photo-card-fallback">No image</div>
		{/if}
		{#if count > 1}
			<span class="photo-card-count" title="{count} records share this photo">
				× {count}
			</span>
		{/if}
	</div>

	<div class="photo-card-body">
		<h3 class="photo-card-title" {title}>{title}</h3>
		{#if density !== 'compact'}
			<div class="photo-card-meta">
				{#if date}
					<span class="photo-card-chip">
						<Calendar class="h-3 w-3" />
						{date.getFullYear()}
					</span>
				{/if}
				{#if location}
					<span class="photo-card-chip">
						<MapPin class="h-3 w-3" />
						{location}
					</span>
				{/if}
			</div>
		{/if}
	</div>
</button>

<style>
	.photo-card {
		display: block;
		width: 100%;
		padding: 0;
		text-align: left;
		background: hsl(var(--card));
		color: hsl(var(--card-foreground));
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
		overflow: hidden;
		cursor: pointer;
		transition:
			border-color 180ms ease,
			box-shadow 180ms ease,
			transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}
	.photo-card:hover,
	.photo-card:focus-visible {
		border-color: hsl(var(--primary) / 0.5);
		box-shadow: 0 6px 20px -10px hsl(var(--foreground) / 0.22);
		outline: none;
	}
	.photo-card:hover .photo-card-frame :global(img),
	.photo-card:focus-visible .photo-card-frame :global(img) {
		transform: scale(1.03);
	}

	.photo-card-frame {
		position: relative;
		width: 100%;
		background: hsl(var(--muted));
		overflow: hidden;
		display: flex;
	}

	.photo-card-count {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		font-size: var(--font-size-xs);
		font-weight: 600;
		padding: 0.125rem 0.5rem;
		background: hsl(var(--foreground) / 0.75);
		color: hsl(var(--background));
		border-radius: 999px;
		backdrop-filter: blur(4px);
	}
	.photo-card-frame :global(img) {
		width: 100%;
		height: auto;
		display: block;
		transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.photo-card-fallback {
		width: 100%;
		aspect-ratio: 4 / 3;
		display: flex;
		align-items: center;
		justify-content: center;
		color: hsl(var(--muted-foreground));
		font-size: var(--font-size-sm);
	}

	.photo-card-body {
		padding: 0.625rem 0.75rem 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.photo-card-title {
		font-size: var(--font-size-sm);
		font-weight: 500;
		line-height: var(--line-height-snug);
		color: hsl(var(--foreground));
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.photo-card-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.photo-card-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--font-size-xs);
		color: hsl(var(--muted-foreground));
		background: hsl(var(--muted));
		border-radius: 999px;
		padding: 0.125rem 0.5rem;
	}
</style>
