<script lang="ts">
	import { onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import type { CollectionItem, EnrichedLocationsData } from '$lib/types';
	import { theme } from '$lib/stores/data';
	import { MAP_STYLE } from '$lib/components/charts/map/mapHelpers';
	import MapProjectionToggle from '$lib/components/charts/map/MapProjectionToggle.svelte';
	import {
		getPreviewImage,
		getDescriptiveTitle,
		getPrimaryDate,
		getLocationLabel
	} from './photoHelpers';
	import { getThemeShadow } from '$lib/styles';
	import { Maximize2, Minimize2 } from '@lucide/svelte';

	interface Props {
		items: CollectionItem[];
		enriched: EnrichedLocationsData | null;
		onSelect?: (item: CollectionItem) => void;
	}

	let { items, enriched, onSelect }: Props = $props();

	let container: HTMLDivElement | undefined = $state();
	let map: maplibregl.Map | null = $state(null);
	let mapReady = $state(false);
	let isFullscreen = $state(false);
	let initialTheme: string | null = null;
	let markers: maplibregl.Marker[] = [];

	interface PhotoMarker {
		item: CollectionItem;
		lat: number;
		lng: number;
		previewUrl: string;
		precision: 'city' | 'region' | 'country';
	}

	/** Join items with enriched coordinates at the most precise level available. */
	let photoMarkers = $derived.by<PhotoMarker[]>(() => {
		if (!enriched) return [];
		const out: PhotoMarker[] = [];
		for (const item of items) {
			const previewUrl = getPreviewImage(item);
			if (!previewUrl) continue;
			const origin = item.location?.origin?.[0];
			if (!origin) continue;

			// The enriched geo dataset keys cities as "City|Country" and
			// regions as "Region|Country" — the separator goes name-first,
			// country-second (see dev.geo.json and geolocLoader.ts).
			const cityKey = origin.l3 && origin.l1 ? `${origin.l3}|${origin.l1}` : null;
			const regionKey = origin.l2 && origin.l1 ? `${origin.l2}|${origin.l1}` : null;

			if (cityKey && enriched.cities[cityKey]) {
				out.push({
					item,
					lat: enriched.cities[cityKey].latitude,
					lng: enriched.cities[cityKey].longitude,
					previewUrl,
					precision: 'city'
				});
			} else if (regionKey && enriched.regions[regionKey]) {
				out.push({
					item,
					lat: enriched.regions[regionKey].latitude,
					lng: enriched.regions[regionKey].longitude,
					previewUrl,
					precision: 'region'
				});
			} else if (origin.l1 && enriched.countries[origin.l1]) {
				out.push({
					item,
					lat: enriched.countries[origin.l1].latitude,
					lng: enriched.countries[origin.l1].longitude,
					previewUrl,
					precision: 'country'
				});
			}
		}
		return out;
	});

	/**
	 * Markers at identical coords overlap. Give each a tiny deterministic
	 * offset so every photo remains clickable.
	 */
	function jitter(lng: number, lat: number, index: number, total: number): [number, number] {
		if (total <= 1) return [lng, lat];
		// Tight spiral; radius scales with density so city-level clumps
		// fan out rather than bunching in a hairline.
		const angle = (index / total) * 2 * Math.PI;
		const radius = 0.04 + Math.min(total, 30) * 0.002;
		return [lng + Math.cos(angle) * radius, lat + Math.sin(angle) * radius];
	}

	function initMap() {
		if (!container || map) return;
		map = new maplibregl.Map({
			container,
			style: $theme === 'dark' ? MAP_STYLE.dark : MAP_STYLE.light,
			center: [10, 15],
			zoom: 3,
			attributionControl: false
		});
		map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
		map.on('load', () => {
			mapReady = true;
			renderMarkers();
		});
	}

	function clearMarkers() {
		markers.forEach((m) => m.remove());
		markers = [];
	}

	function renderMarkers() {
		if (!map || !mapReady) return;
		clearMarkers();

		if (photoMarkers.length === 0) return;

		// Group by coordinate so we can jitter photos that share a place.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const groups = new Map<string, PhotoMarker[]>();
		for (const pm of photoMarkers) {
			const key = `${pm.lng.toFixed(3)},${pm.lat.toFixed(3)}`;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(pm);
		}

		const shadow = getThemeShadow($theme === 'dark').sm;
		const bounds = new maplibregl.LngLatBounds();

		groups.forEach((group) => {
			group.forEach((pm, i) => {
				const [lng, lat] = jitter(pm.lng, pm.lat, i, group.length);
				const el = document.createElement('button');
				el.type = 'button';
				el.className = 'photo-map-marker';
				el.style.boxShadow = shadow;
				const img = document.createElement('img');
				img.src = pm.previewUrl;
				img.alt = getDescriptiveTitle(pm.item);
				img.loading = 'lazy';
				img.draggable = false;
				el.appendChild(img);

				el.addEventListener('click', (ev) => {
					ev.stopPropagation();
					onSelect?.(pm.item);
				});

				const popup = new maplibregl.Popup({ offset: 22, closeButton: false, maxWidth: '220px' });
				const node = document.createElement('div');
				node.className = 'photo-map-popup';
				const title = document.createElement('p');
				title.className = 'photo-map-popup-title';
				title.textContent = getDescriptiveTitle(pm.item);
				node.appendChild(title);
				const loc = getLocationLabel(pm.item);
				if (loc) {
					const locEl = document.createElement('p');
					locEl.className = 'photo-map-popup-meta';
					locEl.textContent = loc;
					node.appendChild(locEl);
				}
				const d = getPrimaryDate(pm.item);
				if (d) {
					const dateEl = document.createElement('p');
					dateEl.className = 'photo-map-popup-meta';
					dateEl.textContent = d.getFullYear().toString();
					node.appendChild(dateEl);
				}
				popup.setDOMContent(node);

				el.addEventListener('mouseenter', () => popup.setLngLat([lng, lat]).addTo(map!));
				el.addEventListener('mouseleave', () => popup.remove());

				const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map!);
				markers.push(marker);
				bounds.extend([lng, lat]);
			});
		});

		if (photoMarkers.length > 1) {
			map.fitBounds(bounds, { padding: 60, maxZoom: 7, duration: 500 });
		} else if (photoMarkers.length === 1) {
			map.flyTo({ center: [photoMarkers[0].lng, photoMarkers[0].lat], zoom: 6 });
		}
	}

	$effect(() => {
		if (container && !map && enriched) initMap();
	});

	$effect(() => {
		if (mapReady) renderMarkers();
	});

	// Theme swap.
	$effect(() => {
		const currentTheme = $theme;
		if (!map || !mapReady) return;
		if (initialTheme === null) {
			initialTheme = currentTheme;
			return;
		}
		if (currentTheme !== initialTheme) {
			initialTheme = currentTheme;
			map.setStyle(currentTheme === 'dark' ? MAP_STYLE.dark : MAP_STYLE.light);
			map.once('style.load', () => renderMarkers());
		}
	});

	function toggleFullscreen() {
		isFullscreen = !isFullscreen;
		setTimeout(() => map?.resize(), 120);
	}

	onDestroy(() => {
		clearMarkers();
		if (map) {
			map.remove();
			map = null;
		}
	});
</script>

<div class="photo-map-wrapper" class:is-fullscreen={isFullscreen}>
	{#if !enriched}
		<div class="photo-map-empty">Loading location data…</div>
	{:else if photoMarkers.length === 0}
		<div class="photo-map-empty">No items in this collection have geocoded coordinates.</div>
	{:else}
		<div bind:this={container} class="photo-map-canvas"></div>
		<button
			type="button"
			class="photo-map-tool"
			style="top: 0.5rem; left: 0.5rem;"
			onclick={toggleFullscreen}
			title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
		>
			{#if isFullscreen}
				<Minimize2 class="h-4 w-4" />
			{:else}
				<Maximize2 class="h-4 w-4" />
			{/if}
		</button>
		<MapProjectionToggle {map} class="absolute top-2 left-14 z-10" />
		<div class="photo-map-footer">
			<span><strong>{photoMarkers.length}</strong> photos on the map</span>
			{#if photoMarkers.length < items.length}
				<span class="photo-map-footer-note">
					· {items.length - photoMarkers.length} without coordinates
				</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.photo-map-wrapper {
		position: relative;
		width: 100%;
		height: 640px;
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
		overflow: hidden;
		background: hsl(var(--muted));
	}
	.photo-map-wrapper.is-fullscreen {
		position: fixed;
		inset: 0;
		z-index: 60;
		border-radius: 0;
		height: 100vh;
	}

	.photo-map-canvas {
		position: absolute;
		inset: 0;
	}

	.photo-map-empty {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: hsl(var(--muted-foreground));
		font-size: var(--font-size-sm);
		text-align: center;
		padding: 1rem;
	}

	.photo-map-tool {
		position: absolute;
		z-index: 10;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		background: hsl(var(--background) / 0.92);
		border: 1px solid hsl(var(--border));
		border-radius: calc(var(--radius) - 2px);
		color: hsl(var(--foreground));
		cursor: pointer;
	}
	.photo-map-tool:hover {
		background: hsl(var(--background));
	}

	.photo-map-footer {
		position: absolute;
		bottom: 0.5rem;
		right: 0.75rem;
		background: hsl(var(--background) / 0.92);
		border: 1px solid hsl(var(--border));
		border-radius: calc(var(--radius) - 2px);
		padding: 0.25rem 0.625rem;
		font-size: var(--font-size-xs);
		color: hsl(var(--foreground));
		z-index: 5;
	}
	.photo-map-footer-note {
		color: hsl(var(--muted-foreground));
	}

	/* Marker + popup styles are injected into the MapLibre DOM directly, so
	   they live in the global namespace via :global selectors. */
	:global(.photo-map-marker) {
		width: 48px;
		height: 48px;
		padding: 0;
		border: 2px solid hsl(var(--background));
		border-radius: 50%;
		overflow: hidden;
		background: hsl(var(--muted));
		cursor: pointer;
		transition:
			transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
			border-color 180ms ease;
	}
	:global(.photo-map-marker:hover) {
		transform: scale(1.12);
		border-color: hsl(var(--primary));
		z-index: 10;
	}
	:global(.photo-map-marker img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	:global(.photo-map-popup) {
		font-family: var(--font-sans);
		padding: 0.25rem;
	}
	:global(.photo-map-popup-title) {
		font-weight: 500;
		font-size: 0.8125rem;
		color: hsl(var(--foreground));
		line-height: 1.3;
	}
	:global(.photo-map-popup-meta) {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
		margin-top: 0.125rem;
	}
</style>
