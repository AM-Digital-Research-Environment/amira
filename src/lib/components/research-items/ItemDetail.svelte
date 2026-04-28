<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent, Badge } from '$lib/components/ui';
	import { MiniMap, EntityKnowledgeGraph } from '$lib/components/charts';
	import SimilarItemsStrip from './SimilarItemsStrip.svelte';
	import SiblingItemsSparkline from './SiblingItemsSparkline.svelte';
	import { base } from '$app/paths';
	import {
		locationUrl,
		institutionUrl,
		projectUrl,
		languageUrl,
		resourceTypeUrl,
		subjectUrl,
		tagUrl,
		genreUrl
	} from '$lib/utils/urls';
	import { languageName } from '$lib/utils/languages';
	import type { CollectionItem } from '$lib/types';
	import { universities } from '$lib/types';
	import { EXTERNAL_SOURCE_ID } from '$lib/utils/dataLoader';
	import { getItemTitle } from '$lib/utils/helpers';
	import { getPreviewImage, resolveThumbnailUrl } from '$lib/components/collections/photoHelpers';
	import { thumbnailManifest } from '$lib/stores/data';
	import {
		FileText,
		Users,
		Tag,
		Calendar,
		MapPin,
		Languages,
		Building2,
		Briefcase,
		ExternalLink,
		BookType,
		HardDrive,
		StickyNote,
		Heart,
		Link,
		Target,
		Hash
	} from '@lucide/svelte';
	import { WissKILink } from '$lib/components/ui';
	import {
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
		getGenre,
		getPhysicalDescription,
		getCurrentLocations,
		getAllDates
	} from './itemHelpers';

	interface Props {
		item: CollectionItem;
		mapMarkers?: {
			latitude: number;
			longitude: number;
			label: string;
			color?: string;
			kind?: 'origin' | 'current';
		}[];
		/** Items belonging to the same project as `item` — used by the
		 * sibling-items sparkline. Pass an empty array to hide the card. */
		siblings?: CollectionItem[];
	}

	let { item, mapMarkers = [], siblings = [] }: Props = $props();

	let originMarkerCount = $derived(mapMarkers.filter((m) => m.kind !== 'current').length);
	let currentMarkerCount = $derived(mapMarkers.filter((m) => m.kind === 'current').length);

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
	let genre = $derived(getGenre(item));
	let physicalDesc = $derived(getPhysicalDescription(item));
	let currentLocations = $derived(getCurrentLocations(item));
	let allDates = $derived(getAllDates(item));

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

<!-- Title & Metadata — full width -->
<Card class="overflow-hidden">
	{#snippet children()}
		<CardHeader>
			{#snippet children()}
				<div class="min-w-0">
					<CardTitle class="break-words">
						{#snippet children()}{getItemTitle(item)}{/snippet}
					</CardTitle>
					{#if item.titleInfo?.length > 1}
						<div class="mt-2 space-y-1">
							{#each item.titleInfo.slice(1) as alt (alt.title)}
								<p class="text-sm break-words">
									<span class="text-muted-foreground font-medium">{alt.title_type} title:</span>
									<span class="text-foreground/80">{alt.title}</span>
								</p>
							{/each}
						</div>
					{/if}
					{#if item.project?.name}
						<p class="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
							<Briefcase class="h-3.5 w-3.5 shrink-0" />
							Project:
							<a href={projectUrl(item.project.id)} class="hover:text-primary transition-colors"
								>{item.project.name}</a
							>
						</p>
					{/if}
				</div>
			{/snippet}
		</CardHeader>
		<CardContent>
			{#snippet children()}
				<div class="grid gap-3 text-sm sm:grid-cols-2">
					{#if item.typeOfResource}
						<div class="flex items-center gap-2">
							<FileText class="h-4 w-4 text-muted-foreground shrink-0" />
							<span class="text-muted-foreground shrink-0">Type</span>
							<a
								href={resourceTypeUrl(item.typeOfResource)}
								class="text-foreground hover:text-primary transition-colors"
								>{item.typeOfResource}</a
							>
						</div>
					{/if}
					{#if genre.length > 0}
						<div class="flex items-center gap-2">
							<BookType class="h-4 w-4 text-muted-foreground shrink-0" />
							<span class="text-muted-foreground shrink-0">Genre</span>
							<span class="text-foreground">
								{#each genre as g, i (g)}
									<a href={genreUrl(g)} class="hover:text-primary transition-colors">{g}</a
									>{#if i < genre.length - 1},&nbsp;{/if}
								{/each}
							</span>
						</div>
					{/if}
					{#if item.university}
						{@const uni = universities.find((u) => u.id === item.university)}
						{#if uni}
							<div class="flex items-center gap-2">
								<Building2 class="h-4 w-4 text-muted-foreground shrink-0" />
								<span class="text-muted-foreground shrink-0">Institution</span>
								<a
									href={institutionUrl(uni.name)}
									class="text-foreground hover:text-primary transition-colors truncate"
								>
									{uni.name}
								</a>
							</div>
						{:else if item.university === EXTERNAL_SOURCE_ID}
							<div class="flex items-center gap-2">
								<Building2 class="h-4 w-4 text-muted-foreground shrink-0" />
								<span class="text-muted-foreground shrink-0">Source</span>
								<span class="text-foreground truncate">External collection</span>
							</div>
						{/if}
					{/if}
					{#if getLanguages(item).length > 0}
						<div class="flex items-center gap-2">
							<Languages class="h-4 w-4 text-muted-foreground shrink-0" />
							<span class="text-muted-foreground shrink-0">Language</span>
							<span class="text-foreground">
								{#each getLanguages(item) as lang, i (lang)}
									<a href={languageUrl(lang)} class="hover:text-primary transition-colors"
										>{languageName(lang)}</a
									>{#if i < getLanguages(item).length - 1},&nbsp;{/if}
								{/each}
							</span>
						</div>
					{/if}
					{#each allDates as dateEntry (dateEntry.label)}
						<div class="flex items-center gap-2">
							<Calendar class="h-4 w-4 text-muted-foreground shrink-0" />
							<span class="text-muted-foreground shrink-0">{dateEntry.label}</span>
							<span class="text-foreground">{dateEntry.value}</span>
						</div>
					{/each}
					{#if item.dre_id}
						<div class="flex items-center gap-2">
							<WissKILink category="researchItems" entityKey={item.dre_id} />
						</div>
					{/if}
				</div>
			{/snippet}
		</CardContent>
	{/snippet}
</Card>

<!-- Abstract — full width -->
{#if abstract}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}Abstract{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<p class="text-sm text-muted-foreground leading-relaxed break-words whitespace-pre-line">
						{abstract}
					</p>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}

<!-- Two-column grid for metadata cards -->
<div class="grid gap-6 md:grid-cols-2">
	<!-- Contributors -->
	{#if contributors.length > 0}
		<Card class="overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle class="text-lg">
							{#snippet children()}
								<span class="flex items-center gap-2">
									<Users class="h-5 w-5 text-primary" />
									Contributors
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<ul class="space-y-2">
							{#each contributors as contributor (contributor.name + (contributor.role ?? ''))}
								<li class="p-2 rounded-lg bg-muted/30">
									<div class="flex items-center justify-between gap-2">
										<a
											href={contributorUrl(contributor)}
											class="text-sm font-medium text-foreground hover:text-primary transition-colors"
										>
											{contributor.name}
										</a>
										<div class="flex items-center gap-1.5 shrink-0">
											{#if contributor.qualifier !== 'person'}
												<Badge variant="secondary" class="text-2xs">
													{#snippet children()}{contributor.qualifier}{/snippet}
												</Badge>
											{/if}
											{#if contributor.role}
												<Badge variant="outline" class="text-2xs">
													{#snippet children()}{contributor.role}{/snippet}
												</Badge>
											{/if}
										</div>
									</div>
									{#if contributor.affiliations.length > 0}
										<div class="mt-1">
											{#each contributor.affiliations as affl (affl)}
												<a
													href={institutionUrl(affl)}
													class="text-xs text-muted-foreground hover:text-primary transition-colors block"
												>
													{affl}
												</a>
											{/each}
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>
	{/if}

	<!-- Location -->
	{#if origins.length > 0 || currentLocations.length > 0}
		<Card class="overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle class="text-lg">
							{#snippet children()}
								<span class="flex items-center gap-2">
									<MapPin class="h-5 w-5 text-primary" />
									Location
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="space-y-4">
							{#if origins.length > 0}
								{#each origins as origin, i (i)}
									<div class="space-y-1.5">
										{#if origins.length > 1}
											<p class="text-xs font-semibold text-muted-foreground">Origin {i + 1}</p>
										{/if}
										{#if origin.country}
											<div class="flex items-center gap-2 text-sm">
												<span class="text-muted-foreground min-w-[80px] shrink-0">Country</span>
												<a
													href={locationUrl(origin.country)}
													class="text-foreground hover:text-primary transition-colors"
													>{origin.country}</a
												>
											</div>
										{/if}
										{#if origin.region}
											<div class="flex items-center gap-2 text-sm">
												<span class="text-muted-foreground min-w-[80px] shrink-0">Region</span>
												<a
													href={locationUrl(origin.region)}
													class="text-foreground hover:text-primary transition-colors"
													>{origin.region}</a
												>
											</div>
										{/if}
										{#if origin.city}
											<div class="flex items-center gap-2 text-sm">
												<span class="text-muted-foreground min-w-[80px] shrink-0">Subregion</span>
												<a
													href={locationUrl(origin.city)}
													class="text-foreground hover:text-primary transition-colors"
													>{origin.city}</a
												>
											</div>
										{/if}
									</div>
								{/each}
							{/if}
							{#if currentLocations.length > 0}
								<div class="space-y-1">
									<p class="text-xs font-semibold text-muted-foreground">Located at</p>
									{#each currentLocations as loc (loc)}
										<p class="text-sm text-foreground">{loc}</p>
									{/each}
								</div>
							{/if}
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>
	{/if}

	<!-- Subjects -->
	{#if subjects.length > 0}
		<Card class="overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle class="text-lg">
							{#snippet children()}
								<span class="flex items-center gap-2">
									<Tag class="h-5 w-5 text-primary" />
									Subjects
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="flex flex-wrap gap-2">
							{#each subjects as subject (subject)}
								<a href={subjectUrl(subject)} class="hover:opacity-80 transition-opacity">
									<Badge variant="secondary" class="hover:bg-primary/20 transition-colors">
										{#snippet children()}{subject}{/snippet}
									</Badge>
								</a>
							{/each}
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>
	{/if}

	<!-- Tags -->
	{#if tags.length > 0}
		<Card class="overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle class="text-lg">
							{#snippet children()}
								<span class="flex items-center gap-2">
									<Tag class="h-5 w-5 text-primary" />
									Tags
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="flex flex-wrap gap-1.5">
							{#each tags as tag (tag)}
								<a href={tagUrl(tag)} class="hover:opacity-80 transition-opacity">
									<Badge variant="outline" class="text-xs hover:bg-accent/20 transition-colors">
										{#snippet children()}{tag}{/snippet}
									</Badge>
								</a>
							{/each}
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>
	{/if}

	<!-- Physical Description -->
	{#if physicalDesc}
		<Card class="overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle class="text-lg">
							{#snippet children()}
								<span class="flex items-center gap-2">
									<HardDrive class="h-5 w-5 text-primary" />
									Physical Description
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="space-y-2 text-sm">
							{#if physicalDesc.type}
								<div class="flex gap-2">
									<span class="text-muted-foreground shrink-0 min-w-[80px]">Type</span>
									<span class="text-foreground">{physicalDesc.type}</span>
								</div>
							{/if}
							{#if physicalDesc.method}
								<div class="flex gap-2">
									<span class="text-muted-foreground shrink-0 min-w-[80px]">Method</span>
									<a
										href="{base}/research-items?method={encodeURIComponent(physicalDesc.method)}"
										class="text-foreground hover:text-primary transition-colors"
										>{physicalDesc.method}</a
									>
								</div>
							{/if}
							{#if physicalDesc.descriptions.length > 0}
								<div class="flex gap-2">
									<span class="text-muted-foreground shrink-0 min-w-[80px]">Format</span>
									<span class="text-foreground">{physicalDesc.descriptions.join(', ')}</span>
								</div>
							{/if}
							{#if physicalDesc.technical.length > 0}
								<div class="flex gap-2">
									<span class="text-muted-foreground shrink-0 min-w-[80px]">Technical property</span
									>
									<span class="text-foreground">{physicalDesc.technical.join(', ')}</span>
								</div>
							{/if}
							{#if physicalDesc.notes.length > 0}
								<div class="flex gap-2">
									<span class="text-muted-foreground shrink-0 min-w-[80px]">Notes</span>
									<span class="text-foreground">{physicalDesc.notes.join(', ')}</span>
								</div>
							{/if}
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>
	{/if}

	<!-- Identifiers -->
	{#if identifiers.length > 0}
		<Card class="overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle class="text-lg">
							{#snippet children()}
								<span class="flex items-center gap-2">
									<Hash class="h-5 w-5 text-primary" />
									Identifiers
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="space-y-2">
							{#each identifiers as id (id.type + id.value)}
								<div class="flex items-baseline gap-3 text-sm">
									<span class="text-muted-foreground shrink-0 min-w-[80px]">{id.type}</span>
									{#if id.url}
										<a
											href={id.url}
											target="_blank"
											rel="noopener noreferrer"
											class="text-primary hover:underline font-mono text-xs break-all inline-flex items-center gap-1"
										>
											{id.value}<ExternalLink class="h-3 w-3 shrink-0" />
										</a>
									{:else}
										<span class="text-foreground font-mono text-xs break-all">{id.value}</span>
									{/if}
								</div>
							{/each}
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>
	{/if}

	<!-- URLs -->
	{#if urls.length > 0}
		<Card class="overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle class="text-lg">
							{#snippet children()}
								<span class="flex items-center gap-2">
									<Link class="h-5 w-5 text-primary" />
									Links
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="space-y-2">
							{#each urls as url (url)}
								<a
									href={url}
									target="_blank"
									rel="noopener noreferrer"
									class="text-sm text-primary hover:underline break-all flex items-center gap-1.5"
								>
									<ExternalLink class="h-3.5 w-3.5 shrink-0" />
									{url}
								</a>
							{/each}
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>
	{/if}

	<!-- Sponsors -->
	{#if sponsors.length > 0}
		<Card class="overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle class="text-lg">
							{#snippet children()}
								<span class="flex items-center gap-2">
									<Heart class="h-5 w-5 text-primary" />
									Sponsors
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<ul class="space-y-1.5">
							{#each sponsors as sponsor (sponsor)}
								<li class="text-sm text-muted-foreground">{sponsor}</li>
							{/each}
						</ul>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>
	{/if}

	<!-- Target Audience -->
	{#if targetAudience.length > 0}
		<Card class="overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle class="text-lg">
							{#snippet children()}
								<span class="flex items-center gap-2">
									<Target class="h-5 w-5 text-primary" />
									Target Audience
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="flex flex-wrap gap-2">
							{#each targetAudience as audience (audience)}
								<a
									href="{base}/research-items?audience={encodeURIComponent(audience)}"
									class="hover:opacity-80 transition-opacity"
								>
									<Badge
										variant="secondary"
										class="hover:bg-primary/20 transition-colors cursor-pointer"
									>
										{#snippet children()}{audience}{/snippet}
									</Badge>
								</a>
							{/each}
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>
	{/if}

	<!-- Note -->
	{#if note}
		<Card class="overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle class="text-lg">
							{#snippet children()}
								<span class="flex items-center gap-2">
									<StickyNote class="h-5 w-5 text-primary" />
									Note
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<p class="text-sm text-muted-foreground whitespace-pre-line break-words">{note}</p>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>
	{/if}
</div>

<!-- Map — full width, outside the two-column grid -->
{#if mapMarkers.length > 0}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}
							<span class="flex items-center gap-2">
								<MapPin class="h-5 w-5 text-primary" />
								Location Map
							</span>
						{/snippet}
					</CardTitle>
					<div
						class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1"
					>
						{#if originMarkerCount > 0}
							<span class="inline-flex items-center gap-1.5">
								<span
									class="inline-block w-2.5 h-2.5 rounded-full border border-background"
									style="background-color: hsl(var(--chart-1))"
								></span>
								Origin{originMarkerCount > 1 ? 's' : ''} ({originMarkerCount})
							</span>
						{/if}
						{#if currentMarkerCount > 0}
							<span class="inline-flex items-center gap-1.5">
								<span
									class="inline-block w-2.5 h-2.5 rounded-full border border-background"
									style="background-color: hsl(var(--chart-2))"
								></span>
								Located at ({currentMarkerCount})
							</span>
						{/if}
					</div>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<MiniMap markers={mapMarkers} />
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}

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
