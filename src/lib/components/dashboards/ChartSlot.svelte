<script lang="ts">
	/**
	 * Dispatches a ChartKey + data payload to the correct renderer component.
	 *
	 * Every chart is wrapped in <ChartCard> so download button + title handling
	 * is uniform. Chart keys without a renderer yet render a labelled stub so
	 * pages using the layout system don't break while Phase 4 fills in the gaps.
	 *
	 * Data payloads are intentionally typed as `unknown` at the slot boundary
	 * and narrowed per-case. The per-chart shapes are documented in
	 * `references/visualization-patterns.md` (wisski-mongodb skill).
	 */
	import ChartCard from '$lib/components/ui/chart-card.svelte';
	import {
		Timeline,
		StackedTimeline,
		BarChart,
		PieChart,
		WordCloud,
		HeatmapChart,
		ChordDiagram,
		SankeyChart,
		SunburstChart,
		LocationsMapView,
		ChoroplethMap,
		MiniMap,
		EntityKnowledgeGraph,
		StackedAreaChart,
		TreemapChart,
		CalendarHeatmap,
		BoxPlot,
		RadarChart,
		TimeAwareChord,
		GeoFlowMap,
		ContributorNetwork
	} from '$lib/components/charts';
	import { CHART_METADATA, type ChartSlot } from './entityDashboardLayouts';
	import type {
		TimelineDataPoint,
		BarChartDataPoint,
		PieChartDataPoint,
		WordCloudDataPoint,
		HeatmapDataPoint,
		ChordData,
		CollectionItem,
		EnrichedLocationsData,
		StackedAreaDataPoint,
		CalendarDataPoint,
		BoxPlotGroup,
		RadarIndicator,
		RadarSeriesItem
	} from '$lib/types';
	import type { StackedTimelineDataPoint } from '$lib/utils/transforms/grouping';
	import type { LocationData } from '$lib/components/charts/map/markerBuilder';
	import type { ChoroplethDataPoint } from '$lib/components/charts/ChoroplethMap.svelte';
	import type { TimeAwareChordData } from '$lib/components/charts/TimeAwareChord.svelte';
	import type { GeoFlowMapData } from '$lib/components/charts/GeoFlowMap.svelte';
	import type { ContributorNetworkData } from '$lib/components/charts/ContributorNetwork.svelte';

	interface SankeyPayload {
		nodes: { name: string }[];
		links: { source: string; target: string; value: number }[];
	}

	interface SunburstPayload {
		name: string;
		value?: number;
		children?: SunburstPayload[];
	}

	type TreemapPayload = SunburstPayload;

	interface RadarPayload {
		indicator: RadarIndicator[];
		series: RadarSeriesItem[];
	}

	interface MiniMapMarker {
		latitude: number;
		longitude: number;
		label?: string;
		color?: string;
	}

	interface KGPayload {
		entityType: string;
		entityId: string;
	}

	interface Props {
		slot: ChartSlot;
		data: unknown;
		enrichedLocations?: EnrichedLocationsData | null;
		/** Entity-scoped items; LocationMap uses these to populate clickable
		 * document lists inside cluster popups. */
		items?: CollectionItem[];
	}

	let { slot, data, enrichedLocations = null, items = [] }: Props = $props();

	let metadata = $derived(CHART_METADATA[slot.chart]);
	let title = $derived(slot.title ?? metadata.label);
	let subtitle = $derived(slot.description ?? metadata.description);

	// Chart-height selection. Height tokens (see src/lib/styles/tokens.css):
	//   md = 350px, lg = 400px, xl = 500px, 2xl = 600px.
	// Maps need extra room for the internal ~550px canvas + the legend strip
	// below it — clipping the legend was issue #10's original heatmap/map
	// regression. Other `tall` slots get xl (500px) which fits word clouds,
	// chord diagrams, and network previews without wasted vertical space.
	const MAP_CHARTS = new Set(['locations', 'selfLocation', 'geoFlows', 'choropleth']);
	const NETWORK_CHARTS = new Set([
		'contributorNetwork',
		'affiliationNetwork',
		'collabNetwork',
		'coContributors'
	]);
	let contentHeight = $derived(
		MAP_CHARTS.has(slot.chart)
			? 'h-chart-2xl'
			: NETWORK_CHARTS.has(slot.chart)
				? 'h-chart-2xl'
				: slot.tall
					? 'h-chart-xl'
					: 'h-chart-md'
	);
</script>

<ChartCard {title} {subtitle} {contentHeight} class="entity-dashboard-slot">
	{#if slot.chart === 'timeline'}
		<Timeline data={data as TimelineDataPoint[]} class="h-full w-full" />
	{:else if slot.chart === 'stackedTimeline'}
		<StackedTimeline data={data as StackedTimelineDataPoint[]} class="h-full w-full" />
	{:else if slot.chart === 'types' || slot.chart === 'roles'}
		<PieChart data={data as PieChartDataPoint[]} class="h-full w-full" />
	{:else if slot.chart === 'languages' || slot.chart === 'subjects' || slot.chart === 'contributors'}
		<BarChart data={data as BarChartDataPoint[]} class="h-full w-full" />
	{:else if slot.chart === 'wordCloud'}
		<WordCloud data={data as WordCloudDataPoint[]} class="h-full w-full" />
	{:else if slot.chart === 'heatmap'}
		<HeatmapChart data={data as HeatmapDataPoint[]} class="h-full w-full" />
	{:else if slot.chart === 'chord' || slot.chart === 'coSubjects' || slot.chart === 'coContributors'}
		<ChordDiagram data={data as ChordData} class="h-full w-full" />
	{:else if slot.chart === 'timeAwareChord'}
		<TimeAwareChord data={data as TimeAwareChordData} class="h-full w-full" />
	{:else if slot.chart === 'sankey'}
		{@const s = data as SankeyPayload}
		<SankeyChart nodes={s.nodes} links={s.links} class="h-full w-full" />
	{:else if slot.chart === 'sunburst'}
		<SunburstChart data={data as SunburstPayload[]} class="h-full w-full" />
	{:else if slot.chart === 'treemap'}
		<TreemapChart data={data as TreemapPayload[]} class="h-full w-full" />
	{:else if slot.chart === 'subjectTrends' || slot.chart === 'languageTimeline'}
		<StackedAreaChart data={data as StackedAreaDataPoint[]} class="h-full w-full" />
	{:else if slot.chart === 'calendarHeatmap'}
		<CalendarHeatmap data={data as CalendarDataPoint[]} class="h-full w-full" />
	{:else if slot.chart === 'boxPlot'}
		<BoxPlot data={data as BoxPlotGroup[]} class="h-full w-full" />
	{:else if slot.chart === 'radar'}
		{@const r = data as RadarPayload}
		<RadarChart indicator={r.indicator} series={r.series} class="h-full w-full" />
	{:else if slot.chart === 'locations'}
		<LocationsMapView
			data={data as LocationData[]}
			{items}
			{enrichedLocations}
			class="h-full w-full"
		/>
	{:else if slot.chart === 'choropleth'}
		<ChoroplethMap data={data as ChoroplethDataPoint[]} class="h-full w-full" />
	{:else if slot.chart === 'geoFlows'}
		<GeoFlowMap data={data as GeoFlowMapData} class="h-full w-full" />
	{:else if slot.chart === 'contributorNetwork' || slot.chart === 'affiliationNetwork' || slot.chart === 'collabNetwork'}
		<ContributorNetwork data={data as ContributorNetworkData} class="h-full w-full" />
	{:else if slot.chart === 'selfLocation'}
		<MiniMap markers={data as MiniMapMarker[]} class="h-full w-full" />
	{:else if slot.chart === 'knowledgeGraph'}
		{@const kg = data as KGPayload}
		<EntityKnowledgeGraph entityType={kg.entityType} entityId={kg.entityId} />
	{:else}
		<div class="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
			Unhandled chart key: <code>{slot.chart}</code>
		</div>
	{/if}
</ChartCard>
