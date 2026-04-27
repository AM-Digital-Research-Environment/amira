<script lang="ts">
	/**
	 * Generalised compare route — accepts a `[type]` segment and delegates
	 * to the right component:
	 *
	 *   - `projects`  → `ProjectsCompare` (on-the-fly aggregation off
	 *                   `$allCollections`, supports university filters)
	 *   - everything else → `EntityCompare` (precomputed JSON per entity)
	 *
	 * The route itself just renders the page header and the type tab bar;
	 * each delegate ships its own SEO meta because the title differs per
	 * type.
	 */
	import { SEO } from '$lib/components/ui';
	import {
		CompareTabs,
		ProjectsCompare,
		EntityCompare,
		type CompareType
	} from '$lib/components/compare';

	interface Props {
		data: { type: CompareType };
	}

	let { data }: Props = $props();

	const TYPE_LABEL: Record<CompareType, string> = {
		projects: 'Projects',
		people: 'People',
		institutions: 'Institutions',
		subjects: 'Subjects',
		languages: 'Languages',
		genres: 'Genres'
	};

	const TYPE_DESC: Record<CompareType, string> = {
		projects: 'Side-by-side comparison of research metadata across universities and projects',
		people: 'Compare two contributors — items, subjects, languages, year span',
		institutions: 'Compare two institutions — affiliated contributors, projects, geographic reach',
		subjects: 'Compare two subject headings — co-occurring subjects, contributors, timelines',
		languages: 'Compare two languages — corpus size, contributors, geographic distribution',
		genres: 'Compare two genres — language mix, subjects, timelines'
	};

	const title = $derived(`Compare ${TYPE_LABEL[data.type]}`);
	const description = $derived(TYPE_DESC[data.type]);
</script>

<!-- Top-level SEO. ProjectsCompare/EntityCompare also set their own SEO,
	 but having one here ensures the route's prerendered HTML is meaningful
	 even before the component mounts. -->
<SEO {title} {description} />

<div class="space-y-6">
	<div class="animate-slide-in-up">
		<h1 class="page-title">{title}</h1>
		<p class="page-subtitle">{description}</p>
	</div>

	<CompareTabs current={data.type} />

	{#if data.type === 'projects'}
		<ProjectsCompare />
	{:else}
		<EntityCompare type={data.type} />
	{/if}
</div>
