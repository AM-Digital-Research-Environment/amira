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
}

export interface NetworkLink {
	source: string;
	target: string;
	value?: number;
}

export interface NetworkData {
	nodes: NetworkNode[];
	links: NetworkLink[];
	categories: { name: string }[];
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

// Dashboard stats
export interface DashboardStats {
	totalProjects: number;
	totalPersons: number;
	totalDocuments: number;
	totalInstitutions: number;
	collectionCounts: Record<string, number>;
}
