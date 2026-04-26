// Chart data types

import type { CollectionItem } from './collection';

export interface TimelineDataPoint {
	year: number;
	count: number;
	items?: CollectionItem[];
}

export interface BarChartDataPoint {
	name: string;
	value: number;
}

export interface PieChartDataPoint {
	name: string;
	value: number;
}

export interface WordCloudDataPoint {
	name: string;
	value: number;
}

export interface NetworkNode {
	id: string;
	name: string;
	category: number;
	symbolSize: number;
	/** Community / discursive-mode id (Louvain). -1 if no cluster. */
	cluster?: number;
	/** Global PageRank, normalised to [0, 1]. Higher = more central. */
	importance?: number;
}

export interface NetworkLink {
	source: string;
	target: string;
	/** Edge weight (IDF-derived for direct edges, similarity-derived for latent). */
	value?: number;
	/** Human-readable label ("contributor", "shares neighbourhood (42%)", ...). */
	label?: string;
	/**
	 * "direct" = observed metadata triple (contributor/tagged/...).
	 * "latent" = derived from shared neighbourhood / personalised PageRank.
	 */
	relation?: 'direct' | 'latent';
}

export interface NetworkCluster {
	id: number;
	label: string;
	count: number;
}

export interface NetworkData {
	nodes: NetworkNode[];
	links: NetworkLink[];
	categories: { name: string }[];
	/** Communities represented in this ego graph (Louvain). Optional. */
	clusters?: NetworkCluster[];
	/** Node id of the ego centre, if this is an ego graph. */
	center?: string;
}

export interface ChordData {
	names: string[];
	matrix: number[][];
}

export interface HeatmapDataPoint {
	x: string;
	y: string;
	value: number;
}

export interface BeeswarmDataPoint {
	/** Category label (y-axis) */
	category: string;
	/** Numeric value (x-axis, e.g. year) */
	value: number;
	/** Display label for tooltip */
	label: string;
	/** Optional size dimension */
	size?: number;
}

export interface GanttDataPoint {
	/** Display name (y-axis label) */
	name: string;
	/** Start value (e.g. timestamp or year) */
	start: number;
	/** End value */
	end: number;
	/** Category for color grouping */
	category?: string;
	/** Extra tooltip info */
	tooltip?: string;
}

/** Stacked area / line over time. Used for `subjectTrends` and `languageTimeline`. */
export interface StackedAreaDataPoint {
	year: number;
	byCategory: Record<string, number>;
}

/** Calendar heatmap (one cell per ISO date). */
export interface CalendarDataPoint {
	date: string;
	value: number;
}

/** Box-and-whisker group: callers pass raw observations, the chart computes the
 * five-number summary internally. */
export interface BoxPlotGroup {
	name: string;
	values: number[];
}

/** Radar profile axis. */
export interface RadarIndicator {
	name: string;
	max: number;
}

/** A single line on the radar (one entity / one comparison subject). */
export interface RadarSeriesItem {
	name: string;
	values: number[];
}

// Dashboard stats
export interface DashboardStats {
	totalProjects: number;
	totalPersons: number;
	totalDocuments: number;
	totalInstitutions: number;
	collectionCounts: Record<string, number>;
}
