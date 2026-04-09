<script lang="ts">
	import { onDestroy } from 'svelte';
	import { cn } from '$lib/utils/cn';
	import type { EnrichedLocationsData, CollectionItem } from '$lib/types';
	import maplibregl from 'maplibre-gl';
	import { Maximize2, Minimize2 } from '@lucide/svelte';

	// Extracted sub-modules
	import type { LocationData } from './map/markerBuilder';
	import { buildAggregatedMarkers } from './map/markerBuilder';
	import { buildPopupHtml } from './map/popupBuilder';
	import { getMarkerRadius, getMarkerColor, ITEMS_PER_PAGE, MAP_STYLE } from './map/mapHelpers';
	import { theme } from '$lib/stores/data';

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
	let mapWrapper: HTMLDivElement | undefined = $state();
	let map: maplibregl.Map | null = null;
	let mapReady = $state(false);
	let isFullscreen = $state(false);
	let initialTheme: string | null = null;

	// Store pagination state for each marker
	const paginationState = new Map<string, number>();

	// Store all markers to manage popups
	let mapMarkers: maplibregl.Marker[] = [];

	// Combine location data with enriched coordinates and items
	let markers = $derived.by(() => buildAggregatedMarkers(data, items, enrichedLocations));

	// Calculate max count for scaling
	let maxCount = $derived(Math.max(...markers.map((m) => m.count), 1));

	// Handle pagination click
	function handlePaginationClick(event: Event) {
		const target = event.target as HTMLElement;
		if (target.classList.contains('popup-page-btn') && !target.hasAttribute('disabled')) {
			const markerId = target.dataset.markerId;
			const page = parseInt(target.dataset.page || '0', 10);

			if (markerId) {
				paginationState.set(markerId, page);
				const marker = markers.find((m) => m.id === markerId);
				if (marker) {
					const popupContainer = document.querySelector(
						`.popup-container[data-marker-id="${markerId}"]`
					);
					if (popupContainer) {
						popupContainer.outerHTML = buildPopupHtml(marker, page);
					}
				}
			}
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

	// Toggle fullscreen mode
	function toggleFullscreen() {
		isFullscreen = !isFullscreen;

		// Resize map after fullscreen transition
		setTimeout(() => {
			map?.resize();
		}, 100);
	}

	// Handle escape key to exit fullscreen
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isFullscreen) {
			isFullscreen = false;
			setTimeout(() => map?.resize(), 100);
		}
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

		map.on('load', () => {
			mapReady = true;
			updateMarkers();
		});

		// Close popups when clicking on the map (not on a marker)
		map.on('click', () => {
			closeOtherPopups();
		});

		// Add global click listener for pagination
		document.addEventListener('click', handlePaginationClick);
		document.addEventListener('keydown', handleKeydown);
	}

	function updateMarkers() {
		if (!map || !mapReady) return;

		// Remove existing markers from map and clear array
		mapMarkers.forEach((marker) => marker.remove());
		mapMarkers = [];

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
			el.style.opacity = '0.7';
			el.style.borderRadius = '50%';
			el.style.border = '2px solid hsl(var(--background))';
			el.style.boxShadow = 'var(--shadow-sm, 0 1px 3px 0 rgb(0 0 0 / 0.1))';
			el.style.cursor = 'pointer';
			el.style.display = 'flex';
			el.style.alignItems = 'center';
			el.style.justifyContent = 'center';
			el.style.color = 'hsl(var(--background))';
			el.style.fontSize = radius > 20 ? '12px' : '10px';
			el.style.fontWeight = 'bold';
			el.style.textShadow = '0 1px 2px rgb(0 0 0 / 0.5)';

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
		document.removeEventListener('keydown', handleKeydown);
		mapMarkers.forEach((marker) => marker.remove());
		mapMarkers = [];
		if (map) {
			map.remove();
			map = null;
		}
	});
</script>

<div
	bind:this={mapWrapper}
	class={cn(
		'flex flex-col',
		isFullscreen ? 'fixed inset-0 z-50 bg-background p-4' : 'w-full h-full min-h-[550px]',
		className
	)}
>
	{#if title && !isFullscreen}
		<h3 class="text-lg font-semibold text-center mb-4">{title}</h3>
	{/if}

	{#if !enrichedLocations}
		<div class="flex-1 flex items-center justify-center bg-muted rounded-lg">
			<div class="text-center text-muted-foreground p-4">
				<p class="mb-2">Location data not available.</p>
				<p class="text-sm">Geolocation data files (dev.geoloc_*.json) could not be loaded.</p>
			</div>
		</div>
	{:else if markers.length === 0 && mapReady}
		<div class="flex-1 flex items-center justify-center bg-muted rounded-lg">
			<p class="text-muted-foreground">No locations with coordinates found</p>
		</div>
	{:else}
		<div
			class="flex-1 relative rounded-lg border"
			style={isFullscreen ? '' : 'min-height: 550px; overflow: visible;'}
		>
			<div
				bind:this={mapContainer}
				class="absolute inset-0 w-full h-full rounded-lg overflow-hidden"
			></div>

			<!-- Fullscreen button -->
			<button
				onclick={toggleFullscreen}
				class="absolute top-2 left-2 z-10 bg-background/90 hover:bg-background border rounded-md p-2 shadow-sm transition-colors"
				title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
			>
				{#if isFullscreen}
					<Minimize2 class="w-[18px] h-[18px]" />
				{:else}
					<Maximize2 class="w-[18px] h-[18px]" />
				{/if}
			</button>

			<!-- Fullscreen title -->
			{#if isFullscreen && title}
				<div
					class="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-background/90 border rounded-md px-4 py-2 shadow-sm"
				>
					<h3 class="text-lg font-semibold">{title}</h3>
				</div>
			{/if}
		</div>

		<!-- Legend -->
		<div class={cn('flex flex-wrap gap-4 justify-center text-sm', isFullscreen ? 'mt-4' : 'mt-3')}>
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
			{#if isFullscreen}
				<button
					onclick={toggleFullscreen}
					class="text-muted-foreground hover:text-foreground transition-colors"
				>
					Press Esc to exit
				</button>
			{/if}
		</div>
	{/if}
</div>
