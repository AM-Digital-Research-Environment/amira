import { base } from '$app/paths';

export function personUrl(name: string): string {
	return `${base}/people?name=${encodeURIComponent(name)}`;
}

export function projectsUrl(): string {
	return `${base}/projects`;
}

export function projectUrl(id: string): string {
	return `${base}/projects?id=${encodeURIComponent(id)}`;
}

export function researchSectionsUrl(sectionName?: string): string {
	if (sectionName) {
		const slug = sectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
		return `${base}/research-sections#${slug}`;
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
