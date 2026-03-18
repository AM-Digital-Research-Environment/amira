<script lang="ts">
	import { onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import { CHART_COLORS } from '$lib/styles';

	interface Marker {
		latitude: number;
		longitude: number;
		label?: string;
		color?: string;
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

	function initializeMap() {
		if (!mapContainer || map) return;

		const center: [number, number] = markers.length === 1
			? [markers[0].longitude, markers[0].latitude]
			: [10, 20];

		const initialZoom = zoom ?? (markers.length === 1 ? 5 : 2);

		map = new maplibregl.Map({
			container: mapContainer,
			style: 'https://demotiles.maplibre.org/style.json',
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

		markers.forEach((m) => {
			const el = document.createElement('div');
			el.style.width = '16px';
			el.style.height = '16px';
			el.style.backgroundColor = m.color || CHART_COLORS[0];
			el.style.borderRadius = '50%';
			el.style.border = '2px solid hsl(var(--background))';
			el.style.boxShadow = 'var(--shadow-sm, 0 1px 3px 0 rgb(0 0 0 / 0.1))';

			const marker = new maplibregl.Marker({ element: el })
				.setLngLat([m.longitude, m.latitude])
				.addTo(map!);

			if (m.label) {
				marker.setPopup(
					new maplibregl.Popup({ offset: 12, closeButton: false })
						.setText(m.label)
				);
			}

			mapMarkers.push(marker);
		});

		if (markers.length > 1) {
			const bounds = new maplibregl.LngLatBounds();
			markers.forEach((m) => bounds.extend([m.longitude, m.latitude]));
			map.fitBounds(bounds, { padding: 40, maxZoom: 8 });
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
