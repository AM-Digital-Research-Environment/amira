export { default as CompareTabs } from './CompareTabs.svelte';
export { default as CompareStatRow } from './CompareStatRow.svelte';
export { default as CompareSharedSubjects } from './CompareSharedSubjects.svelte';
export { default as CompareProfileRadar } from './CompareProfileRadar.svelte';
export { default as ComparePair } from './ComparePair.svelte';
export { default as ProjectsCompare } from './ProjectsCompare.svelte';
export { default as EntityCompare } from './EntityCompare.svelte';

export {
	buildRadarIndicator,
	buildRadarSeries,
	computeSubjectOverlap,
	type Profile,
	type SubjectOverlap,
	type NamedValue
} from './compareProfile';

export { COMPARE_TYPES, type CompareType } from './compareTypes';
