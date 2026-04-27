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

	// 1. Light-tier core — manifest + small stores everyone needs.
	const coreUrls = uniqueWhole([
		`${basePath}/data/manifest.json`,
		`${basePath}/data/projects.json`,
		`${basePath}/data/persons.json`,
		`${basePath}/data/institutions.json`,
		`${basePath}/data/groups.json`,
		`${basePath}/data/research_sections.json`,
		`${basePath}/data/manual/research_sections.json`,
		`${basePath}/thumbnails/manifest.json`,
		`${basePath}/data/geo/wikidata.json`
	]);

	reg.active.postMessage({ type: 'PREFETCH_DATA', urls: coreUrls });

	// 2. Per-university collection dumps. We discover them from the manifest
	//    so we don't hard-code the institution list.
	try {
		const manifestResp = await fetch(`${basePath}/data/manifest.json`);
		if (!manifestResp.ok) return;
		const manifest: { universities?: Record<string, string[]> } = await manifestResp.json();
		const universities = Object.keys(manifest.universities ?? {});
		const collectionUrls = universities.flatMap((u) => [
			`${basePath}/data/projects_metadata_${u}/index.json`
		]);
		if (collectionUrls.length > 0) {
			reg.active.postMessage({ type: 'PREFETCH_DATA', urls: collectionUrls });
		}
	} catch {
		// Manifest unavailable (offline, 404 in a fresh build) — give up.
	}
}
