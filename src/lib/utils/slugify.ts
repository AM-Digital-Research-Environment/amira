/**
 * URL-safe slug generator for filename-based lookups.
 *
 * Mirror of `scripts/precompute/aggregators.py::slugify` — keep the two
 * implementations in sync so precomputed JSON under
 * `static/data/entity_dashboards/` and `static/data/knowledge_graphs/` matches
 * whatever the runtime computes from a display name.
 *
 * Rules:
 *   1. lowercase
 *   2. `/` and `\` become `-` (so `HIV/AIDS` → `hiv-aids`)
 *   3. any run of non-alphanumerics collapses to a single `-`
 *   4. leading/trailing `-` are stripped
 *   5. the result is truncated to 120 chars
 */
export function slugify(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[\\/]/g, '-')
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 120);
}
