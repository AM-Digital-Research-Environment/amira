/**
 * Best-effort prefetcher that warms the service worker's data cache so the
 * dashboard works offline after the first visit.
 *
 * What gets prefetched:
 *   - The data manifest + lightweight stores (projects, persons, etc.) —
 *     these are needed by every route, so caching them up front means a
 *     fully cold/offline boot still hydrates the sidebar and entity lists.
 *   - The full per-university collection dumps — modest in size (~13 MB)
 *     and required by the home overview, /research-items, /network, etc.
 *
 * What is NOT prefetched:
 *   - The 386 MB knowledge_graphs/ directory and the 55 MB
 *     entity_dashboards/ directory. Those are huge and would blow the
 *     browser's storage quota; they are SWR-cached on demand instead.
 *
 * This runs once per session, on `requestIdleCallback` so it never
 * competes with critical render work, and silently no-ops when there's
 * no service worker or the user is offline.
 */

import { DATA_PATHS } from './loaders/collectionLoader';

const PREFETCH_KEY = 'amira:prefetch:done';

function uniqueWhole(urls: string[]): string[] {
	return Array.from(new Set(urls.filter(Boolean)));
}

export function schedulePrefetch(basePath: string = ''): void {
	if (typeof window === 'undefined') return;
	if (!('serviceWorker' in navigator)) return;
	if (sessionStorage.getItem(PREFETCH_KEY)) return;

	const run = () => {
		void prefetch(basePath).catch(() => {
			/* swallow — we're best-effort */
		});
	};

	if ('requestIdleCallback' in window) {
		(
			window as unknown as {
				requestIdleCallback: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => void;
			}
		).requestIdleCallback(run, { timeout: 4000 });
	} else {
		setTimeout(run, 2000);
	}
}

async function prefetch(basePath: string): Promise<void> {
	sessionStorage.setItem(PREFETCH_KEY, '1');

	const reg = await navigator.serviceWorker.ready;
	if (!reg.active) return;

	// 1. Light-tier core — manifest + small stores everyone needs. Paths come
	//    from DATA_PATHS so the SW caches exactly what the loaders fetch; if
	//    a path drifts here vs. there the route silently re-fetches live.
	const coreUrls = uniqueWhole([
		DATA_PATHS.manifest(basePath),
		DATA_PATHS.projects(basePath),
		DATA_PATHS.persons(basePath),
		DATA_PATHS.institutions(basePath),
		DATA_PATHS.groups(basePath),
		DATA_PATHS.researchSections(basePath),
		DATA_PATHS.enrichedLocations(basePath),
		DATA_PATHS.thumbnailsManifest(basePath)
	]);

	reg.active.postMessage({ type: 'PREFETCH_DATA', urls: coreUrls });

	// 2. Per-university and external collection dumps. We discover them from
	//    the manifest so we don't hard-code the institution list. Each entry
	//    is one project-metadata file matching loadUniversityCollection /
	//    loadExternalCollection's path builder (DATA_PATHS.collection).
	try {
		const manifestResp = await fetch(DATA_PATHS.manifest(basePath));
		if (!manifestResp.ok) return;
		const manifest: {
			universities?: Record<string, string[]>;
			external?: Record<string, string[]>;
		} = await manifestResp.json();
		const collectionUrls: string[] = [];
		for (const [u, colls] of Object.entries(manifest.universities ?? {})) {
			const folder = `projects_metadata_${u}`;
			for (const coll of colls) {
				collectionUrls.push(DATA_PATHS.collection(folder, coll, basePath));
			}
		}
		for (const [folder, colls] of Object.entries(manifest.external ?? {})) {
			for (const coll of colls) {
				collectionUrls.push(DATA_PATHS.collection(folder, coll, basePath));
			}
		}
		if (collectionUrls.length > 0) {
			reg.active.postMessage({ type: 'PREFETCH_DATA', urls: collectionUrls });
		}
	} catch {
		// Manifest unavailable (offline, 404 in a fresh build) — give up.
	}
}
