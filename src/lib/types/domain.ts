// Core business entity types

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
