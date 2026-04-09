import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version)
	},
	build: {
		// Emit source maps so Lighthouse / DevTools can attribute work back to
		// original sources for the production bundles served from GitHub Pages.
		sourcemap: true,
		rollupOptions: {
			output: {
				// Isolate the heavy map library so it never gets bundled with
				// echarts-only routes (the home page in particular). ECharts
				// itself is intentionally left to Rollup's default chunking
				// because per-chart splitting produces smaller route bundles
				// than a single shared vendor-echarts chunk.
				manualChunks(id) {
					if (id.includes('node_modules/maplibre-gl/')) return 'vendor-maplibre';
					return undefined;
				}
			}
		}
	}
});
