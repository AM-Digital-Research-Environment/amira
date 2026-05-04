<!--
@component

EntityDetailViewShell — wraps the detail-view branch of every entity-
browse page in the universally-shared `space-y-6` container, the
BackToList button, and the loading / empty-state pattern that all 10
entity pages duplicate.

Each page's detail view used to look like:

```text
<div class="space-y-6">
  <BackToList show={true} onclick={clearSelection} label="Back to X" />
  if (selectedXData) → render full detail body
  else if (detail.loading) → "Loading dashboard…"
  else → "No data available for this X."
</div>
```

…that pattern lived inline in 10 places. This shell owns it. Pages
provide:

- `backLabel`, `onBack` — wire the BackToList.
- `resolved` — truthy when the entity has been resolved (from live
  collections or from the per-entity precomputed JSON). When falsy,
  the shell shows the loading or empty state instead of the body.
- `loading` — true while the per-entity JSON is in flight (from
  `createEntityDetailState(...).loading`). Distinguishes "loading"
  from "no data".
- `emptyMessage` — overridable text for the empty state.
- `body` — the entity-specific content (header, items, dashboard,
  knowledge graph, plus any per-entity extras). The shell does not
  prescribe this layout — half the entity pages have substantially
  different inner structure (institutions has paginated projects,
  locations has region/city sub-cards, people has affiliation /
  profile / sections / projects PI / projects member cards, etc.) so
  forcing a rigid layout would push them off the shell.

The simpler pages (genres, groups, languages, resource-types,
subjects) tend to compose Header + Items + Dashboard + (optional)
Graph inside the body. There's no helper component for that yet; if
the pattern proves stable, a future `EntityDetailViewBody` could
render it from typed snippets.
-->
<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { BackToList } from '$lib/components/ui';

	interface Props {
		/** Label for the BackToList button (e.g. "Back to genres"). */
		backLabel: string;
		/** Click handler for the BackToList button. */
		onBack: () => void;
		/**
		 * The resolved entity, or a falsy value when not yet resolved.
		 * Truthy → the shell renders `body(resolved)`. The body snippet
		 * receives the non-null entity so pages get TypeScript narrowing
		 * for free, without an extra `{#if}` inside the snippet.
		 */
		resolved: T | null | undefined;
		/**
		 * True while the per-entity JSON is loading
		 * (`createEntityDetailState(...).loading`). When `resolved` is
		 * falsy and `loading` is true, the shell shows "Loading dashboard…".
		 */
		loading?: boolean;
		/** Override the empty-state message. */
		emptyMessage?: string;
		/** Detail-view content. Receives the resolved (non-null) entity. */
		body: Snippet<[T]>;
	}

	let {
		backLabel,
		onBack,
		resolved,
		loading = false,
		emptyMessage = 'No data available.',
		body
	}: Props = $props();
</script>

<div class="space-y-6">
	<BackToList show={true} onclick={onBack} label={backLabel} />
	{#if resolved}
		{@render body(resolved)}
	{:else if loading}
		<p class="text-sm text-muted-foreground">Loading dashboard…</p>
	{:else}
		<p class="text-sm text-muted-foreground">{emptyMessage}</p>
	{/if}
</div>
