<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { ArrowLeft, LayoutGrid, MapPin, Clock } from '@lucide/svelte';
	import { allCollections, enrichedLocations, ensureEnrichedLocations } from '$lib/stores/data';
	import { filterItemsForCollection } from '$lib/utils/featuredCollectionLoader';
	import {
		itemsWithPreview,
		getPrimaryDate,
		getDescriptiveTitle,
		getTopicLabels,
		dedupeByImage
	} from '$lib/components/collections/photoHelpers';
	import CollectionHeader from '$lib/components/collections/CollectionHeader.svelte';
	import ViewModeTabs from '$lib/components/collections/ViewModeTabs.svelte';
	import PhotoMasonry from '$lib/components/collections/PhotoMasonry.svelte';
	import PhotoMap from '$lib/components/collections/PhotoMap.svelte';
	import PhotoTimeline from '$lib/components/collections/PhotoTimeline.svelte';
	import PhotoLightbox from '$lib/components/collections/PhotoLightbox.svelte';
	import PhotoFacets, {
		type PhotoFilterState,
		type SortKey
	} from '$lib/components/collections/PhotoFacets.svelte';
	import { SEO } from '$lib/components/ui';
	import type { CollectionItem } from '$lib/types';

	type ViewMode = 'masonry' | 'map' | 'timeline';

	interface PageData {
		meta: import('$lib/utils/collectionsRegistry').FeaturedCollection;
	}
	let { data }: { data: PageData } = $props();

	let meta = $derived(data.meta);

	// All items belonging to this collection (may or may not have images).
	let collectionItems = $derived(filterItemsForCollection($allCollections, meta));

	// Only items with a preview image power the photo views.
	let photoItems = $derived(itemsWithPreview(collectionItems));

	// Dedupe: when a collection opts in (e.g. ILAM), collapse records
	// that share the same preview image into one representative. The
	// alias counts drive the "× N records" badges on cards / lightbox.
	let dedupeMap = $derived.by(() => {
		if (!meta.dedupePhotos) return null;
		const groups = dedupeByImage(photoItems);
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const byId = new Map<string, number>();
		for (const g of groups) {
			byId.set(g.item._id, g.count);
		}
		return { groups, byId };
	});

	// The representatives that actually render. When dedupe is off this
	// is just `photoItems`; when on it's one item per unique preview URL.
	let representatives = $derived(dedupeMap ? dedupeMap.groups.map((g) => g.item) : photoItems);

	// Facet + sort state. Kept in-memory only; reset on collection change
	// (we key the registry slug to trigger).
	let filterState = $state<PhotoFilterState>({
		sort: 'year-desc',
		years: new Set(),
		countries: new Set(),
		topics: new Set()
	});

	$effect(() => {
		// Reset filters whenever the slug changes so a return visit to
		// another collection doesn't inherit stale selections.
		void meta.slug;
		filterState = {
			sort: 'year-desc',
			years: new Set(),
			countries: new Set(),
			topics: new Set()
		};
	});

	/** Photo items run through the current filter + sort state. Filters
	 *  apply to the representatives so dedupe and facets compose. */
	let visibleItems = $derived.by(() => {
		const filtered = representatives.filter((item) => {
			if (filterState.years.size > 0) {
				const d = getPrimaryDate(item);
				if (!d || !filterState.years.has(d.getFullYear())) return false;
			}
			if (filterState.countries.size > 0) {
				const c = item.location?.origin?.[0]?.l1;
				if (!c || !filterState.countries.has(c)) return false;
			}
			if (filterState.topics.size > 0) {
				const topics = getTopicLabels(item, 32);
				if (!topics.some((t) => filterState.topics.has(t))) return false;
			}
			return true;
		});

		const cmp = comparator(filterState.sort);
		return [...filtered].sort(cmp);
	});

	function comparator(sort: SortKey): (a: CollectionItem, b: CollectionItem) => number {
		switch (sort) {
			case 'title-asc':
				return (a, b) => getDescriptiveTitle(a).localeCompare(getDescriptiveTitle(b));
			case 'title-desc':
				return (a, b) => getDescriptiveTitle(b).localeCompare(getDescriptiveTitle(a));
			case 'year-asc':
				return (a, b) =>
					(getPrimaryDate(a)?.getTime() ?? Infinity) - (getPrimaryDate(b)?.getTime() ?? Infinity);
			case 'year-desc':
			default:
				return (a, b) =>
					(getPrimaryDate(b)?.getTime() ?? -Infinity) - (getPrimaryDate(a)?.getTime() ?? -Infinity);
		}
	}

	// Derived stats for the hero.
	let dateRange = $derived.by(() => {
		const years = photoItems
			.map((it) => getPrimaryDate(it))
			.filter((d): d is Date => !!d)
			.map((d) => d.getFullYear());
		if (years.length === 0) return { from: null, to: null };
		return { from: Math.min(...years), to: Math.max(...years) };
	});

	let locationCount = $derived(
		new Set(
			photoItems
				.map((it) => {
					const o = it.location?.origin?.[0];
					return o ? [o.l1, o.l2, o.l3].filter(Boolean).join('|') : null;
				})
				.filter(Boolean)
		).size
	);

	// View-mode state, synced to URL so deep-links land on the right tab.
	let view = $state<ViewMode>('masonry');

	$effect(() => {
		const v = $page.url.searchParams.get('view');
		if (v === 'map' || v === 'timeline' || v === 'masonry') {
			view = v;
		} else {
			view = 'masonry';
		}
	});

	function changeView(next: ViewMode) {
		const url = new URL($page.url);
		if (next === 'masonry') url.searchParams.delete('view');
		else url.searchParams.set('view', next);
		// Push (don't replace) so browser Back steps through tab changes —
		// otherwise Back from a timeline view jumps all the way to the
		// collections list, losing the user's place.
		goto(url.pathname + url.search, { noScroll: true });
	}

	// Lightbox state — indexes into the *visible* list so keyboard nav
	// respects the user's filter+sort. The current photo id is mirrored to
	// the URL (?photo=…) so browser Back closes the lightbox and returns to
	// the tab the user was on, rather than skipping back to /collections.
	let lightboxIndex = $state<number | null>(null);
	let syncingLightboxFromUrl = false;

	$effect(() => {
		const photoId = $page.url.searchParams.get('photo');
		if (!photoId) {
			syncingLightboxFromUrl = true;
			lightboxIndex = null;
			syncingLightboxFromUrl = false;
			return;
		}
		const idx = visibleItems.findIndex((p) => p._id === photoId);
		syncingLightboxFromUrl = true;
		lightboxIndex = idx >= 0 ? idx : null;
		syncingLightboxFromUrl = false;
	});

	function pushPhotoToUrl(photoId: string | null) {
		if (syncingLightboxFromUrl) return;
		const url = new URL($page.url);
		if (photoId) url.searchParams.set('photo', photoId);
		else url.searchParams.delete('photo');
		goto(url.pathname + url.search, { noScroll: true, keepFocus: true });
	}

	function openLightbox(item: CollectionItem) {
		const idx = visibleItems.findIndex((p) => p._id === item._id);
		if (idx >= 0) {
			lightboxIndex = idx;
			pushPhotoToUrl(item._id);
		}
	}

	function closeLightbox() {
		lightboxIndex = null;
		pushPhotoToUrl(null);
	}

	function prev() {
		if (lightboxIndex === null || visibleItems.length === 0) return;
		lightboxIndex = (lightboxIndex - 1 + visibleItems.length) % visibleItems.length;
		pushPhotoToUrl(visibleItems[lightboxIndex]._id);
	}
	function next() {
		if (lightboxIndex === null || visibleItems.length === 0) return;
		lightboxIndex = (lightboxIndex + 1) % visibleItems.length;
		pushPhotoToUrl(visibleItems[lightboxIndex]._id);
	}

	// Map view needs enriched coordinates — fetch lazily.
	onMount(() => {
		ensureEnrichedLocations(base);
	});

	// Collection-specific view opt-in/out, defaulting all enabled. Hides
	// view tabs that don't apply (e.g. map for single-location collections).
	let modes = $derived.by(() => {
		const allow = meta.views ?? {};
		const base = [
			{
				id: 'masonry' as const,
				label: 'Masonry',
				icon: LayoutGrid,
				enabled: allow.masonry ?? true
			},
			{ id: 'map' as const, label: 'Map', icon: MapPin, enabled: allow.map ?? true },
			{ id: 'timeline' as const, label: 'Timeline', icon: Clock, enabled: allow.timeline ?? true }
		];
		return base.filter((m) => m.enabled).map(({ id, label, icon }) => ({ id, label, icon }));
	});

	// If the URL requests a view that this collection disables, fall back
	// to the first enabled mode so users never see a blank viewport.
	$effect(() => {
		if (modes.length === 0) return;
		if (!modes.some((m) => m.id === view)) {
			view = modes[0].id as ViewMode;
		}
	});
</script>

<SEO title={meta.title} description={meta.description} />

<div class="page-container">
	<a href="{base}/collections" class="collection-back">
		<ArrowLeft class="h-4 w-4" />
		All collections
	</a>

	<CollectionHeader
		{meta}
		photoCount={representatives.length}
		itemCount={collectionItems.length}
		{dateRange}
		{locationCount}
	/>

	<div class="collection-toolbar">
		<ViewModeTabs {modes} active={view} onChange={changeView} />
		{#if photoItems.length !== collectionItems.length}
			<p class="collection-toolbar-note">
				{collectionItems.length - photoItems.length} item{collectionItems.length -
					photoItems.length ===
				1
					? ''
					: 's'} without a preview hidden from photo views.
			</p>
		{/if}
		{#if meta.dedupePhotos && photoItems.length > representatives.length}
			<p class="collection-toolbar-note">
				Grouped into {representatives.length.toLocaleString('en-GB')} unique photos from {photoItems.length.toLocaleString(
					'en-GB'
				)} records.
			</p>
		{/if}
	</div>

	{#if representatives.length > 0}
		<PhotoFacets
			items={representatives}
			filters={filterState}
			onChange={(next) => (filterState = next)}
			filteredCount={visibleItems.length}
		/>
	{/if}

	{#if representatives.length === 0}
		<div class="rounded-lg border bg-card p-12 text-center text-muted-foreground">
			<p>No photos available in this collection yet.</p>
		</div>
	{:else if visibleItems.length === 0}
		<div class="rounded-lg border bg-card p-12 text-center text-muted-foreground">
			<p>No photos match the current filters.</p>
		</div>
	{:else if view === 'masonry'}
		<PhotoMasonry
			items={visibleItems}
			countsById={dedupeMap?.byId ?? null}
			onSelect={openLightbox}
		/>
	{:else if view === 'map'}
		<PhotoMap items={visibleItems} enriched={$enrichedLocations} onSelect={openLightbox} />
	{:else if view === 'timeline'}
		<PhotoTimeline
			items={visibleItems}
			countsById={dedupeMap?.byId ?? null}
			onSelect={openLightbox}
		/>
	{/if}

	<PhotoLightbox
		items={visibleItems}
		index={lightboxIndex}
		countsById={dedupeMap?.byId ?? null}
		onClose={closeLightbox}
		onPrev={prev}
		onNext={next}
	/>
</div>

<style>
	.collection-back {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 1rem;
		font-size: var(--font-size-sm);
		color: hsl(var(--muted-foreground));
		text-decoration: none;
		transition: color 160ms ease;
	}
	.collection-back:hover {
		color: hsl(var(--foreground));
	}

	.collection-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}

	.collection-toolbar-note {
		font-size: var(--font-size-xs);
		color: hsl(var(--muted-foreground));
	}
</style>
