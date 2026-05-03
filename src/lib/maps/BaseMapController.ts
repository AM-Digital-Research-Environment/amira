/**
 * BaseMapController — shared MapLibre lifecycle for the dashboard's six
 * map components (`MiniMap`, `LocationMap`, `LocationsMapView`,
 * `ChoroplethMap`, `GeoFlowMap`, `PhotoMap`).
 *
 * Each map used to inline ~40-50 lines of identical boilerplate:
 *   - new maplibregl.Map({ container, style: MAP_STYLE[theme], … })
 *   - addControl(NavigationControl)
 *   - $effect that watches `$theme`, calls setStyle on switch, re-runs
 *     marker rendering after `style.load`
 *   - onDestroy that calls map.remove()
 *
 * This controller owns all of that. Components keep their data-specific
 * marker / source / layer logic and pass it in via the `onStyleReady`
 * callback (fired once after `init()` finishes loading and again after
 * every `setTheme()` style swap).
 *
 * Usage pattern:
 *
 *   const controller = new BaseMapController(container, {
 *     theme: $theme,
 *     center: [10, 20],
 *     zoom: 2,
 *     onStyleReady: () => addMarkers()
 *   });
 *   const map = controller.init();
 *
 *   $effect(() => {
 *     controller.setTheme($theme);
 *   });
 *
 *   onDestroy(() => controller.destroy());
 */

import maplibregl from 'maplibre-gl';
import { MAP_STYLE } from './mapHelpers';

export type MapTheme = 'light' | 'dark';

export interface BaseMapControllerOptions {
	theme: MapTheme | string;
	center?: [number, number];
	zoom?: number;
	/** Add the standard top-right NavigationControl. Default `true`. */
	navigationControl?: boolean;
	/** Show the MapLibre attribution control. Default `false` to match the
	 *  existing chart components. Pass `true` for the default control or
	 *  an options object for a customised one. */
	attributionControl?: maplibregl.MapOptions['attributionControl'];
	/** Run after `init()` finishes loading the basemap *and* after every
	 *  `setTheme()` style swap completes. Use this hook to (re)attach the
	 *  component's data sources, layers, and DOM markers. */
	onStyleReady?: () => void;
}

export class BaseMapController {
	#container: HTMLElement;
	#opts: BaseMapControllerOptions;
	#map: maplibregl.Map | null = null;
	/** Tracks the most recently applied theme so `setTheme()` can no-op
	 *  when called with the same value (e.g. on every reactive re-run of
	 *  `$theme`'s `$effect`). */
	#currentTheme: string | null = null;

	constructor(container: HTMLElement, opts: BaseMapControllerOptions) {
		this.#container = container;
		this.#opts = opts;
	}

	/** Create the MapLibre map and wire the initial `style.load` hook. */
	init(): maplibregl.Map {
		this.#map = new maplibregl.Map({
			container: this.#container,
			style: this.#styleUrl(this.#opts.theme),
			center: this.#opts.center ?? [10, 20],
			zoom: this.#opts.zoom ?? 2,
			attributionControl: this.#opts.attributionControl ?? false
		});
		if (this.#opts.navigationControl !== false) {
			this.#map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
		}
		this.#currentTheme = this.#opts.theme;
		if (this.#opts.onStyleReady) {
			this.#map.on('load', this.#opts.onStyleReady);
		}
		return this.#map;
	}

	/**
	 * Apply a basemap style for `theme`. No-ops if the controller hasn't
	 * been initialised yet, or when called with the currently-applied
	 * theme. Returns `true` if a style swap actually occurred.
	 *
	 * The `onStyleReady` callback fires again once the new style finishes
	 * loading — components should rebuild data sources / layers / markers
	 * inside that hook.
	 */
	setTheme(theme: MapTheme | string): boolean {
		if (!this.#map) return false;
		if (theme === this.#currentTheme) return false;
		this.#currentTheme = theme;
		this.#map.setStyle(this.#styleUrl(theme));
		if (this.#opts.onStyleReady) {
			this.#map.once('style.load', this.#opts.onStyleReady);
		}
		return true;
	}

	/** Live MapLibre map instance (or `null` before `init()` / after
	 *  `destroy()`). */
	get map(): maplibregl.Map | null {
		return this.#map;
	}

	/** Tear down the map and release its WebGL context. */
	destroy(): void {
		if (this.#map) {
			this.#map.remove();
			this.#map = null;
		}
	}

	#styleUrl(theme: MapTheme | string): string {
		return theme === 'dark' ? MAP_STYLE.dark : MAP_STYLE.light;
	}
}
