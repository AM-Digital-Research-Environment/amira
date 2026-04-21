<script lang="ts">
	import { onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import { CHART_COLORS, getThemeShadow } from '$lib/styles';
	import { MAP_STYLE } from './map/mapHelpers';
	import { theme } from '$lib/stores/data';

	interface Marker {
		latitude: number;
		longitude: number;
		label?: string;
		color?: string;
		/** Optional image URL — when set, the marker renders as a circular badge
		 *  using the image instead of the default coloured dot. */
		iconUrl?: string;
		/** Optional URL — when set, the popup label becomes a clickable link. */
		href?: string;
	}

	interface Props {
		markers: Marker[];
		zoom?: number;
		class?: string;
	}

	let { markers, zoom, class: className = '' }: Props = $props();

	let mapContainer: HTMLDivElement | undefined = $state();
	let map: maplibregl.Map | null = null;
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
				if (m.href) {
					const escapedLabel = m.label
						.replace(/&/g, '&amp;')
						.replace(/</g, '&lt;')
						.replace(/>/g, '&gt;');
					const escapedHref = m.href.replace(/"/g, '&quot;');
					popup.setHTML(
						`<a href="${escapedHref}" class="font-medium hover:underline" style="color: hsl(var(--primary))">${escapedLabel}</a>`
					);
				} else {
					popup.setText(m.label);
				}
				marker.setPopup(popup);
			}

			mapMarkers.push(marker);
		});

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

<div class="rounded-lg border overflow-hidden {className}" style="min-height: 250px;">
	<div bind:this={mapContainer} class="w-full h-full" style="min-height: 250px;"></div>
</div>
