// Re-export all domain types
export * from './mongo';
export * from './domain';
export * from './collection';
export * from './charts';
export * from './geo';
export * from './category-index';

// Cross-cutting types kept here

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
	...universities.map((uni) => ({ value: uni.id, label: `${uni.name} (${uni.code})` }))
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
