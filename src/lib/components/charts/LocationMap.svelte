<script lang="ts">
	import { onDestroy } from 'svelte';
	import { cn } from '$lib/utils/cn';
	import type { EnrichedLocationsData, CollectionItem } from '$lib/types';
	import maplibregl from 'maplibre-gl';
	import MapProjectionToggle from './map/MapProjectionToggle.svelte';
	import { SvelteMap } from 'svelte/reactivity';

	// Extracted sub-modules
	import type { LocationData } from './map/markerBuilder';
	import { buildAggregatedMarkers } from './map/markerBuilder';
	import { buildPopupHtml } from './map/popupBuilder';
	import { getMarkerRadius, getMarkerColor, MAP_STYLE } from './map/mapHelpers';
	import { theme } from '$lib/stores/data';
	import { getThemeShadow, getMarkerTextShadow } from '$lib/styles';

	interface Props {
		data: LocationData[];
		items?: CollectionItem[];
		enrichedLocations?: EnrichedLocationsData | null;
		title?: string;
		class?: string;
	}

	let {
		data,
		items = [],
		enrichedLocations = null,
		title = '',
		class: className = ''
	}: Props = $props();

	let mapContainer: HTMLDivElement | undefined = $state();
	// $state-tracked so MapProjectionToggle picks up the instance once ready.
	let map: maplibregl.Map | null = $state(null);
	let mapReady = $state(false);
	let initialTheme: string | null = null;

	// Store pagination state for each marker
	const paginationState = new SvelteMap<string, number>();

	// Store all markers to manage popups
	let mapMarkers: maplibregl.Marker[] = [];

	// Combine location data with enriched coordinates and items
	let markers = $derived.by(() => buildAggregatedMarkers(data, items, enrichedLocations));

	// Calculate max count for scaling
	let maxCount = $derived(Math.max(...markers.map((m) => m.count), 1));

	// Handle pagination click.
	//
	// Uses `closest()` so clicks on a button's descendant (text, arrow entity,
	// …) still resolve to the button. Updates the popup via the MapLibre
	// Popup API (`setHTML`) instead of mutating the DOM directly — direct
	// `outerHTML` replacement destroyed the click target mid-handler and
	// caused MapLibre to treat the subsequent bubble as an outside-click,
	// silently closing the popup.
	function handlePaginationClick(event: Event) {
		const raw = event.target as HTMLElement | null;
		const btn = raw?.closest<HTMLButtonElement>('.popup-page-btn');
		if (!btn || btn.hasAttribute('disabled')) return;

		// Prevent any parent close-on-click logic from firing on this click.
		event.stopPropagation();

		const markerId = btn.dataset.markerId;
		if (!markerId) return;
		const page = parseInt(btn.dataset.page || '0', 10);

		paginationState.set(markerId, page);
		const mapMarker = mapMarkers.find((m, i) => markers[i]?.id === markerId);
		const markerData = markers.find((m) => m.id === markerId);
		if (!markerData || !mapMarker) return;

		const popup = mapMarker.getPopup();
		if (popup) {
			popup.setHTML(buildPopupHtml(markerData, page));
		}
	}

	// Close all popups except the one being opened
	function closeOtherPopups(currentMarker?: maplibregl.Marker) {
		mapMarkers.forEach((marker) => {
			if (marker !== currentMarker) {
				const popup = marker.getPopup();
				if (popup && popup.isOpen()) {
					popup.remove();
				}
			}
		});
	}

	function initializeMap() {
		if (!mapContainer || map) return;

		map = new maplibregl.Map({
			container: mapContainer,
			style: $theme === 'dark' ? MAP_STYLE.dark : MAP_STYLE.light,
			center: [10, 20],
			zoom: 2
		});

		map.addControl(new maplibregl.NavigationControl(), 'top-right');
		// Native HTML5 Fullscreen API — lives inside the map canvas container,
		// so it escapes parent overflow / containment (e.g. ChartCard's
		// `overflow: hidden`) and stays consistent with other MapLibre
		// implementations across the codebase.
		map.addControl(new maplibregl.FullscreenControl(), 'top-right');

		// MapLibre's `load` event can silently stall when the container is
		// inside a deeply-nested flex parent (seen on /languages?code=eng
		// where `styledata` fires but `load` doesn't). `idle` fires after
		// the first render settles, so we accept whichever comes first.
		let firstReadyFired = false;
		const markReady = () => {
			if (firstReadyFired) return;
			firstReadyFired = true;
			mapReady = true;
			updateMarkers();
		};
		map.once('load', markReady);
		map.once('idle', markReady);

		// Close popups when clicking on the map background (not on a marker
		// and NOT inside an open popup). The popup check is needed because
		// clicks on popup content bubble through MapLibre's internal click
		// dispatcher; without it, clicking Prev/Next closes the popup.
		// NOTE: even with this guard the pagination still closes the popup
		// in some cases — tracked as a known issue in ROADMAP-parity.md.
		map.on('click', (e) => {
			const target = (e.originalEvent?.target as HTMLElement | null) ?? null;
			if (target?.closest('.maplibregl-popup')) {
				return;
			}
			closeOtherPopups();
		});

		// Add global click listener for pagination
		document.addEventListener('click', handlePaginationClick);
	}

	function updateMarkers() {
		if (!map || !mapReady) return;

		// Remove existing markers from map and clear array
		mapMarkers.forEach((marker) => marker.remove());
		mapMarkers = [];

		const isDark = $theme === 'dark';
		const markerShadow = getThemeShadow(isDark).sm;
		const textShadow = getMarkerTextShadow(isDark);

		// Add new markers
		markers.forEach((markerData) => {
			const radius = getMarkerRadius(markerData.count, maxCount);
			const color = getMarkerColor(markerData.type);

			// Create marker element
			const el = document.createElement('div');
			el.className = 'location-marker';
			el.style.width = `${radius * 2}px`;
			el.style.height = `${radius * 2}px`;
			el.style.backgroundColor = color;
			el.style.opacity = '0.75';
			el.style.borderRadius = '50%';
			el.style.border = '2px solid hsl(var(--background))';
			el.style.boxShadow = markerShadow;
			el.style.cursor = 'pointer';
			el.style.display = 'flex';
			el.style.alignItems = 'center';
			el.style.justifyContent = 'center';
			el.style.color = 'hsl(var(--background))';
			el.style.fontSize = radius > 20 ? '12px' : '10px';
			el.style.fontWeight = '600';
			el.style.textShadow = textShadow;
			el.style.transition = 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms';

			if (radius > 15) {
				el.textContent = markerData.count.toString();
			}

			// Get current page for this marker
			const currentPage = paginationState.get(markerData.id) || 0;

			const popup = new maplibregl.Popup({
				offset: radius,
				closeButton: true,
				closeOnClick: false,
				maxWidth: '340px'
				// No fixed anchor — MapLibre auto-positions to keep popup in view
			}).setHTML(buildPopupHtml(markerData, currentPage));

			const marker = new maplibregl.Marker({ element: el })
				.setLngLat([markerData.longitude, markerData.latitude])
				.setPopup(popup)
				.addTo(map!);

			// Close other popups when this popup opens
			popup.on('open', () => {
				closeOtherPopups(marker);
			});

			mapMarkers.push(marker);
		});

		// Fit bounds to show all markers
		if (markers.length > 0) {
			const bounds = new maplibregl.LngLatBounds();
			markers.forEach((m) => {
				bounds.extend([m.longitude, m.latitude]);
			});
			map.fitBounds(bounds, { padding: 80, maxZoom: 6 });
		}
	}

	// Switch map style when theme changes (skip initial render)
	$effect(() => {
		const currentTheme = $theme;
		if (!map || !mapReady) return;

		if (initialTheme === null) {
			initialTheme = currentTheme;
			return;
		}

		if (currentTheme !== initialTheme) {
			initialTheme = currentTheme;
			const style = currentTheme === 'dark' ? MAP_STYLE.dark : MAP_STYLE.light;
			map.setStyle(style);
			map.once('style.load', () => {
				updateMarkers();
			});
		}
	});

	// Watch for marker changes and update when ready
	$effect(() => {
		if (mapReady && markers.length > 0) {
			updateMarkers();
		}
	});

	// Initialize map when container is available
	$effect(() => {
		if (mapContainer && !map && enrichedLocations) {
			initializeMap();
		}
	});

	onDestroy(() => {
		document.removeEventListener('click', handlePaginationClick);
		mapMarkers.forEach((marker) => marker.remove());
		mapMarkers = [];
		if (map) {
			map.remove();
			map = null;
		}
	});
</script>

<div class={cn('flex flex-col w-full h-full', className)}>
	{#if title}
		<h3 class="text-lg font-semibold text-center mb-4">{title}</h3>
	{/if}

	{#if !enrichedLocations}
		<div class="flex-1 flex items-center justify-center bg-muted rounded-lg">
			<div class="text-center text-muted-foreground p-4">
				<p class="mb-2">Location data not available.</p>
				<p class="text-sm">Geolocation data file (dev.geo.json) could not be loaded.</p>
			</div>
		</div>
	{:else if markers.length === 0 && mapReady}
		<div class="flex-1 flex items-center justify-center bg-muted rounded-lg">
			<p class="text-muted-foreground">No locations with coordinates found</p>
		</div>
	{:else}
		<!-- The map canvas owns the native MapLibre controls (Navigation,
			 Fullscreen, Projection). Keeping them INSIDE the canvas means the
			 Fullscreen API target is the canvas itself, so ChartCard's
			 `overflow: hidden` can't clip it.
			 No hardcoded min-height: flex-1 claims the remaining card height
			 after the legend reserves its space, so the legend is always
			 visible (no clipping even in tightly sized cards). -->
		<div class="flex-1 relative rounded-lg border">
			<div
				bind:this={mapContainer}
				class="absolute inset-0 w-full h-full rounded-lg overflow-hidden"
			></div>

			<!-- Globe / Flat toggle stacks below the built-in NavigationControl. -->
			<MapProjectionToggle {map} class="absolute top-2 left-2 z-10" />
		</div>

		<!-- Legend — shrink-0 keeps it visible regardless of flex pressure. -->
		<div class="shrink-0 flex flex-wrap gap-4 justify-center text-sm mt-3">
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full bg-location-city opacity-70"></div>
				<span class="text-muted-foreground">City</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full bg-location-region opacity-70"></div>
				<span class="text-muted-foreground">Region</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full bg-location-country opacity-70"></div>
				<span class="text-muted-foreground">Country</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full bg-location-current opacity-70"></div>
				<span class="text-muted-foreground">Other</span>
			</div>
			<div class="text-muted-foreground">
				<span class="font-medium">{markers.length}</span> locations |
				<span class="font-medium">{data.reduce((sum, d) => sum + d.count, 0)}</span> items
			</div>
		</div>
	{/if}
</div>
