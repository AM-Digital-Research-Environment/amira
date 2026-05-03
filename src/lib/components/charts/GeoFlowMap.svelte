<script lang="ts">
	/**
	 * Origin → current location flow map. Each flow is rendered as a
	 * great-circle arc whose width scales with `count`. Built on MapLibre to
	 * stay consistent with `LocationMap` / `ChoroplethMap`.
	 *
	 * Data shape:
	 *   {
	 *     flows: [
	 *       {
	 *         from: { lng, lat, label? },
	 *         to:   { lng, lat, label? },
	 *         count: number
	 *       }, ...
	 *     ]
	 *   }
	 */
	import { onDestroy, type Snippet } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import type { FeatureCollection, LineString, Point } from 'geojson';
	import { cn } from '$lib/utils/cn';
	import { MAP_STYLE } from '$lib/maps/mapHelpers';
	import MapProjectionToggle from '$lib/maps/MapProjectionToggle.svelte';
	import { theme } from '$lib/stores/data';

	export interface GeoFlowEndpoint {
		lng: number;
		lat: number;
		label?: string;
	}

	export interface GeoFlow {
		from: GeoFlowEndpoint;
		to: GeoFlowEndpoint;
		count: number;
	}

	export interface GeoFlowMapData {
		flows: GeoFlow[];
	}

	interface Props {
		data: GeoFlowMapData;
		class?: string;
		extraControls?: Snippet;
		fullscreenContainer?: HTMLElement | null;
		isGlobe?: boolean;
	}

	let {
		data,
		class: className = '',
		extraControls,
		fullscreenContainer = null,
		isGlobe = $bindable(false)
	}: Props = $props();

	const FLOW_LINES_SOURCE = 'geo-flows-lines';
	const FLOW_LINES_LAYER = 'geo-flows-lines';
	const FLOW_POINTS_SOURCE = 'geo-flows-points';
	const FLOW_POINTS_LAYER = 'geo-flows-points';

	let mapContainer: HTMLDivElement | undefined = $state();
	let mapFrame: HTMLDivElement | undefined = $state();
	let map: maplibregl.Map | null = $state(null);
	let mapReady = $state(false);
	let initialTheme: string | null = null;

	// Derived flow stats — used for width scaling and the bottom legend.
	let flowCount = $derived(data?.flows?.length ?? 0);
	let totalCount = $derived(data?.flows?.reduce((sum, f) => sum + (f.count || 0), 0) ?? 0);
	let maxCount = $derived(Math.max(1, ...(data?.flows?.map((f) => f.count) ?? [1])));

	/**
	 * Spherical-linear interpolation between two lng/lat points. Produces
	 * `n` segments along the great-circle path, which renders as a smooth
	 * arc instead of a straight line crossing the antimeridian or
	 * misrepresenting equator-crossing flows.
	 */
	function greatCircle(
		from: GeoFlowEndpoint,
		to: GeoFlowEndpoint,
		n: number = 64
	): [number, number][] {
		const φ1 = (from.lat * Math.PI) / 180;
		const λ1 = (from.lng * Math.PI) / 180;
		const φ2 = (to.lat * Math.PI) / 180;
		const λ2 = (to.lng * Math.PI) / 180;

		const Δφ = φ2 - φ1;
		const Δλ = λ2 - λ1;
		// Haversine distance in radians along the sphere.
		const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
		const δ = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

		// Degenerate case (same point) — return endpoints unchanged.
		if (δ === 0) return [[from.lng, from.lat]];

		const out: [number, number][] = [];
		for (let i = 0; i <= n; i++) {
			const t = i / n;
			const A = Math.sin((1 - t) * δ) / Math.sin(δ);
			const B = Math.sin(t * δ) / Math.sin(δ);
			const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
			const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
			const z = A * Math.sin(φ1) + B * Math.sin(φ2);
			const φ = Math.atan2(z, Math.sqrt(x * x + y * y));
			const λ = Math.atan2(y, x);
			out.push([(λ * 180) / Math.PI, (φ * 180) / Math.PI]);
		}
		return out;
	}

	function buildLinesGeoJSON(flows: GeoFlow[]): FeatureCollection<LineString> {
		return {
			type: 'FeatureCollection',
			features: flows.map((f) => ({
				type: 'Feature',
				properties: {
					count: f.count,
					fromLabel: f.from.label ?? '',
					toLabel: f.to.label ?? ''
				},
				geometry: {
					type: 'LineString',
					coordinates: greatCircle(f.from, f.to)
				}
			}))
		};
	}

	function buildPointsGeoJSON(flows: GeoFlow[]): FeatureCollection<Point> {
		// Two points per flow (origin + current). Label drives the popup.
		const features: FeatureCollection<Point>['features'] = [];
		for (const f of flows) {
			features.push({
				type: 'Feature',
				properties: { kind: 'origin', label: f.from.label ?? '', count: f.count },
				geometry: { type: 'Point', coordinates: [f.from.lng, f.from.lat] }
			});
			features.push({
				type: 'Feature',
				properties: { kind: 'current', label: f.to.label ?? '', count: f.count },
				geometry: { type: 'Point', coordinates: [f.to.lng, f.to.lat] }
			});
		}
		return { type: 'FeatureCollection', features };
	}

	function ensureLayers() {
		if (!map) return;
		const isDark = $theme === 'dark';
		const lineColor = isDark ? '#7bd3cd' : '#2f9389';
		const originColor = isDark ? '#d98559' : '#c15b1f';
		const currentColor = isDark ? '#9a82cf' : '#764fba';

		const linesData = buildLinesGeoJSON(data?.flows ?? []);
		const pointsData = buildPointsGeoJSON(data?.flows ?? []);

		const linesSource = map.getSource(FLOW_LINES_SOURCE) as maplibregl.GeoJSONSource | undefined;
		if (linesSource) linesSource.setData(linesData);
		else map.addSource(FLOW_LINES_SOURCE, { type: 'geojson', data: linesData });

		const pointsSource = map.getSource(FLOW_POINTS_SOURCE) as maplibregl.GeoJSONSource | undefined;
		if (pointsSource) pointsSource.setData(pointsData);
		else map.addSource(FLOW_POINTS_SOURCE, { type: 'geojson', data: pointsData });

		if (!map.getLayer(FLOW_LINES_LAYER)) {
			map.addLayer({
				id: FLOW_LINES_LAYER,
				type: 'line',
				source: FLOW_LINES_SOURCE,
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: {
					'line-color': lineColor,
					// Scale width with count, capped so a single dominant flow
					// doesn't drown the others. Interpolate against the live
					// max so the visual range is stable as data changes.
					'line-width': ['interpolate', ['linear'], ['get', 'count'], 0, 0.5, maxCount, 5],
					'line-opacity': 0.7
				}
			});
		} else {
			map.setPaintProperty(FLOW_LINES_LAYER, 'line-color', lineColor);
			map.setPaintProperty(FLOW_LINES_LAYER, 'line-width', [
				'interpolate',
				['linear'],
				['get', 'count'],
				0,
				0.5,
				maxCount,
				5
			]);
		}

		if (!map.getLayer(FLOW_POINTS_LAYER)) {
			map.addLayer({
				id: FLOW_POINTS_LAYER,
				type: 'circle',
				source: FLOW_POINTS_SOURCE,
				paint: {
					'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 0, 3, maxCount, 9],
					'circle-color': [
						'match',
						['get', 'kind'],
						'origin',
						originColor,
						'current',
						currentColor,
						lineColor
					],
					'circle-stroke-color': isDark ? '#0c0807' : '#fdfdfc',
					'circle-stroke-width': 1.5,
					'circle-opacity': 0.9
				}
			});
		} else {
			map.setPaintProperty(FLOW_POINTS_LAYER, 'circle-color', [
				'match',
				['get', 'kind'],
				'origin',
				originColor,
				'current',
				currentColor,
				lineColor
			]);
			map.setPaintProperty(
				FLOW_POINTS_LAYER,
				'circle-stroke-color',
				isDark ? '#0c0807' : '#fdfdfc'
			);
		}
	}

	function fitToFlows() {
		if (!map || !data?.flows?.length) return;
		const b = new maplibregl.LngLatBounds();
		for (const f of data.flows) {
			b.extend([f.from.lng, f.from.lat]);
			b.extend([f.to.lng, f.to.lat]);
		}
		map.fitBounds(b, { padding: 60, duration: 0, maxZoom: 5 });
	}

	let popup: maplibregl.Popup | null = null;
	function attachInteractivity() {
		if (!map) return;

		map.on('mousemove', FLOW_LINES_LAYER, (e) => {
			if (!map || !e.features?.length) return;
			const props = (e.features[0].properties || {}) as Record<string, unknown>;
			map.getCanvas().style.cursor = 'pointer';
			const html = `
				<div class="text-sm">
					<div><span class="text-muted-foreground">From:</span> <span class="font-medium">${props.fromLabel || '—'}</span></div>
					<div><span class="text-muted-foreground">To:</span> <span class="font-medium">${props.toLabel || '—'}</span></div>
					<div class="text-muted-foreground"><span class="font-medium">${Number(props.count || 0).toLocaleString()}</span> item${props.count === 1 ? '' : 's'}</div>
				</div>
			`;
			if (!popup) {
				popup = new maplibregl.Popup({
					closeButton: false,
					closeOnClick: false,
					offset: 8,
					maxWidth: '260px'
				});
			}
			popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
		});

		map.on('mouseleave', FLOW_LINES_LAYER, () => {
			if (!map) return;
			map.getCanvas().style.cursor = '';
			popup?.remove();
		});
	}

	async function initializeMap() {
		if (!mapContainer || map) return;

		map = new maplibregl.Map({
			container: mapContainer,
			style: $theme === 'dark' ? MAP_STYLE.dark : MAP_STYLE.light,
			center: [10, 20],
			zoom: 1.4,
			attributionControl: false,
			minZoom: 0.5,
			maxZoom: 6
		});
		if (isGlobe) map.setProjection({ type: 'globe' });

		map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
		map.addControl(
			new maplibregl.FullscreenControl({
				container: fullscreenContainer ?? mapFrame ?? undefined
			}),
			'top-right'
		);

		// Same load/idle/styledata triple LocationMap uses to dodge MapLibre's
		// silent stall when the canvas mounts inside a deeply-nested flex.
		let firstReadyFired = false;
		const markReady = () => {
			if (firstReadyFired || !map) return;
			firstReadyFired = true;
			mapReady = true;
			ensureLayers();
			attachInteractivity();
			fitToFlows();
		};
		map.once('load', markReady);
		map.once('idle', markReady);
		map.once('styledata', markReady);
		setTimeout(() => {
			if (!firstReadyFired && map) {
				map.resize();
				setTimeout(() => {
					if (!firstReadyFired) markReady();
				}, 500);
			}
		}, 1500);
	}

	$effect(() => {
		if (mapContainer && !map) initializeMap();
	});

	$effect(() => {
		// Touch reactive deps so this re-runs on data updates.
		void data;
		void maxCount;
		if (!map || !mapReady) return;
		ensureLayers();
		fitToFlows();
	});

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
				if (!map) return;
				ensureLayers();
				attachInteractivity();
			});
		}
	});

	onDestroy(() => {
		popup?.remove();
		popup = null;
		if (map) {
			map.remove();
			map = null;
		}
	});
</script>

<div class={cn('flex flex-col w-full h-full', className)}>
	<div bind:this={mapFrame} class="flex-1 relative rounded-lg border">
		<div
			bind:this={mapContainer}
			class="absolute inset-0 w-full h-full rounded-lg overflow-hidden"
		></div>
		<div class="absolute top-2 left-2 z-10 flex items-center gap-2">
			<MapProjectionToggle {map} class="" bind:isGlobe />
			{#if extraControls}{@render extraControls()}{/if}
		</div>
	</div>

	<div class="shrink-0 mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
		<div class="flex items-center gap-2">
			<span class="inline-block w-3 h-3 rounded-full" style="background-color: hsl(var(--chart-2));"
			></span>
			<span class="text-muted-foreground">Origin</span>
		</div>
		<div class="flex items-center gap-2">
			<span class="inline-block w-3 h-3 rounded-full" style="background-color: hsl(var(--chart-4));"
			></span>
			<span class="text-muted-foreground">Current</span>
		</div>
		<div class="text-muted-foreground tabular-nums">
			<span class="font-medium">{flowCount.toLocaleString()}</span> flows ·
			<span class="font-medium">{totalCount.toLocaleString()}</span> items
		</div>
	</div>
</div>
