<script lang="ts">
	/**
	 * Country-level choropleth on Natural Earth 110m admin_0 boundaries.
	 *
	 * Joins `data: { country, count }[]` against the GeoJSON `ADMIN` property
	 * (with NAME / NAME_EN / NAME_LONG fallbacks) and styles a MapLibre
	 * fill-layer with a log-scaled teal sequential color ramp. Hovered country
	 * highlights with a darker outline and shows count + share in a popup.
	 *
	 * GeoJSON (~216 KB) is fetched lazily from `static/data/geo/world-countries-110m.json`
	 * and cached on `window` so additional choropleths on the same page reuse
	 * the parsed object.
	 */
	import { base } from '$app/paths';
	import { onDestroy, type Snippet } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import type { FeatureCollection, Geometry } from 'geojson';
	import { cn } from '$lib/utils/cn';
	import { MAP_STYLE } from '$lib/maps/mapHelpers';
	import MapProjectionToggle from '$lib/maps/MapProjectionToggle.svelte';
	import { theme } from '$lib/stores/data';

	export interface ChoroplethDataPoint {
		country: string;
		count: number;
	}

	interface Props {
		data: ChoroplethDataPoint[];
		class?: string;
		/** Defaults to fitting the bounds of countries with data. Pass
		 *  [w, s, e, n] to override. */
		bounds?: [number, number, number, number];
		/** Optional content rendered next to the Globe toggle inside the map
		 *  frame — see LocationMap.extraControls for rationale. */
		extraControls?: Snippet;
		/** Override the FullscreenControl target — see LocationMap. */
		fullscreenContainer?: HTMLElement | null;
		/** Bindable globe-projection flag — see LocationMap. */
		isGlobe?: boolean;
	}

	let {
		data,
		class: className = '',
		bounds,
		extraControls,
		fullscreenContainer = null,
		isGlobe = $bindable(false)
	}: Props = $props();

	// Color ramp — teal sequential. Tuned in HSL so the same ramp works light/dark
	// once the basemap style swaps. The empty-fill stop sits closer to the
	// surrounding land color in each theme so countries without data don't
	// punch a hole in the map.
	const RAMP = {
		light: {
			empty: '#e7e3df',
			stops: ['#cbe6e3', '#9bd0cb', '#5cb6ae', '#2f9389', '#196b69'] as const
		},
		dark: {
			empty: '#2a221d',
			stops: ['#1f4d4a', '#286e69', '#318b85', '#4ab5ae', '#7bd3cd'] as const
		}
	} as const;

	const SOURCE_ID = 'world-countries';
	const FILL_LAYER = 'world-countries-fill';
	const OUTLINE_LAYER = 'world-countries-outline';
	const HOVER_LAYER = 'world-countries-hover';

	type WorldGeoJSON = FeatureCollection<Geometry, Record<string, unknown>>;
	const WINDOW_CACHE_KEY = '__amira_world_countries_110m__';

	let mapContainer: HTMLDivElement | undefined = $state();
	let mapFrame: HTMLDivElement | undefined = $state();
	let map: maplibregl.Map | null = $state(null);
	let mapReady = $state(false);
	let initialTheme: string | null = null;
	let popup: maplibregl.Popup | null = null;
	let hoveredFeatureId: string | number | null = null;
	let geoJson: WorldGeoJSON | null = null;

	// country name → count, lower-cased keys to absorb minor casing diffs.
	// The Map is rebuilt fresh on every $derived recompute, never mutated
	// in place — no need for SvelteMap.
	let countryCounts = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const m = new Map<string, number>();
		for (const d of data) {
			if (!d.country) continue;
			m.set(d.country.toLowerCase(), (m.get(d.country.toLowerCase()) || 0) + (d.count || 0));
		}
		return m;
	});

	let totalItems = $derived(data.reduce((s, d) => s + (d.count || 0), 0));
	let countriesWithData = $derived(countryCounts.size);
	let maxCount = $derived(Math.max(...Array.from(countryCounts.values()), 1));

	// Five log-spaced breakpoints from min..max → matches the 5 ramp stops.
	let breaks = $derived.by(() => {
		const max = Math.max(maxCount, 1);
		const log = Math.log(max + 1);
		return [0, 1, 2, 3, 4].map((i) => Math.round(Math.exp((log * i) / 4) - 1));
	});

	async function loadGeoJson(): Promise<WorldGeoJSON> {
		if (geoJson) return geoJson;
		// Cache parsed GeoJSON on the window so multiple choropleths on the
		// same route only pay the fetch + parse cost once.
		const win =
			typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null;
		const cached = win?.[WINDOW_CACHE_KEY] as WorldGeoJSON | undefined;
		if (cached) {
			geoJson = cached;
			return cached;
		}
		const resp = await fetch(`${base}/data/geo/world-countries-110m.json`);
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
		const data: WorldGeoJSON = await resp.json();
		// Normalise `id` to ISO_A3 so MapLibre's setFeatureState works without
		// per-feature lookup gymnastics during hover.
		data.features.forEach((f, i) => {
			const iso = (f.properties?.ISO_A3 as string | undefined) || `_${i}`;
			f.id = iso;
		});
		geoJson = data;
		if (win) win[WINDOW_CACHE_KEY] = data;
		return data;
	}

	function lookupCount(props: Record<string, unknown>): number {
		const candidates = ['ADMIN', 'NAME', 'NAME_EN', 'NAME_LONG'] as const;
		for (const k of candidates) {
			const v = props[k];
			if (typeof v === 'string') {
				const c = countryCounts.get(v.toLowerCase());
				if (c !== undefined) return c;
			}
		}
		return 0;
	}

	function withCounts(geo: WorldGeoJSON): WorldGeoJSON {
		// Inject a `count` numeric property the fill expression reads against.
		return {
			type: 'FeatureCollection',
			features: geo.features.map((f) => ({
				...f,
				properties: { ...(f.properties || {}), count: lookupCount(f.properties || {}) }
			}))
		};
	}

	function buildFillExpression(
		isDark: boolean
	): maplibregl.DataDrivenPropertyValueSpecification<string> {
		const ramp = isDark ? RAMP.dark : RAMP.light;
		const [b1, b2, b3, b4, b5] = breaks;
		// Step expression — `0` collapses to "no data" gray; subsequent stops
		// follow the log-spaced breakpoints. interpolate would smear the
		// no-data category into the ramp, which reads as misleading.
		return [
			'step',
			['get', 'count'],
			ramp.empty,
			Math.max(1, b1) || 1,
			ramp.stops[0],
			Math.max(b2, b1 + 1),
			ramp.stops[1],
			Math.max(b3, b2 + 1),
			ramp.stops[2],
			Math.max(b4, b3 + 1),
			ramp.stops[3],
			Math.max(b5, b4 + 1),
			ramp.stops[4]
		];
	}

	/**
	 * Walk geometry rings to extend a LngLatBounds. Polygon and MultiPolygon
	 * are the only shapes Natural Earth ships, but Geometry includes other
	 * variants — we ignore those rather than throw.
	 */
	function extendBounds(b: maplibregl.LngLatBounds, geom: Geometry | null): void {
		if (!geom) return;
		if (geom.type === 'Polygon') {
			for (const ring of geom.coordinates) {
				for (const c of ring) b.extend([c[0], c[1]]);
			}
		} else if (geom.type === 'MultiPolygon') {
			for (const poly of geom.coordinates) {
				for (const ring of poly) {
					for (const c of ring) b.extend([c[0], c[1]]);
				}
			}
		}
	}

	function fitBoundsToData(geo: WorldGeoJSON): void {
		if (!map) return;
		const b = new maplibregl.LngLatBounds();
		let any = false;
		for (const f of geo.features) {
			const props = (f.properties || {}) as Record<string, unknown>;
			if (lookupCount(props) > 0) {
				extendBounds(b, f.geometry as Geometry);
				any = true;
			}
		}
		if (!any) return;
		// `padding` keeps the basemap edge from cropping countries flush against
		// the canvas. Skip the animation on first paint — feels jumpy when the
		// fill is still rendering tiles.
		map.fitBounds(b, { padding: 40, duration: 0, maxZoom: 5 });
	}

	function ensureLayers(geo: WorldGeoJSON) {
		if (!map) return;
		const isDark = $theme === 'dark';
		const merged = withCounts(geo);

		const existing = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
		if (existing) {
			existing.setData(merged);
		} else {
			map.addSource(SOURCE_ID, { type: 'geojson', data: merged, promoteId: 'ISO_A3' });
		}

		if (!map.getLayer(FILL_LAYER)) {
			map.addLayer({
				id: FILL_LAYER,
				type: 'fill',
				source: SOURCE_ID,
				paint: {
					'fill-color': buildFillExpression(isDark),
					'fill-outline-color': isDark ? '#0c0807' : '#fdfdfc',
					'fill-opacity': 0.92
				}
			});
		} else {
			map.setPaintProperty(FILL_LAYER, 'fill-color', buildFillExpression(isDark));
			map.setPaintProperty(FILL_LAYER, 'fill-outline-color', isDark ? '#0c0807' : '#fdfdfc');
		}

		if (!map.getLayer(OUTLINE_LAYER)) {
			map.addLayer({
				id: OUTLINE_LAYER,
				type: 'line',
				source: SOURCE_ID,
				paint: {
					'line-color': isDark ? '#0c0807' : '#fdfdfc',
					'line-width': 0.5
				}
			});
		}

		if (!map.getLayer(HOVER_LAYER)) {
			map.addLayer({
				id: HOVER_LAYER,
				type: 'line',
				source: SOURCE_ID,
				paint: {
					'line-color': isDark ? '#7bd3cd' : '#196b69',
					'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 0]
				}
			});
		}
	}

	function attachInteractivity() {
		if (!map) return;

		map.on('mousemove', FILL_LAYER, (e) => {
			if (!map || !e.features?.length) return;
			const f = e.features[0];
			const id = f.id;
			if (id == null) return;

			if (hoveredFeatureId !== null && hoveredFeatureId !== id) {
				map.setFeatureState({ source: SOURCE_ID, id: hoveredFeatureId }, { hover: false });
			}
			hoveredFeatureId = id;
			map.setFeatureState({ source: SOURCE_ID, id }, { hover: true });

			map.getCanvas().style.cursor = 'pointer';

			const props = (f.properties || {}) as Record<string, unknown>;
			const name = (props.ADMIN || props.NAME_EN || props.NAME) as string | undefined;
			const count = Number(props.count || 0);
			const share = totalItems > 0 ? (count / totalItems) * 100 : 0;
			const html = `
				<div class="text-sm">
					<div class="font-semibold">${name ?? 'Unknown'}</div>
					${
						count > 0
							? `<div class="text-muted-foreground"><span class="font-medium">${count.toLocaleString()}</span> item${count === 1 ? '' : 's'} · ${share.toFixed(1)}%</div>`
							: '<div class="text-muted-foreground">No items</div>'
					}
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

		map.on('mouseleave', FILL_LAYER, () => {
			if (!map) return;
			if (hoveredFeatureId !== null) {
				map.setFeatureState({ source: SOURCE_ID, id: hoveredFeatureId }, { hover: false });
				hoveredFeatureId = null;
			}
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
		// Restore lifted projection (see LocationMap for rationale).
		if (isGlobe) {
			map.setProjection({ type: 'globe' });
		}

		map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
		// Fullscreen targets the frame (canvas + overlaid controls) so the
		// Globe toggle and any caller-supplied `extraControls` stay visible
		// in fullscreen. See LocationMap for the same pattern.
		map.addControl(
			new maplibregl.FullscreenControl({
				container: fullscreenContainer ?? mapFrame ?? undefined
			}),
			'top-right'
		);

		// Same `load`/`idle`/`styledata` triple that fixed the LocationMap
		// stall on entity-detail dashboards (commit 4d73b9b8). MapLibre's
		// `load` event silently fails when the canvas mounts inside a flex
		// container that's offscreen at init.
		let firstReadyFired = false;
		const markReady = async () => {
			if (firstReadyFired || !map) return;
			firstReadyFired = true;
			mapReady = true;
			try {
				const geo = await loadGeoJson();
				if (!map) return;
				ensureLayers(geo);
				attachInteractivity();
				if (bounds) {
					map.fitBounds(
						[
							[bounds[0], bounds[1]],
							[bounds[2], bounds[3]]
						],
						{ padding: 32, duration: 0 }
					);
				} else {
					fitBoundsToData(geo);
				}
			} catch (err) {
				console.error('Choropleth GeoJSON load failed:', err);
			}
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

	// Re-render fill when the joined data changes after init.
	$effect(() => {
		// Touch reactive deps so this re-runs when data updates.
		void countryCounts;
		void breaks;
		if (!map || !mapReady || !geoJson) return;
		ensureLayers(geoJson);
		if (!bounds) fitBoundsToData(geoJson);
	});

	// Theme-swap handling — same pattern as LocationMap.
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
			map.once('style.load', async () => {
				if (!map || !geoJson) return;
				ensureLayers(geoJson);
				attachInteractivity();
			});
		}
	});

	$effect(() => {
		if (mapContainer && !map) {
			initializeMap();
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

	let legendStops = $derived.by(() => {
		const ramp = $theme === 'dark' ? RAMP.dark : RAMP.light;
		return ramp.stops.map((color, i) => ({
			color,
			label:
				i === 0 ? `${breaks[1]}` : i === ramp.stops.length - 1 ? `${maxCount}` : `${breaks[i + 1]}`
		}));
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
			<span class="text-muted-foreground">Items per country</span>
			<div class="flex items-center">
				{#each legendStops as stop, i (i)}
					<span
						class="inline-block w-7 h-3 first:rounded-l last:rounded-r"
						style="background-color: {stop.color};"
					></span>
				{/each}
			</div>
			<span class="text-muted-foreground">1</span>
			<span class="text-muted-foreground">→</span>
			<span class="font-medium">{maxCount.toLocaleString()}</span>
		</div>
		<div class="text-muted-foreground">
			<span class="font-medium">{countriesWithData}</span> countries ·
			<span class="font-medium">{totalItems.toLocaleString()}</span> items
		</div>
	</div>
</div>
