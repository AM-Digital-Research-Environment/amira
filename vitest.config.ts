import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
	test: {
		environment: 'jsdom',
		// jsdom defaults to `about:blank`, which makes any same-origin
		// `history.replaceState('http://...')` fail with SecurityError.
		// Anchoring to localhost lets URL-aware tests (detailListState)
		// drive `window.history` directly.
		environmentOptions: {
			jsdom: {
				url: 'http://localhost/'
			}
		},
		globals: true,
		setupFiles: ['./src/test-setup.ts'],
		include: ['src/**/*.{test,spec}.{js,ts}'],
		exclude: ['node_modules', '.svelte-kit', 'build', 'tests/e2e/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			include: ['src/lib/**/*.{ts,svelte}'],
			exclude: [
				'src/lib/**/*.test.ts',
				'src/lib/**/*.spec.ts',
				'src/lib/types/**',
				'src/lib/**/index.ts'
			]
		}
	}
});
