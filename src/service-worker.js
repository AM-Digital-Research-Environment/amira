/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, version } from '$service-worker';

const self = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (globalThis.self));

// Unique cache name per deployment
const CACHE = `cache-${version}`;

// Only pre-cache build assets (JS/CSS bundles with content hashes).
// Static files (especially the large data/ directory) are cached on-demand.
const PRECACHE_ASSETS = new Set(build);

self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(build);
	}

	event.waitUntil(addFilesToCache());
	// Activate immediately without waiting for old tabs to close
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
	// Take control of all open clients immediately
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Skip cross-origin requests (map tiles, fonts, etc.)
	if (url.origin !== self.location.origin) return;

	async function respond() {
		const cache = await caches.open(CACHE);

		// Build assets (JS/CSS bundles) — cache-first, they're immutable per version
		if (PRECACHE_ASSETS.has(url.pathname)) {
			const cached = await cache.match(url.pathname);
			if (cached) return cached;
		}

		// Data files (.json in /data/) — stale-while-revalidate
		// Serve cached version immediately, fetch fresh copy in background
		if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) {
			const cached = await cache.match(event.request);

			// Fetch fresh version in background
			const networkFetch = fetch(event.request).then((response) => {
				if (response.status === 200) {
					cache.put(event.request, response.clone());
				}
				return response;
			});

			// Return cached version immediately if available, otherwise wait for network
			return cached || networkFetch;
		}

		// Everything else — network-first with cache fallback
		try {
			const response = await fetch(event.request);

			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}

			return response;
		} catch {
			const cached = await cache.match(event.request);
			if (cached) return cached;

			// Return a basic offline page for navigation requests
			if (event.request.mode === 'navigate') {
				return new Response('Offline — please check your connection and try again.', {
					status: 503,
					headers: { 'Content-Type': 'text/html' }
				});
			}

			throw new Error('Network unavailable and no cache');
		}
	}

	event.respondWith(respond());
});
