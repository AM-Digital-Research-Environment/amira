import type { CollectionItem } from '$lib/types';
import { personUrl, institutionUrl } from '$lib/utils/urls';

export interface Contributor {
	name: string;
	role: string;
	qualifier: string;
}

export function getContributors(item: CollectionItem): Contributor[] {
	if (!Array.isArray(item.name)) return [];
	return item.name
		.filter((n) => n?.name?.label)
		.map((n) => ({ name: n.name.label, role: n.role || '', qualifier: n.name.qualifier || 'person' }));
}

export function contributorUrl(contributor: { name: string; qualifier: string }): string {
	if (contributor.qualifier === 'institution' || contributor.qualifier === 'group') {
		return institutionUrl(contributor.name);
	}
	return personUrl(contributor.name);
}

export function getSubjects(item: CollectionItem): string[] {
	if (!Array.isArray(item.subject)) return [];
	return item.subject.map((s) => s.authLabel || s.origLabel).filter(Boolean);
}

export function getLanguages(item: CollectionItem): string[] {
	if (!Array.isArray(item.language)) return [];
	return item.language;
}

export function getAbstract(item: CollectionItem): string {
	if (!item.abstract || typeof item.abstract !== 'string') return '';
	return item.abstract;
}

export function getIdentifiers(item: CollectionItem): { type: string; value: string }[] {
	if (!Array.isArray(item.identifier)) return [];
	return item.identifier
		.filter((id) => id?.identifier && id?.identifier_type)
		.map((id) => ({ type: id.identifier_type, value: id.identifier }));
}

export function getOrigins(item: CollectionItem): { city?: string; region?: string; country?: string }[] {
	if (!item.location?.origin) return [];
	return item.location.origin.map((o) => ({ city: o.l3 || undefined, region: o.l2 || undefined, country: o.l1 || undefined }));
}

export function getTags(item: CollectionItem): string[] {
	if (!Array.isArray(item.tags)) return [];
	return item.tags.filter(Boolean);
}

export function getNote(item: CollectionItem): string {
	if (!item.note || typeof item.note !== 'string') return '';
	return item.note;
}

export function getSponsors(item: CollectionItem): string[] {
	if (!Array.isArray(item.sponsor)) return [];
	return item.sponsor.filter(Boolean);
}

export function getUrls(item: CollectionItem): string[] {
	if (!Array.isArray(item.url)) return [];
	return item.url.filter(Boolean);
}

export function getCollections(item: CollectionItem): string[] {
	if (!Array.isArray(item.collection)) return [];
	return item.collection.filter(Boolean);
}

export function getRights(item: CollectionItem): string[] {
	if (!item.accessCondition?.rights) return [];
	return item.accessCondition.rights.filter(Boolean);
}

export function getUsageInfo(item: CollectionItem): { type: string; admins: string } | null {
	if (!item.accessCondition?.usage?.type) return null;
	return {
		type: item.accessCondition.usage.type,
		admins: Array.isArray(item.accessCondition.usage.admins)
			? item.accessCondition.usage.admins.join(', ')
			: item.accessCondition.usage.admins || ''
	};
}

export function getGenre(item: CollectionItem): string[] {
	if (!item.genre) return [];
	// Handle both 'marc' and 'aat' keys
	const entries: string[] = [];
	for (const values of Object.values(item.genre)) {
		if (Array.isArray(values)) entries.push(...values.filter(Boolean));
	}
	return entries;
}

export interface PhysicalInfo {
	type?: string;
	method?: string;
	descriptions: string[];
	technical: string[];
	notes: string[];
}

export function getPhysicalDescription(item: CollectionItem): PhysicalInfo | null {
	if (!item.physicalDescription) return null;
	const pd = item.physicalDescription;
	const hasContent = pd.type || pd.method ||
		(pd.desc?.length > 0) || (pd.tech?.length > 0) || (pd.note?.length > 0);
	if (!hasContent) return null;
	return {
		type: pd.type || undefined,
		method: pd.method || undefined,
		descriptions: (pd.desc || []).filter(Boolean),
		technical: (pd.tech || []).filter(Boolean),
		notes: (pd.note || []).filter(Boolean)
	};
}

export function getCurrentLocations(item: CollectionItem): string[] {
	if (!item.location?.current) return [];
	return item.location.current.filter(Boolean);
}

export interface ContributorFull {
	name: string;
	role: string;
	qualifier: string;
	affiliations: string[];
}

export function getContributorsFull(item: CollectionItem): ContributorFull[] {
	if (!Array.isArray(item.name)) return [];
	return item.name
		.filter((n) => n?.name?.label)
		.map((n) => ({
			name: n.name.label,
			role: n.role || '',
			qualifier: n.name.qualifier || 'person',
			affiliations: (n.affl || []).filter(Boolean)
		}));
}

const DATE_LABELS: Record<string, string> = {
	created: 'Created',
	issue: 'Issued',
	captured: 'Captured',
	other: 'Other',
	valid: 'Valid',
	mod: 'Modified',
	copy: 'Copied',
	disp: 'Digitised'
};

function fmtDate(date: Date | null | undefined): string {
	if (!date) return '';
	const parsed = new Date(date as unknown as string);
	if (isNaN(parsed.getTime())) return '';
	return parsed.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

export interface DateEntry {
	label: string;
	value: string;
}

/** Return all non-empty date entries for an item. */
export function getAllDates(item: CollectionItem): DateEntry[] {
	if (!item.dateInfo) return [];
	const entries: DateEntry[] = [];
	for (const [key, range] of Object.entries(item.dateInfo)) {
		if (!range || typeof range !== 'object') continue;
		const start = fmtDate(range.start);
		const end = fmtDate(range.end);
		let value = '';
		if (start && end) value = `${start} – ${end}`;
		else value = start || end;
		if (value) {
			entries.push({ label: DATE_LABELS[key] || key, value });
		}
	}
	return entries;
}

/** Backward-compatible: return a single formatted date string (best available). */
export function formatDateInfo(item: CollectionItem): string {
	const dates = getAllDates(item);
	return dates[0]?.value || '';
}
