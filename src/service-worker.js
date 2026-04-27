/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, prerendered, version } from '$service-worker';

const self = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (globalThis.self));

// Unique cache name per deployment.
const STATIC_CACHE = `static-${version}`;
// Data cache lives across deployments — versioned per release so a new build
// gracefully replaces stale entries, while keeping recent data for users on
// the previous version still loading the page from a cold tab.
const DATA_CACHE = `data-${version}`;

// Pre-cache shipped build assets + prerendered HTML + the small static files
// (favicon, robots, manifest). The big data/ directory is cached on demand.
const PRECACHE_ASSETS = [...build, ...prerendered, ...files];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS)));
	// Activate the new SW immediately; the old one keeps serving open tabs
	// until they reload.
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== STATIC_CACHE && key !== DATA_CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
	// Claim open clients so they stop talking to the previous SW.
	self.clients.claim();
});

const PRECACHE_SET = new Set(PRECACHE_ASSETS);

/**
 * Cache-first strategy. Use for content-hashed JS/CSS bundles and any other
 * file we shipped with this build — they're immutable for the lifetime of
 * the cache so a network round-trip is wasteful.
 */
async function cacheFirst(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	if (response.status === 200) cache.put(request, response.clone());
	return response;
}

/**
 * Stale-while-revalidate. Serve cache immediately, refresh in the
 * background. Used for data/ JSON so the dashboard renders instantly on
 * repeat visits while still picking up fresh data when available.
 */
async function staleWhileRevalidate(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	const networkFetch = fetch(request)
		.then((response) => {
			if (response.status === 200) cache.put(request, response.clone());
			return response;
		})
		.catch(() => cached);
	return cached || networkFetch;
}

/**
 * Network-first with cache fallback. Used for everything else (typically
 * navigations to non-prerendered pages, which shouldn't really exist for
 * adapter-static, but we keep the fallback for resilience).
 */
async function networkFirst(request, cacheName) {
	const cache = await caches.open(cacheName);
	try {
		const response = await fetch(request);
		if (response.status === 200) cache.put(request, response.clone());
		return response;
	} catch {
		const cached = await cache.match(request);
		if (cached) return cached;
		// Final offline fallback for navigation requests.
		if (request.mode === 'navigate') {
			const indexFallback = await cache.match('/');
			if (indexFallback) return indexFallback;
			return new Response('Offline — open this site once while online to cache it.', {
				status: 503,
				headers: { 'Content-Type': 'text/plain' }
			});
		}
		throw new Error('Network unavailable and no cache');
	}
}

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Skip cross-origin requests (map tiles, fonts, embeds, etc.) — they
	// have their own caching policies and should not be intercepted.
	if (url.origin !== self.location.origin) return;

	// Build assets are immutable per version → cache-first.
	if (PRECACHE_SET.has(url.pathname)) {
		event.respondWith(cacheFirst(event.request, STATIC_CACHE));
		return;
	}

	// Data files (per-entity JSON, knowledge-graph payloads, etc.) →
	// stale-while-revalidate.
	if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) {
		event.respondWith(staleWhileRevalidate(event.request, DATA_CACHE));
		return;
	}

	// Thumbnails, logos, icons — relatively stable, also stale-while-revalidate.
	if (
		url.pathname.includes('/thumbnails/') ||
		url.pathname.includes('/logos/') ||
		url.pathname.includes('/icons/') ||
		url.pathname.includes('/images/')
	) {
		event.respondWith(staleWhileRevalidate(event.request, DATA_CACHE));
		return;
	}

	event.respondWith(networkFirst(event.request, STATIC_CACHE));
});

/**
 * Prefetch the bulk data files into the cache. The page can call this from
 * `postMessage({ type: 'PREFETCH_DATA', urls: [...] })` to warm the cache
 * for full offline use without blocking initial render.
 */
self.addEventListener('message', async (event) => {
	if (!event.data) return;
	if (event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
		return;
	}
	if (event.data.type === 'PREFETCH_DATA' && Array.isArray(event.data.urls)) {
		const cache = await caches.open(DATA_CACHE);
		await Promise.allSettled(
			event.data.urls.map(async (rawUrl) => {
				try {
					const target = new Request(rawUrl);
					const cached = await cache.match(target);
					if (cached) return; // already warm
					const response = await fetch(target, { cache: 'force-cache' });
					if (response.status === 200) await cache.put(target, response);
				} catch {
					// Best-effort warming — silently drop failures.
				}
			})
		);
		event.source?.postMessage({ type: 'PREFETCH_DATA_COMPLETE' });
	}
});
