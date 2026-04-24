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
 *   5. Adding it to the relevant `ENTITY_LAYOUTS` entries
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
	| 'coAuthors' // chord / graph of person ↔ person
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
	coAuthors: { label: 'Co-authors' },
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

/**
 * Per-entity-type layouts. Populated incrementally during Phase 2; each entity
 * type's first landing is tracked as its own issue under #10.
 *
 * Ordering convention (lifted from the Omeka module):
 *   1. Timelines (wide)
 *   2. Paired categorical pies / bars
 *   3. Cross-tabs / heatmaps / hierarchical
 *   4. Networks
 *   5. Geography
 *   6. Knowledge graph (last, tall)
 */
export const ENTITY_LAYOUTS: Partial<Record<EntityType, EntityLayout>> = {
	language: {
		entity: 'language',
		showUniversityFilter: false,
		charts: [
			{ chart: 'timeline', wide: true },
			{ chart: 'stackedTimeline', wide: true },
			{ chart: 'types' },
			{ chart: 'languages', title: 'Co-occurring languages' },
			{ chart: 'heatmap', wide: true, title: 'Resource type × decade' },
			{ chart: 'subjects' },
			{ chart: 'wordCloud', tall: true },
			{ chart: 'contributors' },
			{ chart: 'subjectTrends', wide: true },
			{ chart: 'locations', wide: true, tall: true }
		]
	},
	subject: {
		entity: 'subject',
		showUniversityFilter: false,
		charts: [
			{ chart: 'timeline', wide: true },
			{ chart: 'stackedTimeline', wide: true },
			{ chart: 'types' },
			{ chart: 'languages' },
			{ chart: 'subjects', title: 'Co-occurring subjects' },
			{ chart: 'wordCloud', tall: true, title: 'Related subjects & tags' },
			{ chart: 'contributors' },
			{ chart: 'locations', wide: true, tall: true }
		]
	},
	tag: {
		entity: 'tag',
		showUniversityFilter: false,
		charts: [
			{ chart: 'timeline', wide: true },
			{ chart: 'stackedTimeline', wide: true },
			{ chart: 'types' },
			{ chart: 'languages' },
			{ chart: 'subjects', title: 'Subject headings on tagged items' },
			{ chart: 'wordCloud', tall: true, title: 'Related subjects & tags' },
			{ chart: 'contributors' },
			{ chart: 'locations', wide: true, tall: true }
		]
	},
	genre: {
		entity: 'genre',
		showUniversityFilter: false,
		charts: [
			{ chart: 'timeline', wide: true },
			{ chart: 'stackedTimeline', wide: true },
			{ chart: 'types' },
			{ chart: 'languages' },
			{ chart: 'subjects' },
			{ chart: 'wordCloud', tall: true },
			{ chart: 'contributors' },
			{ chart: 'locations', wide: true, tall: true }
		]
	},
	'resource-type': {
		entity: 'resource-type',
		showUniversityFilter: false,
		charts: [
			{ chart: 'timeline', wide: true },
			{ chart: 'stackedTimeline', wide: true },
			{ chart: 'languages' },
			{ chart: 'heatmap', wide: true, title: 'Language × decade' },
			{ chart: 'subjects' },
			{ chart: 'wordCloud', tall: true },
			{ chart: 'contributors' },
			{ chart: 'locations', wide: true, tall: true }
		]
	},
	group: {
		entity: 'group',
		showUniversityFilter: true,
		charts: [
			{ chart: 'timeline', wide: true },
			{ chart: 'types' },
			{ chart: 'languages' },
			{ chart: 'subjects' },
			{ chart: 'contributors', title: 'Members & collaborators' },
			{ chart: 'locations', wide: true, tall: true }
		]
	},
	person: {
		entity: 'person',
		showUniversityFilter: true,
		charts: [
			{ chart: 'timeline', wide: true },
			{ chart: 'stackedTimeline', wide: true },
			{ chart: 'types' },
			{ chart: 'languages' },
			{ chart: 'roles' },
			{ chart: 'subjects' },
			{ chart: 'wordCloud', tall: true },
			{ chart: 'contributors', title: 'Co-contributors' },
			{ chart: 'locations', wide: true, tall: true }
		]
	},
	institution: {
		entity: 'institution',
		showUniversityFilter: true,
		charts: [
			{ chart: 'timeline', wide: true },
			{ chart: 'stackedTimeline', wide: true },
			{ chart: 'types' },
			{ chart: 'languages' },
			{ chart: 'subjects' },
			{ chart: 'wordCloud', tall: true },
			{ chart: 'contributors', title: 'Affiliated contributors' },
			{ chart: 'locations', wide: true, tall: true }
		]
	},
	location: {
		entity: 'location',
		showUniversityFilter: false,
		charts: [
			{ chart: 'timeline', wide: true },
			{ chart: 'stackedTimeline', wide: true },
			{ chart: 'types' },
			{ chart: 'languages' },
			{ chart: 'subjects' },
			{ chart: 'wordCloud', tall: true },
			{ chart: 'contributors' }
		]
	},
	'research-section': {
		entity: 'research-section',
		showUniversityFilter: true,
		charts: [
			{ chart: 'timeline', wide: true },
			{ chart: 'stackedTimeline', wide: true },
			{ chart: 'types' },
			{ chart: 'languages' },
			{ chart: 'heatmap', wide: true, title: 'Resource type × decade' },
			{ chart: 'subjects' },
			{ chart: 'wordCloud', tall: true },
			{ chart: 'contributors' },
			{ chart: 'locations', wide: true, tall: true }
		]
	}
	// Remaining Phase 2 layouts (project full parity, research-item KG +
	// context strip) land as separate follow-ups — see ROADMAP-parity.md.
};

/** Whether to offer the university filter on this entity's detail page. */
export function showsUniversityFilter(entity: EntityType): boolean {
	return ENTITY_LAYOUTS[entity]?.showUniversityFilter ?? false;
}

/** Convenience lookup, returns `undefined` for entity types not yet wired. */
export function getEntityLayout(entity: EntityType): EntityLayout | undefined {
	return ENTITY_LAYOUTS[entity];
}

/**
 * Chart keys that don't have a renderer yet. Keep in sync with the
 * dispatch in `ChartSlot.svelte`. Slots with these keys are filtered out
 * upstream by `shouldRenderSlot` so the grid stays clean.
 */
export const NOT_YET_IMPLEMENTED: ReadonlySet<ChartKey> = new Set<ChartKey>([
	'treemap',
	'geoFlows',
	'choropleth',
	'calendarHeatmap',
	'radar',
	'timeAwareChord',
	'boxPlot',
	'subjectTrends',
	'languageTimeline',
	'contributorNetwork',
	'affiliationNetwork',
	'collabNetwork',
	'coAuthors',
	'coSubjects',
	'similarItems'
]);

/**
 * Decide whether a slot should appear on the grid for the given data.
 *
 * We hide slots for chart keys without a renderer yet, and slots whose data
 * payload is empty or missing — no "No data available" placeholders. Slots
 * with a truthy `cond` that evaluates to false are also hidden.
 */
export function shouldRenderSlot(slot: ChartSlot, data: EntityDashboardData): boolean {
	if (NOT_YET_IMPLEMENTED.has(slot.chart)) return false;
	if (slot.cond && !slot.cond(data)) return false;
	const payload = data[slot.chart];
	if (payload == null) return false;
	if (Array.isArray(payload)) return payload.length > 0;
	if (typeof payload === 'object') return Object.keys(payload as object).length > 0;
	return true;
}
