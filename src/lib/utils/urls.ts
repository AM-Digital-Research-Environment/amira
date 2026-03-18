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

export function researchSectionsUrl(): string {
	return `${base}/research-sections`;
}

export function researchItemUrl(id: string): string {
	return `${base}/research-items?id=${encodeURIComponent(id)}`;
}
