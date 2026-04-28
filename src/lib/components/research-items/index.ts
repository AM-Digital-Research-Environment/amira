export { default as ItemDetail } from './ItemDetail.svelte';
export { default as ItemFilters } from './ItemFilters.svelte';
export { default as ItemTable } from './ItemTable.svelte';
export { default as SimilarItemsStrip } from './SimilarItemsStrip.svelte';
export { default as SiblingItemsSparkline } from './SiblingItemsSparkline.svelte';

// Re-export item-level data extractors and formatters from their canonical
// home in `$lib/utils/transforms/` so the public component-folder API stays
// stable.
export {
	getContributors,
	getContributorsFull,
	contributorUrl,
	getSubjects,
	getLanguages,
	getAbstract,
	getIdentifiers,
	getOrigins,
	getTags,
	getNote,
	getSponsors,
	getUrls,
	getCollections,
	getRights,
	getUsageInfo,
	getGenre,
	getPhysicalDescription,
	getCurrentLocations
} from '$lib/utils/transforms/itemExtractors';
export type {
	Contributor,
	ContributorFull,
	Identifier,
	PhysicalInfo
} from '$lib/utils/transforms/itemExtractors';
export { formatDateInfo, getAllDates } from '$lib/utils/transforms/itemFormatters';
export type { DateEntry } from '$lib/utils/transforms/itemFormatters';
