<script lang="ts">
	import { onDestroy } from 'svelte';
	import { cn } from '$lib/utils/cn';
	import type { EnrichedLocationsData, CollectionItem } from '$lib/types';
	import maplibregl from 'maplibre-gl';
	import { CHART_COLORS } from '$lib/styles';
	import { researchItemUrl } from '$lib/utils/urls';
	import { Maximize2, Minimize2 } from '@lucide/svelte';

	interface LocationData {
		country: string;
		region: string;
		city: string;
		count: number;
	}

	interface MarkerData {
		id: string;
		name: string;
		latitude: number;
		longitude: number;
		count: number;
		type: 'country' | 'region' | 'city' | 'other';
		wikidataId?: string;
		items: { id: string; title: string; type: string }[];
	}

	interface Props {
		data: LocationData[];
		items?: CollectionItem[];
		enrichedLocations?: EnrichedLocationsData | null;
		title?: string;
		class?: string;
	}

	let { data, items = [], enrichedLocations = null, title = '', class: className = '' }: Props = $props();

	// Map marker colors using design tokens
	const MARKER_COLORS = {
		city: CHART_COLORS[0],    // Blue
		country: CHART_COLORS[1], // Emerald
		other: CHART_COLORS[4]    // Purple
	} as const;

	let mapContainer: HTMLDivElement | undefined = $state();
	let mapWrapper: HTMLDivElement | undefined = $state();
	let map: maplibregl.Map | null = null;
	let mapReady = $state(false);
	let isFullscreen = $state(false);

	const ITEMS_PER_PAGE = 5;

	// Store pagination state for each marker
	const paginationState = new Map<string, number>();

	// Store all markers to manage popups
	let mapMarkers: maplibregl.Marker[] = [];

	// Helper to get item title
	function getItemTitle(item: CollectionItem): string {
		return item.titleInfo?.[0]?.title || 'Untitled';
	}

	// Helper to check if item matches a location
	function itemMatchesLocation(item: CollectionItem, locationType: string, locationName: string, country?: string): boolean {
		const origins = item.location?.origin || [];
		const current = item.location?.current || [];

		for (const origin of origins) {
			if (locationType === 'country' && origin.l1 === locationName) return true;
			if (locationType === 'city' && origin.l3 === locationName && (!country || origin.l1 === country)) return true;
			if (locationType === 'region' && origin.l2 === locationName && (!country || origin.l1 === country)) return true;
		}

		if (locationType === 'other') {
			return current.includes(locationName);
		}

		return false;
	}

	// Combine location data with enriched coordinates and items
	let markers = $derived.by(() => {
		const markerMap = new Map<string, MarkerData>();

		if (!enrichedLocations) {
			return [];
		}

		// Aggregate counts by location
		const countryCounts = new Map<string, number>();
		const cityCounts = new Map<string, number>();

		data.forEach((d) => {
			if (d.country) {
				countryCounts.set(d.country, (countryCounts.get(d.country) || 0) + d.count);
			}
			if (d.city && d.country) {
				const key = `${d.city}|${d.country}`;
				cityCounts.set(key, (cityCounts.get(key) || 0) + d.count);
			}
		});

		// Add city markers (more specific)
		cityCounts.forEach((count, key) => {
			const cityData = enrichedLocations.cities[key];
			if (cityData?.latitude && cityData?.longitude) {
				const [cityName, countryName] = key.split('|');
				const matchingItems = items
					.filter(item => itemMatchesLocation(item, 'city', cityName, countryName))
					.map(item => ({ id: item._id || item.dre_id, title: getItemTitle(item), type: item.typeOfResource || 'Unknown' }));

				const markerId = `city-${key}`;
				markerMap.set(markerId, {
					id: markerId,
					name: cityData.wikidata_label || cityName,
					latitude: cityData.latitude,
					longitude: cityData.longitude,
					count,
					type: 'city',
					wikidataId: cityData.wikidata_id || undefined,
					items: matchingItems
				});
			}
		});

		// Add country markers
		countryCounts.forEach((count, country) => {
			const hasCities = Array.from(cityCounts.keys()).some((key) => key.endsWith(`|${country}`));
			const countryData = enrichedLocations.countries[country];

			if (countryData?.latitude && countryData?.longitude) {
				const adjustedCount = hasCities ? Math.ceil(count * 0.3) : count;
				const matchingItems = items
					.filter(item => itemMatchesLocation(item, 'country', country))
					.map(item => ({ id: item._id || item.dre_id, title: getItemTitle(item), type: item.typeOfResource || 'Unknown' }));

				const markerId = `country-${country}`;
				markerMap.set(markerId, {
					id: markerId,
					name: countryData.wikidata_label || country,
					latitude: countryData.latitude,
					longitude: countryData.longitude,
					count: adjustedCount,
					type: 'country',
					wikidataId: countryData.wikidata_id || undefined,
					items: matchingItems
				});
			}
		});

		// Also check "other" locations (current locations)
		data.forEach((d) => {
			const currentLoc = enrichedLocations.other[d.city] || enrichedLocations.other[d.country];
			if (currentLoc?.latitude && currentLoc?.longitude) {
				const markerId = `other-${currentLoc.original_name}`;
				if (!markerMap.has(markerId)) {
					const matchingItems = items
						.filter(item => itemMatchesLocation(item, 'other', currentLoc.original_name))
						.map(item => ({ id: item._id || item.dre_id, title: getItemTitle(item), type: item.typeOfResource || 'Unknown' }));

					markerMap.set(markerId, {
						id: markerId,
						name: currentLoc.wikidata_label || currentLoc.original_name,
						latitude: currentLoc.latitude,
						longitude: currentLoc.longitude,
						count: d.count,
						type: 'other',
						wikidataId: currentLoc.wikidata_id || undefined,
						items: matchingItems
					});
				}
			}
		});

		return Array.from(markerMap.values());
	});

	// Calculate max count for scaling
	let maxCount = $derived(Math.max(...markers.map((m) => m.count), 1));

	// Get marker radius based on count
	function getMarkerRadius(count: number): number {
		const minRadius = 8;
		const maxRadius = 40;
		const scale = Math.sqrt(count / maxCount);
		return minRadius + scale * (maxRadius - minRadius);
	}

	// Get marker color based on type
	function getMarkerColor(type: string): string {
		switch (type) {
			case 'city':
				return MARKER_COLORS.city;
			case 'country':
				return MARKER_COLORS.country;
			default:
				return MARKER_COLORS.other;
		}
	}

	// Generate popup HTML for a specific page
	function generatePopupContent(markerData: MarkerData, page: number): string {
		const color = getMarkerColor(markerData.type);
		const totalItems = markerData.items.length;
		const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
		const startIdx = page * ITEMS_PER_PAGE;
		const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, totalItems);
		const pageItems = markerData.items.slice(startIdx, endIdx);

		const itemsHtml = pageItems.length > 0
			? `<ul class="popup-items-list">
				${pageItems.map(item =>
					`<li class="popup-item">
						<a href="${researchItemUrl(item.id)}" class="popup-item-link">${item.title.length > 45 ? item.title.substring(0, 45) + '...' : item.title}</a>
						<span class="popup-item-type">(${item.type})</span>
					</li>`
				).join('')}
			</ul>`
			: '<p class="popup-no-items">No documents found</p>';

		const paginationHtml = totalPages > 1
			? `<div class="popup-pagination">
				<button class="popup-page-btn" data-marker-id="${markerData.id}" data-page="${page - 1}" ${page === 0 ? 'disabled' : ''}>
					&larr; Prev
				</button>
				<span class="popup-page-info">${page + 1} / ${totalPages}</span>
				<button class="popup-page-btn" data-marker-id="${markerData.id}" data-page="${page + 1}" ${page >= totalPages - 1 ? 'disabled' : ''}>
					Next &rarr;
				</button>
			</div>`
			: '';

		return `
			<div class="popup-container" data-marker-id="${markerData.id}">
				<div class="popup-header">
					<h3 class="popup-title">${markerData.name}</h3>
					<div class="popup-meta">
						<span class="popup-type-badge" style="background-color: ${color};">
							${markerData.type}
						</span>
						<span class="popup-count">
							<strong>${markerData.count}</strong> item${markerData.count !== 1 ? 's' : ''}
						</span>
					</div>
				</div>
				<div class="popup-content" id="popup-content-${markerData.id}">
					${itemsHtml}
				</div>
				${paginationHtml}
			</div>
			<style>
				.popup-container {
					padding: 4px;
					min-width: 260px;
					max-width: 320px;
				}
				.popup-header {
					margin-bottom: 12px;
				}
				.popup-title {
					font-size: 16px;
					font-weight: 600;
					margin: 0 0 8px 0;
					color: hsl(var(--popover-foreground));
				}
				.popup-meta {
					display: flex;
					align-items: center;
					gap: 12px;
				}
				.popup-type-badge {
					color: white;
					padding: 2px 8px;
					border-radius: 4px;
					font-size: 11px;
					font-weight: 500;
					text-transform: capitalize;
				}
				.popup-count {
					font-size: 13px;
					color: hsl(var(--muted-foreground));
				}
				.popup-content {
					border-top: 1px solid hsl(var(--border));
					padding-top: 8px;
				}
				.popup-items-list {
					margin: 0;
					padding: 0 0 0 16px;
					max-height: 180px;
					overflow-y: auto;
				}
				.popup-item {
					margin-bottom: 6px;
					line-height: 1.4;
				}
				.popup-item-link {
					font-size: 12px;
					color: hsl(var(--popover-foreground));
					text-decoration: none;
					transition: color 0.15s;
				}
				.popup-item-link:hover {
					color: hsl(var(--primary));
				}
				.popup-item-type {
					font-size: 10px;
					color: hsl(var(--muted-foreground));
					margin-left: 4px;
				}
				.popup-no-items {
					font-size: 12px;
					color: hsl(var(--muted-foreground));
					margin: 8px 0;
				}
				.popup-pagination {
					display: flex;
					align-items: center;
					justify-content: space-between;
					margin-top: 12px;
					padding-top: 8px;
					border-top: 1px solid hsl(var(--border));
				}
				.popup-page-btn {
					background: hsl(var(--secondary));
					color: hsl(var(--secondary-foreground));
					border: none;
					padding: 4px 10px;
					border-radius: 4px;
					font-size: 11px;
					cursor: pointer;
					transition: background 0.2s;
				}
				.popup-page-btn:hover:not(:disabled) {
					background: hsl(var(--accent));
				}
				.popup-page-btn:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}
				.popup-page-info {
					font-size: 11px;
					color: hsl(var(--muted-foreground));
				}
			</style>
		`;
	}

	// Handle pagination click
	function handlePaginationClick(event: Event) {
		const target = event.target as HTMLElement;
		if (target.classList.contains('popup-page-btn') && !target.hasAttribute('disabled')) {
			const markerId = target.dataset.markerId;
			const page = parseInt(target.dataset.page || '0', 10);

			if (markerId) {
				paginationState.set(markerId, page);
				const marker = markers.find(m => m.id === markerId);
				if (marker) {
					const popupContainer = document.querySelector(`.popup-container[data-marker-id="${markerId}"]`);
					if (popupContainer) {
						popupContainer.outerHTML = generatePopupContent(marker, page);
					}
				}
			}
		}
	}

	// Close all popups except the one being opened
	function closeOtherPopups(currentMarker?: maplibregl.Marker) {
		mapMarkers.forEach(marker => {
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
			style: 'https://demotiles.maplibre.org/style.json',
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
		mapMarkers.forEach(marker => marker.remove());
		mapMarkers = [];

		// Add new markers
		markers.forEach((markerData) => {
			const radius = getMarkerRadius(markerData.count);
			const color = getMarkerColor(markerData.type);

			// Create marker element
			const el = document.createElement('div');
			el.className = 'location-marker';
			el.style.width = `${radius * 2}px`;
			el.style.height = `${radius * 2}px`;
			el.style.backgroundColor = color;
			el.style.opacity = '0.7';
			el.style.borderRadius = '50%';
			el.style.border = '2px solid white';
			el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
			el.style.cursor = 'pointer';
			el.style.display = 'flex';
			el.style.alignItems = 'center';
			el.style.justifyContent = 'center';
			el.style.color = 'white';
			el.style.fontSize = radius > 20 ? '12px' : '10px';
			el.style.fontWeight = 'bold';
			el.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';

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
			}).setHTML(generatePopupContent(markerData, currentPage));

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
		mapMarkers.forEach(marker => marker.remove());
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
		isFullscreen
			? 'fixed inset-0 z-50 bg-background p-4'
			: 'w-full h-full min-h-[550px]',
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
				<p class="text-sm">
					Geolocation data files (dev.geoloc_*.json) could not be loaded.
				</p>
			</div>
		</div>
	{:else if markers.length === 0 && mapReady}
		<div class="flex-1 flex items-center justify-center bg-muted rounded-lg">
			<p class="text-muted-foreground">No locations with coordinates found</p>
		</div>
	{:else}
		<div class="flex-1 relative rounded-lg border" style={isFullscreen ? '' : 'min-height: 550px; overflow: visible;'}>
			<div bind:this={mapContainer} class="absolute inset-0 w-full h-full rounded-lg overflow-hidden"></div>

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
				<div class="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-background/90 border rounded-md px-4 py-2 shadow-sm">
					<h3 class="text-lg font-semibold">{title}</h3>
				</div>
			{/if}
		</div>

		<!-- Legend -->
		<div class={cn('flex flex-wrap gap-4 justify-center text-sm', isFullscreen ? 'mt-4' : 'mt-3')}>
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full bg-chart-1 opacity-70"></div>
				<span class="text-muted-foreground">City</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full bg-chart-2 opacity-70"></div>
				<span class="text-muted-foreground">Country</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full bg-chart-5 opacity-70"></div>
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
