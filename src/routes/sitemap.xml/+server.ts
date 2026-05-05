import type { RequestHandler } from './$types';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

/**
 * Build-time generated sitemap.
 *
 * Top-level routes are listed manually in `STATIC_ROUTES`. Detail pages
 * (people?name=…, projects?id=…, institutions?name=…, etc.) are driven by
 * query params and the URL list is discovered by scanning the precomputed
 * entity-dashboard JSON dumps under `static/data/entity_dashboards/`.
 *
 * Because the dashboard ships as a static site (adapter-static), this
 * endpoint is pre-rendered to `build/sitemap.xml` at `npm run build` time
 * — no manual upkeep required.
 */

export const prerender = true;

const SITE = 'https://am-digital-research-environment.github.io/amira';

interface Route {
	path: string;
	priority: number;
	changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

// Keep in the same conceptual order as the sidebar so it's easy to spot a
// missing route during a review.
const STATIC_ROUTES: Route[] = [
	// Dashboard
	{ path: '/', priority: 1.0, changefreq: 'weekly' },
	{ path: '/whats-new', priority: 0.8, changefreq: 'weekly' },
	// Research
	{ path: '/research-sections', priority: 0.9, changefreq: 'monthly' },
	{ path: '/projects', priority: 0.9, changefreq: 'monthly' },
	{ path: '/research-items', priority: 0.9, changefreq: 'weekly' },
	{ path: '/publications', priority: 0.85, changefreq: 'weekly' },
	// Directory
	{ path: '/people', priority: 0.8, changefreq: 'monthly' },
	{ path: '/groups', priority: 0.7, changefreq: 'monthly' },
	{ path: '/institutions', priority: 0.8, changefreq: 'monthly' },
	// Categories
	{ path: '/genres', priority: 0.6, changefreq: 'monthly' },
	{ path: '/languages', priority: 0.7, changefreq: 'monthly' },
	{ path: '/locations', priority: 0.7, changefreq: 'monthly' },
	{ path: '/resource-types', priority: 0.6, changefreq: 'monthly' },
	{ path: '/subjects', priority: 0.7, changefreq: 'monthly' },
	{ path: '/collections', priority: 0.6, changefreq: 'monthly' },
	// Visualize
	{ path: '/project-explorer', priority: 0.7, changefreq: 'monthly' },
	// `/compare-projects` is a redirect to `/compare/projects` — drop it
	// from the sitemap so search engines index the canonical URL only.
	{ path: '/compare/projects', priority: 0.7, changefreq: 'monthly' },
	{ path: '/compare/people', priority: 0.6, changefreq: 'monthly' },
	{ path: '/compare/institutions', priority: 0.6, changefreq: 'monthly' },
	{ path: '/compare/subjects', priority: 0.6, changefreq: 'monthly' },
	{ path: '/compare/languages', priority: 0.6, changefreq: 'monthly' },
	{ path: '/compare/genres', priority: 0.6, changefreq: 'monthly' },
	{ path: '/network', priority: 0.7, changefreq: 'monthly' },
	{ path: '/semantic-map', priority: 0.6, changefreq: 'monthly' }
];

/** Maps the entity-dashboard subdirectory name to the route + query-param
 * pair that the front end expects. Keep in lock-step with `urls.ts`. */
interface EntityRoute {
	dir: string;
	route: string;
	param: 'name' | 'id' | 'code' | 'type' | 'genre' | 'section';
	/** When `usesId` is true, take `meta.id` from the JSON; otherwise
	 *  take `meta.name`. Mirrors `personUrl(name)` vs `projectUrl(id)`. */
	usesId?: boolean;
	priority: number;
	/** Optional extra query string fragment (e.g. `&view=subjects`). */
	suffix?: string;
}

const ENTITY_ROUTES: EntityRoute[] = [
	{ dir: 'people', route: '/people', param: 'name', priority: 0.6 },
	{ dir: 'projects', route: '/projects', param: 'id', usesId: true, priority: 0.7 },
	{ dir: 'institutions', route: '/institutions', param: 'name', priority: 0.6 },
	{ dir: 'groups', route: '/groups', param: 'name', priority: 0.5 },
	{ dir: 'genres', route: '/genres', param: 'genre', priority: 0.5 },
	{ dir: 'languages', route: '/languages', param: 'code', priority: 0.5 },
	{ dir: 'locations', route: '/locations', param: 'name', priority: 0.5 },
	{
		dir: 'resource-types',
		route: '/resource-types',
		param: 'type',
		priority: 0.5
	},
	{
		dir: 'research-sections',
		route: '/research-sections',
		param: 'section',
		priority: 0.7
	},
	{
		dir: 'subjects',
		route: '/subjects',
		param: 'name',
		priority: 0.5,
		suffix: '&view=subjects'
	},
	{
		dir: 'tags',
		route: '/subjects',
		param: 'name',
		priority: 0.4,
		suffix: '&view=tags'
	}
];

interface EntityMeta {
	type?: string;
	id?: string;
	name?: string;
}

interface EntityDashboard {
	meta?: EntityMeta;
}

/** Read the precomputed entity-dashboard JSONs and yield one URL per file. */
async function discoverEntityRoutes(): Promise<Route[]> {
	const dataDir = join(process.cwd(), 'static', 'data', 'entity_dashboards');
	const out: Route[] = [];

	for (const entity of ENTITY_ROUTES) {
		const dir = join(dataDir, entity.dir);
		let entries: string[];
		try {
			entries = await fs.readdir(dir);
		} catch {
			continue; // directory not present yet — fine, skip silently
		}

		for (const entry of entries) {
			if (!entry.endsWith('.json')) continue;
			if (entry === 'manifest.json' || entry === '_manifest.json') continue;
			let payload: EntityDashboard;
			try {
				const raw = await fs.readFile(join(dir, entry), 'utf-8');
				payload = JSON.parse(raw) as EntityDashboard;
			} catch {
				continue;
			}
			const meta = payload.meta;
			if (!meta) continue;
			const value = entity.usesId ? meta.id : meta.name;
			if (!value) continue;
			const suffix = entity.suffix ?? '';
			out.push({
				path: `${entity.route}?${entity.param}=${encodeURIComponent(value)}${suffix}`,
				priority: entity.priority,
				changefreq: 'monthly'
			});
		}
	}

	return out;
}

/**
 * XML-escape the five characters the sitemap protocol forbids inside a
 * `<loc>` value. Crucially, `&` in query strings (e.g.
 * `?name=foo&view=subjects`) MUST be encoded as `&amp;` — Google Search
 * Console rejects the whole sitemap with "could not read sitemap" the
 * moment it hits a raw ampersand. See
 * https://www.sitemaps.org/protocol.html#escaping
 */
function xmlEscape(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/'/g, '&apos;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

export const GET: RequestHandler = async () => {
	const lastmod = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

	const entityRoutes = await discoverEntityRoutes();
	const allRoutes = [...STATIC_ROUTES, ...entityRoutes];

	const urls = allRoutes
		.map(
			(r) => `  <url>
    <loc>${xmlEscape(`${SITE}${r.path}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority.toFixed(1)}</priority>
  </url>`
		)
		.join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
