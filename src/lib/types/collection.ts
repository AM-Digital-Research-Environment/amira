// Collection item types (UBT metadata schema)

export interface TitleInfo {
	title: string;
	title_type: string;
}

export interface DateRange {
	start?: Date | null;
	end?: Date | null;
}

export interface DateInfo {
	[key: string]: DateRange | undefined;
	issue?: DateRange;
	created?: DateRange;
	captured?: DateRange;
	other?: DateRange;
	valid?: DateRange;
	mod?: DateRange;
	copy?: DateRange;
	disp?: DateRange;
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
