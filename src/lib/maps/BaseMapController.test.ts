import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseMapController } from './BaseMapController';

// MapLibre touches WebGL, DOM, and a few browser-only APIs that jsdom
// doesn't ship. Stub the whole module so we can drive the controller
// purely against fakes — we're testing the lifecycle wiring, not the
// renderer itself.
vi.mock('maplibre-gl', () => {
	class FakeNavigationControl {}

	class FakeMap {
		container: HTMLElement;
		style: string;
		center: [number, number];
		zoom: number;
		attributionControl: unknown;
		controls: unknown[] = [];
		listeners = new Map<string, Array<() => void>>();
		removed = false;

		constructor(opts: {
			container: HTMLElement;
			style: string;
			center: [number, number];
			zoom: number;
			attributionControl: unknown;
		}) {
			this.container = opts.container;
			this.style = opts.style;
			this.center = opts.center;
			this.zoom = opts.zoom;
			this.attributionControl = opts.attributionControl;
		}

		addControl(c: unknown, _pos?: string) {
			this.controls.push(c);
		}

		on(name: string, handler: () => void) {
			if (!this.listeners.has(name)) this.listeners.set(name, []);
			this.listeners.get(name)!.push(handler);
		}

		once(name: string, handler: () => void) {
			this.on(name, handler);
		}

		setStyle(style: string) {
			this.style = style;
		}

		remove() {
			this.removed = true;
		}

		// Test helper — fire a named lifecycle event on demand.
		fire(name: string) {
			for (const h of this.listeners.get(name) ?? []) h();
		}
	}

	return {
		default: { Map: FakeMap, NavigationControl: FakeNavigationControl },
		Map: FakeMap,
		NavigationControl: FakeNavigationControl
	};
});

let container: HTMLDivElement;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
});

afterEach(() => {
	container.remove();
});

describe('BaseMapController', () => {
	it('returns null before init and the map after', () => {
		const c = new BaseMapController(container, { theme: 'light' });
		expect(c.map).toBeNull();
		c.init();
		expect(c.map).not.toBeNull();
	});

	it('applies the light style by default', () => {
		const c = new BaseMapController(container, { theme: 'light' });
		const map = c.init() as unknown as { style: string };
		expect(map.style).toMatch(/positron/);
	});

	it('applies the dark style when theme=dark', () => {
		const c = new BaseMapController(container, { theme: 'dark' });
		const map = c.init() as unknown as { style: string };
		expect(map.style).toMatch(/dark-matter/);
	});

	it('honours center + zoom', () => {
		const c = new BaseMapController(container, { theme: 'light', center: [-3, 5], zoom: 7 });
		const map = c.init() as unknown as { center: [number, number]; zoom: number };
		expect(map.center).toEqual([-3, 5]);
		expect(map.zoom).toBe(7);
	});

	it('adds the navigation control by default', () => {
		const c = new BaseMapController(container, { theme: 'light' });
		const map = c.init() as unknown as { controls: unknown[] };
		expect(map.controls.length).toBe(1);
	});

	it('skips the navigation control when navigationControl=false', () => {
		const c = new BaseMapController(container, { theme: 'light', navigationControl: false });
		const map = c.init() as unknown as { controls: unknown[] };
		expect(map.controls.length).toBe(0);
	});

	it('runs onStyleReady on initial load', () => {
		const onStyleReady = vi.fn();
		const c = new BaseMapController(container, { theme: 'light', onStyleReady });
		const map = c.init() as unknown as { fire(name: string): void };
		expect(onStyleReady).not.toHaveBeenCalled();
		map.fire('load');
		expect(onStyleReady).toHaveBeenCalledTimes(1);
	});

	it('setTheme no-ops when called with the current theme', () => {
		const c = new BaseMapController(container, { theme: 'light' });
		c.init();
		expect(c.setTheme('light')).toBe(false);
	});

	it('setTheme swaps the style and re-runs onStyleReady', () => {
		const onStyleReady = vi.fn();
		const c = new BaseMapController(container, { theme: 'light', onStyleReady });
		const map = c.init() as unknown as { style: string; fire(name: string): void };
		map.fire('load'); // initial style.load
		expect(onStyleReady).toHaveBeenCalledTimes(1);

		expect(c.setTheme('dark')).toBe(true);
		expect(map.style).toMatch(/dark-matter/);
		map.fire('style.load');
		expect(onStyleReady).toHaveBeenCalledTimes(2);
	});

	it('setTheme returns false when controller is not initialised', () => {
		const c = new BaseMapController(container, { theme: 'light' });
		expect(c.setTheme('dark')).toBe(false);
	});

	it('destroy removes the map and clears the reference', () => {
		const c = new BaseMapController(container, { theme: 'light' });
		const map = c.init() as unknown as { removed: boolean };
		c.destroy();
		expect(map.removed).toBe(true);
		expect(c.map).toBeNull();
	});

	it('destroy is a no-op when never initialised', () => {
		const c = new BaseMapController(container, { theme: 'light' });
		expect(() => c.destroy()).not.toThrow();
		expect(c.map).toBeNull();
	});
});
