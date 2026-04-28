<script lang="ts">
	import type { CollectionItem } from '$lib/types';
	import { onDestroy } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { X, ExternalLink, ArrowRight, BookOpen } from '@lucide/svelte';
	import { base } from '$app/paths';
	import { thumbnailManifest } from '$lib/stores/data';
	import {
		getPreviewImage,
		resolveThumbnailUrl,
		getDescriptiveTitle,
		getCreator,
		extractGroupIssueInfo,
		extractPageRange,
		sortByIssueOrder
	} from './photoHelpers';

	interface Props {
		/** Items in the issue / compilation. The first one is treated as
		 *  the cover-image source. Pass `null` to close the modal. */
		items: CollectionItem[] | null;
		onClose: () => void;
	}

	let { items, onClose }: Props = $props();

	let cover = $derived(items?.[0] ?? null);
	let originalCover = $derived(cover ? getPreviewImage(cover) : null);
	let coverUrl = $derived(resolveThumbnailUrl(originalCover, $thumbnailManifest, base));
	let issueInfo = $derived(items ? extractGroupIssueInfo(items) : null);
	let sortedItems = $derived(items ? sortByIssueOrder(items) : []);

	function articleUrl(item: CollectionItem): string {
		const id = item.dre_id || item._id;
		return `${base}/research-items?id=${encodeURIComponent(id)}`;
	}

	function externalUrl(item: CollectionItem): string | null {
		return item.url?.[0] ?? null;
	}

	function contributors(item: CollectionItem): string {
		const names = (item.name ?? [])
			.map((n) => n?.name?.label)
			.filter((n): n is string => Boolean(n));
		if (names.length === 0) return '';
		if (names.length <= 3) return names.join(', ');
		return `${names.slice(0, 3).join(', ')} and ${names.length - 3} other${names.length - 3 === 1 ? '' : 's'}`;
	}

	function handleKey(e: KeyboardEvent) {
		if (!items) return;
		if (e.key === 'Escape') onClose();
	}

	$effect(() => {
		if (typeof document === 'undefined') return;
		if (items) {
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

{#if items && cover}
	<div
		class="toc-backdrop"
		role="dialog"
		aria-modal="true"
		aria-label={issueInfo?.label ?? 'Issue table of contents'}
		onclick={(e) => {
			if (e.target === e.currentTarget) onClose();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
		tabindex="-1"
		transition:fade={{ duration: 180 }}
	>
		<button type="button" class="toc-close" onclick={onClose} aria-label="Close (Esc)">
			<X class="h-5 w-5" />
		</button>

		<div class="toc-frame" transition:scale={{ duration: 220, start: 0.96, easing: cubicOut }}>
			<aside class="toc-cover">
				{#if coverUrl}
					<img src={coverUrl} alt={issueInfo?.label ?? 'Issue cover'} draggable="false" />
				{/if}
			</aside>

			<section class="toc-body">
				<header class="toc-header">
					<p class="toc-eyebrow">
						<BookOpen class="h-3.5 w-3.5" />
						Table of contents
					</p>
					<h2 class="toc-title">{issueInfo?.label ?? 'Compilation'}</h2>
					<p class="toc-count">
						{sortedItems.length}
						{sortedItems.length === 1 ? 'article' : 'articles'} share this cover image.
					</p>
				</header>

				<ol class="toc-list">
					{#each sortedItems as item (item._id)}
						{@const pages = extractPageRange(item)}
						{@const creator = getCreator(item) || contributors(item)}
						{@const ext = externalUrl(item)}
						<li class="toc-item">
							<a class="toc-item-link" href={articleUrl(item)}>
								<div class="toc-item-main">
									<p class="toc-item-title">{getDescriptiveTitle(item)}</p>
									{#if creator}
										<p class="toc-item-creator">{creator}</p>
									{/if}
								</div>
								<div class="toc-item-meta">
									{#if pages}
										<span class="toc-item-pages">pp. {pages}</span>
									{/if}
									<ArrowRight class="h-4 w-4 toc-item-arrow" />
								</div>
							</a>
							{#if ext}
								<a
									href={ext}
									class="toc-item-external"
									target="_blank"
									rel="noopener noreferrer"
									aria-label="Open article on publisher site"
									title="Open article on publisher site"
								>
									<ExternalLink class="h-3.5 w-3.5" />
								</a>
							{/if}
						</li>
					{/each}
				</ol>
			</section>
		</div>
	</div>
{/if}

<style>
	.toc-backdrop {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: 80;
		background: hsl(var(--background) / 0.92);
		backdrop-filter: blur(6px);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 2rem;
		overflow-y: auto;
		transition: left var(--duration-slow) var(--ease-expo-out);
	}

	@media (max-width: 900px) {
		.toc-backdrop {
			padding: 1rem;
		}
	}

	@media (min-width: 1024px) {
		.toc-backdrop {
			left: var(--sidebar-offset, 0px);
		}
	}

	.toc-close {
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
	.toc-close:hover {
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
	}

	.toc-frame {
		display: grid;
		grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
		gap: 1.5rem;
		width: 100%;
		max-width: 960px;
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
		overflow: hidden;
		margin-top: 1rem;
	}

	@media (max-width: 900px) {
		.toc-frame {
			grid-template-columns: 1fr;
		}
	}

	.toc-cover {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		background: hsl(var(--muted));
		padding: 1.25rem;
	}
	.toc-cover img {
		max-width: 100%;
		max-height: 360px;
		width: auto;
		height: auto;
		display: block;
		border: 1px solid hsl(var(--border));
		border-radius: calc(var(--radius) - 4px);
	}

	.toc-body {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}

	.toc-header {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid hsl(var(--border));
	}

	.toc-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
		color: hsl(var(--muted-foreground));
	}

	.toc-title {
		font-family: var(--font-display);
		font-size: var(--font-size-xl);
		font-weight: 600;
		letter-spacing: var(--tracking-tight);
		line-height: var(--line-height-tight);
		color: hsl(var(--foreground));
	}

	.toc-count {
		font-size: var(--font-size-xs);
		color: hsl(var(--muted-foreground));
	}

	.toc-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.toc-item {
		position: relative;
		display: flex;
		align-items: stretch;
		border: 1px solid transparent;
		border-radius: calc(var(--radius) - 4px);
		transition:
			border-color 160ms ease,
			background 160ms ease;
	}
	.toc-item:hover {
		border-color: hsl(var(--border));
		background: hsl(var(--muted) / 0.5);
	}

	.toc-item-link {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.75rem;
		text-decoration: none;
		color: inherit;
		min-width: 0;
	}

	.toc-item-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.toc-item-title {
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: hsl(var(--foreground));
		line-height: var(--line-height-snug);
	}

	.toc-item-creator {
		font-size: var(--font-size-xs);
		color: hsl(var(--muted-foreground));
		line-height: 1.3;
	}

	.toc-item-meta {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	.toc-item-pages {
		font-size: var(--font-size-xs);
		color: hsl(var(--muted-foreground));
		white-space: nowrap;
	}

	:global(.toc-item-arrow) {
		color: hsl(var(--muted-foreground));
		transition: color 160ms ease;
	}
	.toc-item:hover :global(.toc-item-arrow) {
		color: hsl(var(--primary));
	}

	.toc-item-external {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		padding: 0 0.375rem;
		border-left: 1px solid transparent;
		color: hsl(var(--muted-foreground));
		text-decoration: none;
		transition:
			color 160ms ease,
			border-color 160ms ease;
	}
	.toc-item:hover .toc-item-external {
		border-left-color: hsl(var(--border));
	}
	.toc-item-external:hover {
		color: hsl(var(--primary));
	}
</style>
