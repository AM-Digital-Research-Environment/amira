import { describe, it, expect } from 'vitest';
import { DATA_PATHS } from './collectionLoader';

describe('DATA_PATHS', () => {
	it('builds the manifest URL with no base', () => {
		expect(DATA_PATHS.manifest()).toBe('/data/manifest.json');
	});

	it('honors the base path prefix', () => {
		expect(DATA_PATHS.manifest('/dashboard')).toBe('/dashboard/data/manifest.json');
	});

	it('builds the lightweight-store URLs the loaders expect', () => {
		expect(DATA_PATHS.projects()).toBe('/data/dev/dev.projectsData.json');
		expect(DATA_PATHS.persons()).toBe('/data/dev/dev.persons.json');
		expect(DATA_PATHS.institutions()).toBe('/data/dev/dev.institutions.json');
		expect(DATA_PATHS.groups()).toBe('/data/dev/dev.groups.json');
		expect(DATA_PATHS.researchSections()).toBe('/data/dev/dev.researchSections.json');
		expect(DATA_PATHS.enrichedLocations()).toBe('/data/dev/dev.geo.json');
		expect(DATA_PATHS.devCollections()).toBe('/data/dev/dev.collections.json');
		expect(DATA_PATHS.thumbnailsManifest()).toBe('/thumbnails/manifest.json');
	});

	it('builds per-collection URLs for both university and external folders', () => {
		expect(DATA_PATHS.collection('projects_metadata_ubt', 'UBT_HDMC2019')).toBe(
			'/data/projects_metadata_ubt/projects_metadata_ubt.UBT_HDMC2019.json'
		);
		expect(DATA_PATHS.collection('external_metadata', 'ILAM')).toBe(
			'/data/external_metadata/external_metadata.ILAM.json'
		);
	});
});
