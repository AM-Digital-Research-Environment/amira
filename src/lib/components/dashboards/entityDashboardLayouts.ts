/**
 * EntityDashboard layout system
 *
 * Mirrors the Omeka S `ResourceVisualizations` module's `dashboard-layouts.js`:
 * each entity type declares an ordered list of ChartSlots, and detail pages
 * hand that layout + precomputed data to `<EntityDashboard>` for rendering.
 *
 * Add a new chart type by:
 *   1. Adding it to `ChartKey`
 *   2. Adding a default label/description to `CHART_METADATA`
 *   3. Wiring the renderer in `ChartSlot.svelte`
 *   4. Adding a `build_<key>()` aggregator in `scripts/precompute/aggregators.py`
 *   5. Adding it to the relevant entity layout under `./layouts/`
 *
 * Per-entity layouts live in `./layouts/`. This file owns the type system,
 * the chart-key metadata registry, and the empty-payload helpers that
 * `<EntityDashboard>` consumes via `shouldRenderSlot`.
 */

/** The union of every chart renderer the dashboard system knows about. */
export type ChartKey =
	// --- time series ---
	| 'timeline' // bar-per-year
	| 'stackedTimeline' // bar-per-year stacked by resource type
	| 'languageTimeline' // stacked area by language over years
	| 'subjectTrends' // stacked area / bump of top subjects over years
	| 'calendarHeatmap' // year×month activity intensity (new — Phase 4)
	// --- categorical ---
	| 'types' // resource types pie
	| 'languages' // languages bar / pie (co-occurring on per-entity pages)
	| 'subjects' // top subjects bar
	| 'wordCloud' // subjects & tags cloud
	| 'contributors' // top contributors bar
	| 'roles' // MARC relator roles pie
	// --- relational / hierarchical ---
	| 'heatmap' // 2-axis cross-tab (e.g. resource type × year)
	| 'chord' // generic co-occurrence chord
	| 'coContributors' // chord of persons co-credited on the same item (any role)
	| 'coSubjects' // chord / graph of subject ↔ subject
	| 'sankey' // contributor → project → resource type
	| 'sunburst' // type → language → subject hierarchy
	| 'treemap' // project × type proportional areas (new — Phase 4)
	| 'timeAwareChord' // chord with time slider (new — Phase 4)
	| 'boxPlot' // items-per-X distribution (new — Phase 4)
	// --- geography ---
	| 'locations' // points map of origins
	| 'selfLocation' // single-entity map (used by /locations/[name])
	| 'geoFlows' // arcs origin → current
	| 'choropleth' // country-level fill map (new — Phase 4)
	// --- networks ---
	| 'contributorNetwork' // person ↔ project bipartite
	| 'affiliationNetwork' // person ↔ institution bipartite
	| 'collabNetwork' // institution ↔ institution
	// --- entity-specific ---
	| 'knowledgeGraph' // ego-network
	| 'radar' // 5–7 axis profile (new — Phase 4)
	| 'similarItems'; // thumbnail strip via embeddings kNN

/** Entity types that have a detail-page dashboard. */
export type EntityType =
	| 'language'
	| 'subject'
	| 'tag'
	| 'person'
	| 'institution'
	| 'genre'
	| 'resource-type'
	| 'group'
	| 'location'
	| 'research-section'
	| 'project'
	| 'research-item';

/** One chart + its placement within the grid. */
export interface ChartSlot {
	chart: ChartKey;
	/** Override the default title from CHART_METADATA. */
	title?: string;
	/** Override the default subtitle / description. */
	description?: string;
	/** Span both grid columns. */
	wide?: boolean;
	/** Use the "tall" chart height (better for maps, graphs, word clouds). */
	tall?: boolean;
	/** Conditionally render based on the loaded dashboard data. */
	cond?: (data: EntityDashboardData) => boolean;
}

/** Ordered layout for a specific entity type. */
export interface EntityLayout {
	entity: EntityType;
	charts: ChartSlot[];
	/** Whether to show the UBT/ULG/UJKZ/UFB filter chip on this page. */
	showUniversityFilter: boolean;
}

/**
 * Canonical per-entity dashboard JSON shape. Each chart slot expects a value
 * under its `ChartKey` name — shapes are pragmatically typed as `unknown` here
 * because every chart renderer enforces its own shape inside `ChartSlot.svelte`.
 */
export interface EntityDashboardData {
	meta: {
		type: EntityType;
		id: string;
		name: string;
		count: number;
	};
	/** Chart-key → chart-specific data payload. */
	[key: string]: unknown;
}

/** Human-facing labels + descriptions for each chart key. */
export const CHART_METADATA: Record<ChartKey, { label: string; description?: string }> = {
	timeline: { label: 'Timeline', description: 'Items per year' },
	stackedTimeline: { label: 'Items by year and resource type' },
	languageTimeline: { label: 'Language distribution over time' },
	subjectTrends: { label: 'Subject trends', description: 'Top subjects over time' },
	calendarHeatmap: { label: 'Activity calendar', description: 'Items created by month' },
	types: { label: 'Resource types' },
	languages: { label: 'Languages' },
	subjects: { label: 'Top subjects' },
	wordCloud: { label: 'Subjects & tags' },
	contributors: { label: 'Top contributors' },
	roles: { label: 'Contributor roles', description: 'MARC relator distribution' },
	heatmap: { label: 'Cross-tab heatmap' },
	chord: { label: 'Co-occurrence' },
	coContributors: {
		label: 'Co-credited persons',
		description: 'People who appear together on the same item, across all MARC roles'
	},
	coSubjects: { label: 'Co-occurring subjects' },
	sankey: { label: 'Contributor → project → type' },
	sunburst: { label: 'Type → language → subject' },
	treemap: { label: 'Proportional areas' },
	timeAwareChord: { label: 'Co-occurrence over time' },
	boxPlot: { label: 'Distribution' },
	locations: { label: 'Geographic origins' },
	selfLocation: { label: 'Location map' },
	geoFlows: { label: 'Origin → current location' },
	choropleth: { label: 'Geographic distribution' },
	contributorNetwork: { label: 'Contributor network' },
	affiliationNetwork: { label: 'Affiliation network' },
	collabNetwork: { label: 'Collaboration network' },
	knowledgeGraph: { label: 'Knowledge graph' },
	radar: { label: 'Entity profile' },
	similarItems: { label: 'Similar items' }
};

// `ENTITY_LAYOUTS` is built from per-entity files under `./layouts/`. We
// re-export the registry here so existing imports keep working.
export { ENTITY_LAYOUTS } from './layouts';

// Type-only `EntityLayout` re-import so the helper functions below resolve
// to the same registry the layout files target.
import { ENTITY_LAYOUTS as _LAYOUTS } from './layouts';

/** Whether to offer the university filter on this entity's detail page. */
export function showsUniversityFilter(entity: EntityType): boolean {
	return _LAYOUTS[entity]?.showUniversityFilter ?? false;
}

/** Convenience lookup, returns `undefined` for entity types not yet wired. */
export function getEntityLayout(entity: EntityType): EntityLayout | undefined {
	return _LAYOUTS[entity];
}

/**
 * Chart keys that don't have a renderer yet. Keep in sync with the
 * dispatch in `ChartSlot.svelte`. Slots with these keys are filtered out
 * upstream by `shouldRenderSlot` so the grid stays clean.
 */
export const NOT_YET_IMPLEMENTED: ReadonlySet<ChartKey> = new Set<ChartKey>([
	// Renderers exist for the remaining keys (geoFlows, timeAwareChord,
	// contributor/affiliation/collab networks, co-authors, co-subjects), but
	// they only render when the corresponding entity dashboard JSON includes
	// the matching payload. `shouldRenderSlot` already hides slots whose data
	// is missing, so we don't need to gate them here. Keep `similarItems`
	// gated — it's surfaced via a bespoke component on /research-items.
	'similarItems'
]);

/** Network chart payloads share the same `{ persons, targets, edges }`
 * shape — they're considered empty when EITHER side of the bipartite graph
 * is missing nodes, not when the wrapper object happens to have a `targetLabel`
 * key. Without this guard the dashboard renders a card whose body just says
 * "No contributor relationships available." */
function isEmptyNetworkPayload(payload: object): boolean {
	const p = payload as { persons?: unknown[]; targets?: unknown[]; edges?: unknown[] };
	const personsCount = Array.isArray(p.persons) ? p.persons.length : -1;
	const targetsCount = Array.isArray(p.targets) ? p.targets.length : -1;
	if (personsCount === -1 && targetsCount === -1) return false; // not a network payload
	return personsCount === 0 || targetsCount === 0;
}

/** Sankey + similar `{ nodes, links }` payloads are considered empty when
 * either side is missing. */
function isEmptyGraphPayload(payload: object): boolean {
	const p = payload as { nodes?: unknown[]; links?: unknown[] };
	if (!Array.isArray(p.nodes) && !Array.isArray(p.links)) return false;
	const nodesCount = Array.isArray(p.nodes) ? p.nodes.length : 0;
	const linksCount = Array.isArray(p.links) ? p.links.length : 0;
	return nodesCount === 0 || linksCount === 0;
}

/** Chord payloads are `{ matrix, names }` — empty when no nodes. */
function isEmptyChordPayload(payload: object): boolean {
	const p = payload as { matrix?: unknown[]; names?: unknown[] };
	if (!Array.isArray(p.matrix) && !Array.isArray(p.names)) return false;
	const matrixCount = Array.isArray(p.matrix) ? p.matrix.length : 0;
	const namesCount = Array.isArray(p.names) ? p.names.length : 0;
	return matrixCount === 0 || namesCount === 0;
}

/** GeoFlows payload is `{ flows: GeoFlow[] }` — empty when there are no
 * origin→current flows to draw. Without this guard the slot renders an
 * empty world map captioned "0 flows · 0 items". */
function isEmptyGeoFlowsPayload(payload: object): boolean {
	const p = payload as { flows?: unknown[] };
	if (!Array.isArray(p.flows)) return false;
	return p.flows.length === 0;
}

/**
 * Decide whether a slot should appear on the grid for the given data.
 *
 * We hide slots for chart keys without a renderer yet, and slots whose data
 * payload is empty or missing — no "No data available" placeholders. Slots
 * with a truthy `cond` that evaluates to false are also hidden.
 *
 * Network-shaped payloads (`contributorNetwork`, `affiliationNetwork`,
 * `collabNetwork`, sankey, chord) need shape-aware emptiness checks since
 * their wrapper object always carries a few keys (e.g. `targetLabel`,
 * `names`) even when the underlying graph has no edges.
 */
export function shouldRenderSlot(slot: ChartSlot, data: EntityDashboardData): boolean {
	if (NOT_YET_IMPLEMENTED.has(slot.chart)) return false;
	if (slot.cond && !slot.cond(data)) return false;
	const payload = data[slot.chart];
	if (payload == null) return false;
	if (Array.isArray(payload)) return payload.length > 0;
	if (typeof payload === 'object') {
		if (Object.keys(payload as object).length === 0) return false;
		if (isEmptyNetworkPayload(payload as object)) return false;
		if (isEmptyGraphPayload(payload as object)) return false;
		if (isEmptyChordPayload(payload as object)) return false;
		if (isEmptyGeoFlowsPayload(payload as object)) return false;
		return true;
	}
	return true;
}
