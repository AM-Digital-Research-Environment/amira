// Geolocation types

// Compact location: only coordinates, since the dashboard never reads any of
// the other Wikidata fields. Built from dev.geo.json by geolocLoader.ts.
export interface WikidataLocation {
	latitude: number;
	longitude: number;
}

export interface EnrichedLocationsData {
	countries: Record<string, WikidataLocation>;
	regions: Record<string, WikidataLocation>;
	cities: Record<string, WikidataLocation>;
}

export interface ResearchSectionInfo {
	url: string;
	description: string;
	objectives: string;
	workProgramme: string;
	principalInvestigators: string[];
	members: string[];
}
