// Geolocation types

import type { MongoOid, MongoDate } from './mongo';

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
		lat: number;
		long: number;
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

export interface RawGeolocCity {
	_id: MongoOid;
	country_uri: string;
	uri: string | null;
	name: string;
	coordinates: {
		lat: number;
		long: number;
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
	members: string[];
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
