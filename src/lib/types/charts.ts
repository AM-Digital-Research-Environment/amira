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

// Dashboard stats
export interface DashboardStats {
	totalProjects: number;
	totalPersons: number;
	totalDocuments: number;
	totalInstitutions: number;
	collectionCounts: Record<string, number>;
}
