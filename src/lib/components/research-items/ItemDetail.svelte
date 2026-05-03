<script lang="ts">
	import { EntityKnowledgeGraph } from '$lib/components/charts';
	import SimilarItemsStrip from './SimilarItemsStrip.svelte';
	import SiblingItemsSparkline from './SiblingItemsSparkline.svelte';
	import { base } from '$app/paths';
	import type { CollectionItem } from '$lib/types';
	import { getItemTitle } from '$lib/utils/helpers';
	import { getPreviewImage, resolveThumbnailUrl } from '$lib/components/collections/photoHelpers';
	import { thumbnailManifest } from '$lib/stores/data';
	import {
		getContributorsFull,
		getSubjects,
		getAbstract,
		getIdentifiers,
		getOrigins,
		getTags,
		getNote,
		getSponsors,
		getUrls,
		getPhysicalDescription,
		getCurrentLocations
	} from '$lib/utils/transforms/itemExtractors';
	import {
		ItemHeader,
		ItemAbstract,
		ItemContributors,
		ItemLocation,
		ItemSubjects,
		ItemTags,
		ItemPhysical,
		ItemIdentifiers,
		ItemUrls,
		ItemSponsors,
		ItemAudience,
		ItemNote,
		ItemMap,
		type ItemMapMarker
	} from './sections';

	interface Props {
		item: CollectionItem;
		mapMarkers?: ItemMapMarker[];
		/** Items belonging to the same project as `item` — used by the
		 * sibling-items sparkline. Pass an empty array to hide the card. */
		siblings?: CollectionItem[];
	}

	let { item, mapMarkers = [], siblings = [] }: Props = $props();

	let contributors = $derived(getContributorsFull(item));
	let subjects = $derived(getSubjects(item));
	let origins = $derived(getOrigins(item));
	let tags = $derived(getTags(item));
	let identifiers = $derived(getIdentifiers(item));
	let abstract = $derived(getAbstract(item));
	let note = $derived(getNote(item));
	let sponsors = $derived(getSponsors(item));
	let urls = $derived(getUrls(item));
	let targetAudience = $derived(
		Array.isArray(item.targetAudience) ? item.targetAudience.filter(Boolean) : []
	);
	let physicalDesc = $derived(getPhysicalDescription(item));
	let currentLocations = $derived(getCurrentLocations(item));

	// Preview image — collection items surface a `previewImage[0]`; for items
	// that aren't photo-backed this is null and the image block is skipped.
	// The thumbnail manifest swaps the remote URL for a local WebP once it
	// loads (same pattern as the masonry card / lightbox).
	let originalPreviewUrl = $derived(getPreviewImage(item));
	let previewUrl = $derived(resolveThumbnailUrl(originalPreviewUrl, $thumbnailManifest, base));
	let imageFailed = $state(false);
	let triedRemote = $state(false);
	let displayImageUrl = $derived(triedRemote ? originalPreviewUrl : previewUrl);

	function onImageError() {
		if (!triedRemote && previewUrl !== originalPreviewUrl) {
			triedRemote = true;
		} else {
			imageFailed = true;
		}
	}

	$effect(() => {
		// Reset image fallback state when the selected item changes so a
		// previous item's failed-load state doesn't suppress the new image.
		item;
		imageFailed = false;
		triedRemote = false;
	});
</script>

<!-- Preview image — shown when the item has one (typically collection-backed
     photo records). Presented at its natural size with a subtle frame so
     small thumbnails don't get stretched across the full card width. -->
{#if displayImageUrl && !imageFailed}
	<figure class="item-image">
		<img
			src={displayImageUrl}
			alt={getItemTitle(item)}
			loading="lazy"
			draggable="false"
			onerror={onImageError}
		/>
	</figure>
{/if}

<!-- Title & metadata header (full width) -->
<ItemHeader {item} />

<!-- Abstract (full width) -->
<ItemAbstract {abstract} />

<!-- Two-column grid of metadata cards. Each section renders nothing when its
     data is empty, so the grid auto-flows around missing slots. -->
<div class="grid gap-6 md:grid-cols-2">
	<ItemContributors {contributors} />
	<ItemLocation {origins} {currentLocations} />
	<ItemSubjects {subjects} />
	<ItemTags {tags} />
	<ItemPhysical {physicalDesc} />
	<ItemIdentifiers {identifiers} />
	<ItemUrls {urls} />
	<ItemSponsors {sponsors} />
	<ItemAudience audience={targetAudience} />
	<ItemNote {note} />
</div>

<!-- Map — full width, outside the two-column grid -->
<ItemMap markers={mapMarkers} />

<!-- Project timeline sparkline — where this item sits among its siblings.
     Hidden automatically when there are fewer than 2 siblings or no
     extractable years. -->
<SiblingItemsSparkline {siblings} currentItem={item} projectName={item.project?.name} />

<!-- Knowledge Graph — full width -->
{#if item.dre_id}
	<EntityKnowledgeGraph entityType="researchItems" entityId={item.dre_id} />
{/if}

<!-- Similar items — top semantic-kNN matches via Gemini embeddings.
     Lazy-loads the precomputed `static/data/embeddings/similar.json` on
     first paint of an item detail; renders nothing if the embeddings
     haven't been generated yet or the current item is low-signal. -->
{#if item.dre_id}
	<SimilarItemsStrip itemId={item.dre_id} />
{/if}

<style>
	.item-image {
		display: flex;
		justify-content: center;
		/* Parent uses Tailwind's `space-y-6` which adds `margin-top: 1.5rem`
		   to sibling cards. Vertical margins collapse, so this margin-bottom
		   has to exceed 1.5rem to actually add gap — 2.5rem yields ~40px
		   between the image and the title card. */
		margin: 0 0 2.5rem;
		padding: 0;
	}
	.item-image img {
		display: block;
		max-width: 100%;
		max-height: 60vh;
		width: auto;
		height: auto;
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
		background: hsl(var(--muted));
	}
</style>
