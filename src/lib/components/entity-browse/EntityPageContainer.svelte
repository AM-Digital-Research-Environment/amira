<!--
@component

EntityPageContainer — outer shell shared by every entity-browse page
(people, projects, locations, institutions, subjects, languages,
genres, groups, resource-types, research-sections).

Each of those pages used to inline ~10 lines of identical
boilerplate: a `space-y-8 animate-slide-in-up` wrapper, the
`page-title` / `page-subtitle` header pair, and an `if-selected /
else` switch between the detail and list views — plus a
`useEntityCollectionLoader(() => selected)` call that every page
makes verbatim. This component owns all of that. Pages provide the
selection getter and two snippets (`detailView`, `listView`); the
container wires the layout, the title block, and the standard
collection-loading hook.

Why a getter, not a bound prop? `selected` is passed as a function
so the container can re-read it inside its own reactive scope and
inside `useEntityCollectionLoader`'s `$effect`. A plain reactive
prop would require `$bindable` on the page side and wouldn't compose
cleanly with `$derived` selections that already exist on every page.

The optional `onMountExtra` callback runs alongside the loader's
`onMount`. Today only the people page uses it
(`loadWisskiUrls('persons')`) and the locations page
(`ensureEnrichedLocations(base)`); leaving the door open for future
pages avoids forcing them off the container.

`useEntityCollectionLoader` is always wired. Pages that handle their
own loading should not adopt this container — there's no way to
opt out today, since every entity page in the dashboard wants the
standard loader semantics.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { useEntityCollectionLoader } from './useEntityCollectionLoader.svelte';

	interface Props {
		/** H1 page title (e.g. "Genres", "People"). */
		title: string;
		/** Optional subtitle paragraph below the title. */
		subtitle?: string;
		/** Reactive getter — returns truthy when the page is in detail view. */
		selected: () => unknown;
		/**
		 * Detail-view content (rendered when `selected()` is truthy).
		 * Named with the `View` suffix to avoid clashing with the
		 * conventional `const detail = createEntityDetailState(...)` that
		 * every entity page declares.
		 */
		detailView: Snippet;
		/** List-view content (rendered when `selected()` is falsy). */
		listView: Snippet;
		/** Side-effect run alongside `onMount` (e.g. WissKI URL prefetch). */
		onMountExtra?: () => void;
	}

	let { title, subtitle, selected, detailView, listView, onMountExtra }: Props = $props();

	// Wrap the prop reads in closures so svelte-check doesn't flag them as
	// initial-value captures. The hook reads `hasSelection` from a $effect
	// that re-runs on dependency change, and `onMountExtra` once from
	// onMount; both are correctly invoked through these closures.
	useEntityCollectionLoader(() => selected(), {
		onMountExtra: () => onMountExtra?.()
	});
</script>

<div class="space-y-8 animate-slide-in-up">
	<div>
		<h1 class="page-title">{title}</h1>
		{#if subtitle}
			<p class="page-subtitle">{subtitle}</p>
		{/if}
	</div>

	{#if selected()}
		{@render detailView()}
	{:else}
		{@render listView()}
	{/if}
</div>
