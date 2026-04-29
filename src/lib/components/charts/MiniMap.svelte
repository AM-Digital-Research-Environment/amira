<script lang="ts">
	import { onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import { goto } from '$app/navigation';
	import { CHART_COLORS, getThemeShadow } from '$lib/styles';
	import { MAP_STYLE } from './map/mapHelpers';
	import MapProjectionToggle from './map/MapProjectionToggle.svelte';
	import { theme } from '$lib/stores/data';
	import { scrollToTop } from '$lib/utils/urlSelection';

	interface Marker {
		latitude: number;
		longitude: number;
		label?: string;
		color?: string;
		/** Optional image URL — when set, the marker renders as a circular badge
		 *  using the image instead of the default coloured dot. */
		iconUrl?: string;
		/** Optional URL — when set, the popup label becomes a clickable link
		 *  handled via SvelteKit's client-side router (no full reload). */
		href?: string;
		/** Optional secondary line rendered below the label, always unlinked. */
		sublabel?: string;
	}

	interface Props {
		markers: Marker[];
		zoom?: number;
		class?: string;
		/** When true (default), the map re-fits its bounds every time the
		 *  marker list changes. Set to false when the caller toggles markers
		 *  on/off and wants the camera to stay put after the initial render. */
		fitOnUpdate?: boolean;
	}

	let { markers, zoom, class: className = '', fitOnUpdate = true }: Props = $props();

	let mapContainer: HTMLDivElement | undefined = $state();
	// Becomes true after the first time addMarkers() runs an auto-fit. Used
	// to gate subsequent fits when fitOnUpdate is false.
	let hasAutoFit = false;
	// Tracked via $state so the projection-toggle button reactively picks
	// up the live map instance once it's initialised.
	let map: maplibregl.Map | null = $state(null);
	let mapMarkers: maplibregl.Marker[] = [];
	let initialTheme: string | null = null;

	function initializeMap() {
		if (!mapContainer || map) return;

		const center: [number, number] =
			markers.length === 1 ? [markers[0].longitude, markers[0].latitude] : [10, 20];

		const initialZoom = zoom ?? (markers.length === 1 ? 5 : 2);

		map = new maplibregl.Map({
			container: mapContainer,
			style: $theme === 'dark' ? MAP_STYLE.dark : MAP_STYLE.light,
			center,
			zoom: initialZoom,
			attributionControl: false
		});

		map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

		map.on('load', () => {
			addMarkers();
		});
	}

	function addMarkers() {
		if (!map) return;

		mapMarkers.forEach((m) => m.remove());
		mapMarkers = [];

		const shadow = getThemeShadow($theme === 'dark').sm;
		markers.forEach((m) => {
			const el = document.createElement('div');
			el.style.border = '2px solid hsl(var(--background))';
			el.style.boxShadow = shadow;
			el.style.borderRadius = '50%';
			if (m.iconUrl) {
				el.style.width = '36px';
				el.style.height = '36px';
				el.style.backgroundColor = 'hsl(var(--background))';
				el.style.overflow = 'hidden';
				el.style.display = 'flex';
				el.style.alignItems = 'center';
				el.style.justifyContent = 'center';
				el.style.cursor = 'pointer';
				const img = document.createElement('img');
				img.src = m.iconUrl;
				img.alt = m.label ?? '';
				img.style.width = '100%';
				img.style.height = '100%';
				img.style.objectFit = 'contain';
				img.draggable = false;
				el.appendChild(img);
			} else {
				el.style.width = '16px';
				el.style.height = '16px';
				el.style.backgroundColor = m.color || CHART_COLORS[0];
			}

			const marker = new maplibregl.Marker({ element: el })
				.setLngLat([m.longitude, m.latitude])
				.addTo(map!);

			if (m.label) {
				const popup = new maplibregl.Popup({ offset: 16, closeButton: false });
				const container = document.createElement('div');
				container.style.display = 'flex';
				container.style.flexDirection = 'column';
				container.style.gap = '2px';

				// Primary line: clickable link when href is set, otherwise plain text.
				if (m.href) {
					const link = document.createElement('a');
					link.href = m.href;
					link.textContent = m.label;
					link.className = 'font-medium hover:underline';
					link.style.color = 'hsl(var(--primary))';
					const href = m.href;
					link.addEventListener('click', (e) => {
						// Keep navigation inside SvelteKit's SPA router so the target
						// route's $effect(page.url) hooks fire and reactive state
						// (e.g. selected institution) actually updates. Scroll to
						// top after the route resolves so the detail panel lands at
						// the top of the viewport rather than wherever the user
						// was scrolled when they clicked the map.
						e.preventDefault();
						void goto(href).then(() => scrollToTop());
					});
					container.appendChild(link);
				} else {
					const text = document.createElement('span');
					text.textContent = m.label;
					text.className = 'font-medium';
					container.appendChild(text);
				}

				if (m.sublabel) {
					const sub = document.createElement('span');
					sub.textContent = m.sublabel;
					sub.className = 'text-xs text-muted-foreground';
					container.appendChild(sub);
				}

				popup.setDOMContent(container);
				marker.setPopup(popup);
			}

			mapMarkers.push(marker);
		});

		const shouldFit = fitOnUpdate || !hasAutoFit;
		if (shouldFit) {
			if (markers.length > 1) {
				const bounds = new maplibregl.LngLatBounds();
				markers.forEach((m) => bounds.extend([m.longitude, m.latitude]));
				map.fitBounds(bounds, { padding: 40, maxZoom: 8 });
			} else if (markers.length === 1) {
				map.flyTo({
					center: [markers[0].longitude, markers[0].latitude],
					zoom: zoom ?? 5
				});
			}
			hasAutoFit = true;
		}
	}

	$effect(() => {
		if (mapContainer && !map && markers.length > 0) {
			initializeMap();
		}
	});

	$effect(() => {
		if (map && markers) {
			addMarkers();
		}
	});

	// Switch map style when theme changes (skip initial render)
	$effect(() => {
		const currentTheme = $theme;
		if (!map) return;

		if (initialTheme === null) {
			initialTheme = currentTheme;
			return;
		}

		if (currentTheme !== initialTheme) {
			initialTheme = currentTheme;
			const style = currentTheme === 'dark' ? MAP_STYLE.dark : MAP_STYLE.light;
			map.setStyle(style);
			map.once('style.load', () => {
				addMarkers();
			});
		}
	});

	onDestroy(() => {
		mapMarkers.forEach((m) => m.remove());
		mapMarkers = [];
		if (map) {
			map.remove();
			map = null;
		}
	});
</script>

<div class="relative rounded-lg border overflow-hidden {className}" style="min-height: 250px;">
	<div bind:this={mapContainer} class="w-full h-full" style="min-height: 250px;"></div>
	<MapProjectionToggle {map} />
</div>
