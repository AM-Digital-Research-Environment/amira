import { base } from '$app/paths';

export function personUrl(name: string): string {
	return `${base}/people?name=${encodeURIComponent(name)}`;
}

export function projectUrl(id: string): string {
	return `${base}/projects?id=${encodeURIComponent(id)}`;
}

export function researchSectionsUrl(sectionName?: string): string {
	if (sectionName) {
		return `${base}/research-sections?section=${encodeURIComponent(sectionName)}`;
	}
	return `${base}/research-sections`;
}

export function researchItemUrl(id: string): string {
	return `${base}/research-items?id=${encodeURIComponent(id)}`;
}

export function institutionUrl(name: string): string {
	return `${base}/institutions?name=${encodeURIComponent(name)}`;
}

export function locationUrl(name: string): string {
	return `${base}/locations?name=${encodeURIComponent(name)}`;
}

export function languageUrl(code: string): string {
	return `${base}/languages?code=${encodeURIComponent(code)}`;
}

export function subjectUrl(name: string): string {
	return `${base}/subjects?name=${encodeURIComponent(name)}&view=subjects`;
}

export function tagUrl(name: string): string {
	return `${base}/subjects?name=${encodeURIComponent(name)}&view=tags`;
}

export function resourceTypeUrl(type: string): string {
	return `${base}/resource-types?type=${encodeURIComponent(type)}`;
}

export function genreUrl(genre: string): string {
	return `${base}/genres?genre=${encodeURIComponent(genre)}`;
}
