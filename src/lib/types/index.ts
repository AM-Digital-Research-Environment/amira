// MongoDB extended JSON types
export interface MongoOid {
	$oid: string;
}

export interface MongoDate {
	$date: string;
}

export interface MongoNaN {
	$numberDouble: 'NaN';
}

// Utility type for values that might be NaN in MongoDB export
export type MaybeNaN<T> = T | MongoNaN | null;

// Core data types
export interface Person {
	_id: string;
	name: string;
	affiliation: string[];
}

export interface Institution {
	_id: string;
	name: string;
}

export interface Group {
	_id: string;
	name: string;
}

export interface ProjectDate {
	start: Date | null;
	end: Date | null;
}

export interface RDSpaceRef {
	uuid: string | null;
	handle: string | null;
}

export interface RDSpace {
	collection: RDSpaceRef;
	projectSub: RDSpaceRef;
}

export interface Project {
	_id: string;
	idShort: string;
	id: string;
	locale: string;
	localeCode: number;
	researchSection: string[];
	name: string;
	pi: string[];
	members: string[] | null;
	emails: string[] | null;
	description: string | null;
	date: ProjectDate;
	rdspace: RDSpace;
	createdAt: Date | null;
	updatedAt: string;
	updatedBy: string;
	institutions: string[];
}

// Collection item types (UBT metadata schema)
export interface TitleInfo {
	title: string;
	title_type: string;
}

export interface DateInfo {
	issue?: {
		start?: Date | null;
		end?: Date | null;
	};
	creation?: {
		start?: Date | null;
		end?: Date | null;
	};
}

export interface NameEntry {
	name: {
		label: string;
		qualifier: string;
	};
	affl: string[];
	role: string;
}

export interface Subject {
	uri: string;
	authority: string;
	origLabel: string;
	authLabel: string;
}

export interface Identifier {
	identifier: string;
	identifier_type: string;
}

export interface LocationOrigin {
	l1: string; // Country
	l2: string; // Region/State
	l3: string; // City
}

export interface Location {
	origin: LocationOrigin[];
	current: string[];
}

export interface AccessCondition {
	rights: string[];
	usage: {
		type: string;
		admins: string[];
	};
}

export interface Genre {
	marc: string[];
}

export interface PhysicalDescription {
	type: string;
	method: string | null;
	desc: string[];
	tech: string[];
	note: string[];
}

export interface CollectionProject {
	id: string;
	name: string;
}

export interface CollectionItem {
	_id: string;
	dre_id: string;
	bitstream: string;
	security: string;
	collection: string[];
	sponsor: string[];
	project: CollectionProject;
	citation: string[];
	url: string[];
	titleInfo: TitleInfo[];
	dateInfo: DateInfo;
	name: NameEntry[];
	note: string;
	subject: Subject[];
	relatedItems: Record<string, unknown>;
	identifier: Identifier[];
	location: Location;
	accessCondition: AccessCondition;
	typeOfResource: string;
	genre: Genre;
	language: string[];
	physicalDescription: PhysicalDescription;
	abstract: string | null;
	tableOfContents: string | null;
	targetAudience: string[];
	tags: string[];
	updatedBy: string;
	university?: string; // University ID that this item belongs to
}

// Chart data types
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

// University type
export interface University {
	id: string;
	name: string;
	code: string;
	folder: string;
	logo: string;
}

// Universities constant
export const universities: University[] = [
	{ id: 'unilag', name: 'University of Lagos', code: 'ULG', folder: 'projects_metadata_unilag', logo: 'logos/ULG.png' },
	{ id: 'ujkz', name: 'Universite Joseph Ki-Zerbo', code: 'UJKZ', folder: 'projects_metadata_ujkz', logo: 'logos/UJKZ.png' },
	{ id: 'ubt', name: 'University of Bayreuth', code: 'UBT', folder: 'projects_metadata_ubt', logo: 'logos/UBT.png' },
	{ id: 'ufba', name: 'Federal University of Bahia', code: 'UFB', folder: 'projects_metadata_ufba', logo: 'logos/UFBA.png' }
];

// Shared dropdown options for university selectors
export const universityOptions = [
	{ value: 'all', label: 'All Universities' },
	...universities.map((uni) => ({ value: uni.id, label: `${uni.code} - ${uni.name}` }))
];

// Filter state
export interface FilterState {
	dateRange: {
		start: Date | null;
		end: Date | null;
	};
	universities: string[];
	resourceTypes: string[];
	locations: string[];
	languages: string[];
	subjects: string[];
	projects: string[];
}

// Enriched location data from Wikidata reconciliation
export interface WikidataLocation {
	original_name: string;
	wikidata_id: string | null;
	wikidata_label: string | null;
	latitude: number | null;
	longitude: number | null;
	country_code: string | null;
	geonames_id: string | null;
	description: string | null;
	match_confidence: 'exact' | 'fuzzy' | 'manual' | 'not_found' | null;
}

// Raw geolocation data from MongoDB (pre-reconciled with Wikidata)
export interface RawGeolocCountry {
	_id: MongoOid;
	uri: string;
	name: string;
	coordinates: {
		lat: number;
		long: number;
	};
	updatedAt?: MongoDate;
}

export interface RawGeolocRegion {
	_id: MongoOid;
	country_uri: string;
	uri: string;
	name: string;
	coordinates: {
		latitude: number;
		longitude: number;
	};
}

export interface RawGeolocSubregion {
	_id: MongoOid;
	country_uri: string;
	region_uri: string;
	uri: string;
	name: string;
	coordinates: {
		latitude: number;
		longitude: number;
	};
}

export interface EnrichedLocationsData {
	countries: Record<string, WikidataLocation>;
	regions: Record<string, WikidataLocation>;
	cities: Record<string, WikidataLocation>;
	other: Record<string, WikidataLocation>;
	metadata: {
		generated_at: string;
		source_files: string[];
		total_locations: number;
	};
}

export interface ResearchSectionInfo {
	url: string;
	description: string;
	objectives: string;
	workProgramme: string;
	principalInvestigators: string[];
}

export interface MapMarkerData {
	name: string;
	latitude: number;
	longitude: number;
	count: number;
	type: 'country' | 'region' | 'city' | 'other';
	wikidataId?: string;
	description?: string;
}
