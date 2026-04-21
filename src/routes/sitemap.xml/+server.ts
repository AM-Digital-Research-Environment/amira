import type { RequestHandler } from './$types';

/**
 * Build-time generated sitemap. Because the dashboard ships as a static site
 * (adapter-static), SvelteKit pre-renders this endpoint to
 * `build/sitemap.xml` at `npm run build` time, which means the `lastmod`
 * field always reflects the build date -- no manual upkeep required.
 *
 * If you add a new top-level route, add it to `ROUTES` below. Dynamic detail
 * pages (research-items/[id], people?name=..., etc.) are driven by query
 * params off the list routes, so we only list the list routes here; search
 * engines pick up the detail records via the in-page links.
 */

export const prerender = true;

const SITE = 'https://am-digital-research-environment.github.io/WissKI-dashboard';

interface Route {
	path: string;
	priority: number;
	changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

// Keep in the same conceptual order as the sidebar so it's easy to spot a
// missing route during a review.
const ROUTES: Route[] = [
	// Dashboard
	{ path: '/', priority: 1.0, changefreq: 'weekly' },
	{ path: '/whats-new', priority: 0.8, changefreq: 'weekly' },
	// Research
	{ path: '/research-sections', priority: 0.9, changefreq: 'monthly' },
	{ path: '/projects', priority: 0.9, changefreq: 'monthly' },
	{ path: '/research-items', priority: 0.9, changefreq: 'weekly' },
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
	// Visualize
	{ path: '/project-explorer', priority: 0.7, changefreq: 'monthly' },
	{ path: '/compare-projects', priority: 0.6, changefreq: 'monthly' },
	{ path: '/network', priority: 0.7, changefreq: 'monthly' }
];

export const GET: RequestHandler = async () => {
	const lastmod = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

	const urls = ROUTES.map(
		(r) => `  <url>
    <loc>${SITE}${r.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority.toFixed(1)}</priority>
  </url>`
	).join('\n');

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
