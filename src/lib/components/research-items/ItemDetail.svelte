<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent, Badge } from '$lib/components/ui';
	import { MiniMap } from '$lib/components/charts';
	import { locationUrl, institutionUrl, projectUrl, languageUrl, resourceTypeUrl } from '$lib/utils/urls';
	import { languageName } from '$lib/utils/languages';
	import type { CollectionItem } from '$lib/types';
	import { universities } from '$lib/types';
	import { getItemTitle } from '$lib/utils/helpers';
	import { FileText, Users, Tag, Calendar, MapPin, Languages, Building2, Briefcase } from '@lucide/svelte';
	import {
		getContributors,
		contributorUrl,
		getSubjects,
		getLanguages,
		getAbstract,
		getIdentifiers,
		getOrigins,
		getTags,
		formatDateInfo
	} from './itemHelpers';

	interface Props {
		item: CollectionItem;
		mapMarkers?: { latitude: number; longitude: number; label: string }[];
		onAddSubject?: (subject: string) => void;
		onAddTag?: (tag: string) => void;
	}

	let { item, mapMarkers = [], onAddSubject, onAddTag }: Props = $props();
</script>

<!-- Title & Type -->
<Card class="overflow-hidden">
	{#snippet children()}
		<CardHeader>
			{#snippet children()}
				<div class="min-w-0">
					<CardTitle class="break-words">
						{#snippet children()}{getItemTitle(item)}{/snippet}
					</CardTitle>
					{#if item.titleInfo?.length > 1}
						{#each item.titleInfo.slice(1) as alt}
							<p class="text-sm text-muted-foreground mt-1 break-words">{alt.title} <span class="text-xs">({alt.title_type})</span></p>
						{/each}
					{/if}
					<div class="flex flex-wrap gap-2 mt-3">
						{#if item.typeOfResource}
							<a href={resourceTypeUrl(item.typeOfResource)} class="hover:opacity-80 transition-opacity">
								<Badge class="hover:bg-primary/80 transition-colors">
									{#snippet children()}
										<FileText class="h-3 w-3 mr-1 inline" />{item.typeOfResource}
									{/snippet}
								</Badge>
							</a>
						{/if}
						{#if item.project?.name}
							<a href={projectUrl(item.project.id)} class="hover:opacity-80 transition-opacity">
								<Badge variant="secondary" class="hover:bg-primary/20 transition-colors">
									{#snippet children()}
										<Briefcase class="h-3 w-3 mr-1 inline" />{item.project.name}
									{/snippet}
								</Badge>
							</a>
						{/if}
						{#if item.university}
							{@const uni = universities.find((u) => u.id === item.university)}
							{#if uni}
								<a href={institutionUrl(uni.name)} class="hover:opacity-80 transition-opacity">
									<Badge variant="outline" class="hover:bg-primary/10 transition-colors">
										{#snippet children()}
											<Building2 class="h-3 w-3 mr-1 inline" />{uni.name}
										{/snippet}
									</Badge>
								</a>
							{/if}
						{/if}
						{#each getLanguages(item) as lang}
							<a href={languageUrl(lang)} class="hover:opacity-80 transition-opacity">
								<Badge variant="outline" class="hover:bg-primary/10 transition-colors">
									{#snippet children()}
										<Languages class="h-3 w-3 mr-1 inline" />{languageName(lang)}
									{/snippet}
								</Badge>
							</a>
						{/each}
					</div>
				</div>
			{/snippet}
		</CardHeader>
	{/snippet}
</Card>

<!-- Abstract -->
{#if getAbstract(item)}
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
					<p class="text-sm text-muted-foreground leading-relaxed break-words">{getAbstract(item)}</p>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}

<!-- Contributors -->
{#if getContributors(item).length > 0}
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
						{#each getContributors(item) as contributor}
							<li class="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30">
								<a
									href={contributorUrl(contributor)}
									class="text-sm font-medium text-foreground hover:text-primary transition-colors"
								>
									{contributor.name}
								</a>
								<div class="flex items-center gap-1.5 shrink-0">
									{#if contributor.qualifier !== 'person'}
										<Badge variant="secondary" class="text-[10px]">
											{#snippet children()}{contributor.qualifier}{/snippet}
										</Badge>
									{/if}
									{#if contributor.role}
										<Badge variant="outline" class="text-[10px]">
											{#snippet children()}{contributor.role}{/snippet}
										</Badge>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}

<!-- Subjects -->
{#if getSubjects(item).length > 0}
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
						{#each getSubjects(item) as subject}
							<button onclick={() => onAddSubject?.(subject)}>
								<Badge variant="secondary" class="hover:bg-primary/20 transition-colors">
									{#snippet children()}{subject}{/snippet}
								</Badge>
							</button>
						{/each}
					</div>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}

<!-- Location & Date & Tags -->
{#if getOrigins(item).length > 0 || formatDateInfo(item) || getTags(item).length > 0}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}Details{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<div class="space-y-4">
						{#if getOrigins(item).length > 0}
							<div class="flex items-start gap-3">
								<MapPin class="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
								<div>
									<p class="text-xs font-medium text-muted-foreground mb-1">Origin</p>
									{#each getOrigins(item) as origin}
										<p class="text-sm text-foreground">
											{#if origin.city}<a href={locationUrl(origin.city)} class="hover:text-primary transition-colors">{origin.city}</a>{/if}{#if origin.city && (origin.region || origin.country)},&nbsp;{/if}{#if origin.region}<a href={locationUrl(origin.region)} class="hover:text-primary transition-colors">{origin.region}</a>{/if}{#if origin.region && origin.country},&nbsp;{/if}{#if origin.country}<a href={locationUrl(origin.country)} class="hover:text-primary transition-colors">{origin.country}</a>{/if}
										</p>
									{/each}
								</div>
							</div>
						{/if}
						{#if formatDateInfo(item)}
							<div class="flex items-start gap-3">
								<Calendar class="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
								<div>
									<p class="text-xs font-medium text-muted-foreground mb-1">Date</p>
									<p class="text-sm text-foreground">{formatDateInfo(item)}</p>
								</div>
							</div>
						{/if}
						{#if getTags(item).length > 0}
							<div class="flex items-start gap-3">
								<Tag class="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
								<div>
									<p class="text-xs font-medium text-muted-foreground mb-1">Tags</p>
									<div class="flex flex-wrap gap-1.5">
										{#each getTags(item) as tag}
											<button onclick={() => onAddTag?.(tag)}>
												<Badge variant="outline" class="text-xs hover:bg-accent/20 transition-colors">
													{#snippet children()}{tag}{/snippet}
												</Badge>
											</button>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}

<!-- Map -->
{#if mapMarkers.length > 0}
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
					<MiniMap markers={mapMarkers} />
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}

<!-- Identifiers -->
{#if getIdentifiers(item).length > 0}
	<Card class="overflow-hidden">
		{#snippet children()}
			<CardHeader>
				{#snippet children()}
					<CardTitle class="text-lg">
						{#snippet children()}Identifiers{/snippet}
					</CardTitle>
				{/snippet}
			</CardHeader>
			<CardContent>
				{#snippet children()}
					<div class="space-y-2">
						{#each getIdentifiers(item) as id}
							<div class="flex items-start gap-3 text-sm">
								<span class="text-muted-foreground shrink-0 min-w-[120px]">{id.type}</span>
								<span class="text-foreground font-mono text-xs break-all">{id.value}</span>
							</div>
						{/each}
					</div>
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
{/if}
