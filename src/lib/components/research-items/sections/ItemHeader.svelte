<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent, WissKILink } from '$lib/components/ui';
	import {
		institutionUrl,
		projectUrl,
		languageUrl,
		resourceTypeUrl,
		genreUrl
	} from '$lib/utils/urls';
	import { languageName } from '$lib/utils/languages';
	import type { CollectionItem } from '$lib/types';
	import { universities } from '$lib/types';
	import { EXTERNAL_SOURCE_ID } from '$lib/utils/loaders';
	import { getItemTitle } from '$lib/utils/helpers';
	import { FileText, Calendar, Languages, Building2, Briefcase, BookType } from '@lucide/svelte';
	import { getLanguages, getGenre } from '$lib/utils/transforms/itemExtractors';
	import { getAllDates } from '$lib/utils/transforms/itemFormatters';

	interface Props {
		item: CollectionItem;
	}

	let { item }: Props = $props();

	let allDates = $derived(getAllDates(item));
	let languages = $derived(getLanguages(item));
	let genre = $derived(getGenre(item));
	let universityRecord = $derived(
		item.university ? universities.find((u) => u.id === item.university) : undefined
	);
</script>

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
						{#if universityRecord}
							<div class="flex items-center gap-2">
								<Building2 class="h-4 w-4 text-muted-foreground shrink-0" />
								<span class="text-muted-foreground shrink-0">Institution</span>
								<a
									href={institutionUrl(universityRecord.name)}
									class="text-foreground hover:text-primary transition-colors truncate"
								>
									{universityRecord.name}
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
					{#if languages.length > 0}
						<div class="flex items-center gap-2">
							<Languages class="h-4 w-4 text-muted-foreground shrink-0" />
							<span class="text-muted-foreground shrink-0">Language</span>
							<span class="text-foreground">
								{#each languages as lang, i (lang)}
									<a href={languageUrl(lang)} class="hover:text-primary transition-colors"
										>{languageName(lang)}</a
									>{#if i < languages.length - 1},&nbsp;{/if}
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
