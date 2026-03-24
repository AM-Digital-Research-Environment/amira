<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent, Badge, Input } from '$lib/components/ui';
	import { Tag, BookOpen, X, ChevronDown, ChevronUp, Globe, Briefcase, Languages, Target, HardDrive } from '@lucide/svelte';
	import { languageName } from '$lib/utils/languages';

	interface SubjectOrTag {
		name: string;
		count: number;
	}

	interface Props {
		filteredItems: unknown[];
		resourceTypes: string[];
		allSubjectsWithCounts: SubjectOrTag[];
		allTagsWithCounts: SubjectOrTag[];
		allCountriesWithCounts: SubjectOrTag[];
		allProjectsWithCounts: SubjectOrTag[];
		allLanguagesWithCounts: SubjectOrTag[];
		allAudiencesWithCounts: SubjectOrTag[];
		allMethodsWithCounts: SubjectOrTag[];
		searchQuery: string;
		selectedType: string;
		selectedSubjects: string[];
		selectedTags: string[];
		selectedCountries: string[];
		selectedProjects: string[];
		selectedLanguages: string[];
		selectedAudiences: string[];
		selectedMethods: string[];
		onSearchQueryChange: (value: string) => void;
		onSelectedTypeChange: (value: string) => void;
		onToggleSubject: (subject: string) => void;
		onClearSubjects: () => void;
		onToggleTag: (tag: string) => void;
		onClearTags: () => void;
		onToggleCountry: (country: string) => void;
		onClearCountries: () => void;
		onToggleProject: (project: string) => void;
		onClearProjects: () => void;
		onToggleLanguage: (language: string) => void;
		onClearLanguages: () => void;
		onToggleAudience: (audience: string) => void;
		onClearAudiences: () => void;
		onToggleMethod: (method: string) => void;
		onClearMethods: () => void;
		onClearAll: () => void;
		hasActiveFilters: boolean;
	}

	let {
		filteredItems,
		resourceTypes,
		allSubjectsWithCounts,
		allTagsWithCounts,
		allCountriesWithCounts,
		allProjectsWithCounts,
		allLanguagesWithCounts,
		allAudiencesWithCounts,
		allMethodsWithCounts,
		searchQuery,
		selectedType,
		selectedSubjects,
		selectedTags,
		selectedCountries,
		selectedProjects,
		selectedLanguages,
		selectedAudiences,
		selectedMethods,
		onSearchQueryChange,
		onSelectedTypeChange,
		onToggleSubject,
		onClearSubjects,
		onToggleTag,
		onClearTags,
		onToggleCountry,
		onClearCountries,
		onToggleProject,
		onClearProjects,
		onToggleLanguage,
		onClearLanguages,
		onToggleAudience,
		onClearAudiences,
		onToggleMethod,
		onClearMethods,
		onClearAll,
		hasActiveFilters
	}: Props = $props();

	// Local UI state for expand/collapse and filter search
	let subjectsExpanded = $state(false);
	let tagsExpanded = $state(false);
	let countriesExpanded = $state(false);
	let projectsExpanded = $state(false);
	let languagesExpanded = $state(false);
	let subjectSearch = $state('');
	let tagSearch = $state('');
	let countrySearch = $state('');
	let projectSearch = $state('');
	let languageSearch = $state('');
	let audiencesExpanded = $state(false);
	let methodsExpanded = $state(false);
	let audienceSearch = $state('');
	let methodSearch = $state('');

	let filteredSubjectOptions = $derived.by(() => {
		if (!subjectSearch.trim()) return allSubjectsWithCounts.slice(0, 30);
		const q = subjectSearch.toLowerCase();
		return allSubjectsWithCounts.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 30);
	});

	let filteredTagOptions = $derived.by(() => {
		if (!tagSearch.trim()) return allTagsWithCounts.slice(0, 30);
		const q = tagSearch.toLowerCase();
		return allTagsWithCounts.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 30);
	});

	let filteredCountryOptions = $derived.by(() => {
		if (!countrySearch.trim()) return allCountriesWithCounts.slice(0, 30);
		const q = countrySearch.toLowerCase();
		return allCountriesWithCounts.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 30);
	});

	let filteredProjectOptions = $derived.by(() => {
		if (!projectSearch.trim()) return allProjectsWithCounts.slice(0, 30);
		const q = projectSearch.toLowerCase();
		return allProjectsWithCounts.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 30);
	});

	let filteredLanguageOptions = $derived.by(() => {
		if (!languageSearch.trim()) return allLanguagesWithCounts.slice(0, 30);
		const q = languageSearch.toLowerCase();
		return allLanguagesWithCounts.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 30);
	});

	let filteredAudienceOptions = $derived.by(() => {
		if (!audienceSearch.trim()) return allAudiencesWithCounts.slice(0, 30);
		const q = audienceSearch.toLowerCase();
		return allAudiencesWithCounts.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 30);
	});

	let filteredMethodOptions = $derived.by(() => {
		if (!methodSearch.trim()) return allMethodsWithCounts.slice(0, 30);
		const q = methodSearch.toLowerCase();
		return allMethodsWithCounts.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 30);
	});

	// Expose expand state so parent can trigger it
	export function expandSubjects() {
		subjectsExpanded = true;
	}

	export function expandTags() {
		tagsExpanded = true;
	}
</script>

<Card class="lg:sticky lg:top-20 lg:self-start">
	{#snippet children()}
		<CardHeader>
			{#snippet children()}
				<CardTitle>
					{#snippet children()}
						<span class="flex items-center justify-between">
							Filters
							<span class="flex items-center gap-2">
								{#if hasActiveFilters}
									<button
										onclick={onClearAll}
										class="text-xs text-muted-foreground hover:text-foreground transition-colors"
									>
										Clear all
									</button>
								{/if}
								<Badge variant="secondary">
									{#snippet children()}{filteredItems.length} results{/snippet}
								</Badge>
							</span>
						</span>
					{/snippet}
				</CardTitle>
			{/snippet}
		</CardHeader>
		<CardContent>
			{#snippet children()}
				<div class="filter-scroll space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto">
					<Input
						placeholder="Search items..."
						value={searchQuery}
						oninput={(e) => onSearchQueryChange((e.currentTarget as HTMLInputElement).value)}
					/>

					<!-- Type filter -->
					<select
						value={selectedType}
						onchange={(e) => onSelectedTypeChange(e.currentTarget.value)}
						class="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						{#each resourceTypes as type}
							<option value={type}>{type === 'all' ? 'All types' : type}</option>
						{/each}
					</select>

					<!-- Country/Origin filter -->
					<div class="border-t border-border pt-2">
						<button
							onclick={() => countriesExpanded = !countriesExpanded}
							class="flex items-center justify-between w-full text-xs font-medium text-muted-foreground"
						>
							<span class="flex items-center gap-1.5">
								<Globe class="h-3 w-3" />
								Country
								{#if selectedCountries.length > 0}
									<Badge variant="secondary" class="text-[10px] px-1.5 py-0">
										{#snippet children()}{selectedCountries.length}{/snippet}
									</Badge>
								{/if}
							</span>
							{#if countriesExpanded}
								<ChevronUp class="h-3.5 w-3.5" />
							{:else}
								<ChevronDown class="h-3.5 w-3.5" />
							{/if}
						</button>

						{#if selectedCountries.length > 0}
							<div class="flex flex-wrap gap-1.5 mt-2">
								{#each selectedCountries as country}
									<button
										onclick={() => onToggleCountry(country)}
										class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-chart-3/15 text-foreground text-xs font-medium hover:bg-chart-3/25 transition-colors"
									>
										{country}
										<X class="h-3 w-3" />
									</button>
								{/each}
								<button
									onclick={onClearCountries}
									class="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
								>
									Clear
								</button>
							</div>
						{/if}

						{#if countriesExpanded}
							<div class="mt-2 space-y-2">
								{#if allCountriesWithCounts.length > 10}
									<Input placeholder="Search countries..." bind:value={countrySearch} />
								{/if}
								<div class="space-y-0.5 max-h-32 overflow-y-auto">
									{#each filteredCountryOptions as country}
										{@const isActive = selectedCountries.includes(country.name)}
										<button
											onclick={() => onToggleCountry(country.name)}
											class="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted transition-colors flex items-center justify-between gap-2 {isActive ? 'bg-chart-3/10 text-foreground font-medium' : ''}"
										>
											<span class="truncate">{country.name}</span>
											<span class="text-muted-foreground shrink-0">{country.count}</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<!-- Project filter -->
					<div class="border-t border-border pt-2">
						<button
							onclick={() => projectsExpanded = !projectsExpanded}
							class="flex items-center justify-between w-full text-xs font-medium text-muted-foreground"
						>
							<span class="flex items-center gap-1.5">
								<Briefcase class="h-3 w-3" />
								Project
								{#if selectedProjects.length > 0}
									<Badge variant="secondary" class="text-[10px] px-1.5 py-0">
										{#snippet children()}{selectedProjects.length}{/snippet}
									</Badge>
								{/if}
							</span>
							{#if projectsExpanded}
								<ChevronUp class="h-3.5 w-3.5" />
							{:else}
								<ChevronDown class="h-3.5 w-3.5" />
							{/if}
						</button>

						{#if selectedProjects.length > 0}
							<div class="flex flex-wrap gap-1.5 mt-2">
								{#each selectedProjects as project}
									<button
										onclick={() => onToggleProject(project)}
										class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-chart-4/15 text-foreground text-xs font-medium hover:bg-chart-4/25 transition-colors"
									>
										{project}
										<X class="h-3 w-3" />
									</button>
								{/each}
								<button
									onclick={onClearProjects}
									class="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
								>
									Clear
								</button>
							</div>
						{/if}

						{#if projectsExpanded}
							<div class="mt-2 space-y-2">
								{#if allProjectsWithCounts.length > 10}
									<Input placeholder="Search projects..." bind:value={projectSearch} />
								{/if}
								<div class="space-y-0.5 max-h-32 overflow-y-auto">
									{#each filteredProjectOptions as project}
										{@const isActive = selectedProjects.includes(project.name)}
										<button
											onclick={() => onToggleProject(project.name)}
											class="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted transition-colors flex items-center justify-between gap-2 {isActive ? 'bg-chart-4/10 text-foreground font-medium' : ''}"
										>
											<span class="truncate">{project.name}</span>
											<span class="text-muted-foreground shrink-0">{project.count}</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<!-- Language filter -->
					<div class="border-t border-border pt-2">
						<button
							onclick={() => languagesExpanded = !languagesExpanded}
							class="flex items-center justify-between w-full text-xs font-medium text-muted-foreground"
						>
							<span class="flex items-center gap-1.5">
								<Languages class="h-3 w-3" />
								Language
								{#if selectedLanguages.length > 0}
									<Badge variant="secondary" class="text-[10px] px-1.5 py-0">
										{#snippet children()}{selectedLanguages.length}{/snippet}
									</Badge>
								{/if}
							</span>
							{#if languagesExpanded}
								<ChevronUp class="h-3.5 w-3.5" />
							{:else}
								<ChevronDown class="h-3.5 w-3.5" />
							{/if}
						</button>

						{#if selectedLanguages.length > 0}
							<div class="flex flex-wrap gap-1.5 mt-2">
								{#each selectedLanguages as lang}
									<button
										onclick={() => onToggleLanguage(lang)}
										class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-chart-5/15 text-foreground text-xs font-medium hover:bg-chart-5/25 transition-colors"
									>
										{languageName(lang)}
										<X class="h-3 w-3" />
									</button>
								{/each}
								<button
									onclick={onClearLanguages}
									class="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
								>
									Clear
								</button>
							</div>
						{/if}

						{#if languagesExpanded}
							<div class="mt-2 space-y-2">
								{#if allLanguagesWithCounts.length > 10}
									<Input placeholder="Search languages..." bind:value={languageSearch} />
								{/if}
								<div class="space-y-0.5 max-h-32 overflow-y-auto">
									{#each filteredLanguageOptions as lang}
										{@const isActive = selectedLanguages.includes(lang.name)}
										<button
											onclick={() => onToggleLanguage(lang.name)}
											class="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted transition-colors flex items-center justify-between gap-2 {isActive ? 'bg-chart-5/10 text-foreground font-medium' : ''}"
										>
											<span class="truncate">{languageName(lang.name)}</span>
											<span class="text-muted-foreground shrink-0">{lang.count}</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<!-- Subjects filter (LCSH controlled vocabulary) -->
					<div class="border-t border-border pt-2">
						<button
							onclick={() => subjectsExpanded = !subjectsExpanded}
							class="flex items-center justify-between w-full text-xs font-medium text-muted-foreground"
						>
							<span class="flex items-center gap-1.5">
								<BookOpen class="h-3 w-3" />
								Subjects
								{#if selectedSubjects.length > 0}
									<Badge variant="secondary" class="text-[10px] px-1.5 py-0">
										{#snippet children()}{selectedSubjects.length}{/snippet}
									</Badge>
								{/if}
							</span>
							{#if subjectsExpanded}
								<ChevronUp class="h-3.5 w-3.5" />
							{:else}
								<ChevronDown class="h-3.5 w-3.5" />
							{/if}
						</button>

						{#if selectedSubjects.length > 0}
							<div class="flex flex-wrap gap-1.5 mt-2">
								{#each selectedSubjects as subject}
									<button
										onclick={() => onToggleSubject(subject)}
										class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25 transition-colors"
									>
										{subject}
										<X class="h-3 w-3" />
									</button>
								{/each}
								<button
									onclick={onClearSubjects}
									class="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
								>
									Clear
								</button>
							</div>
						{/if}

						{#if subjectsExpanded}
							<div class="mt-2 space-y-2">
								<Input
									placeholder="Search subjects..."
									bind:value={subjectSearch}
								/>
								<div class="space-y-0.5 max-h-32 overflow-y-auto">
									{#each filteredSubjectOptions as subject}
										{@const isActive = selectedSubjects.includes(subject.name)}
										<button
											onclick={() => onToggleSubject(subject.name)}
											class="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted transition-colors flex items-center justify-between gap-2 {isActive ? 'bg-primary/10 text-primary' : ''}"
										>
											<span class="truncate">{subject.name}</span>
											<span class="text-muted-foreground shrink-0">{subject.count}</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<!-- Tags filter (free-form keywords) -->
					<div class="border-t border-border pt-2">
						<button
							onclick={() => tagsExpanded = !tagsExpanded}
							class="flex items-center justify-between w-full text-xs font-medium text-muted-foreground"
						>
							<span class="flex items-center gap-1.5">
								<Tag class="h-3 w-3" />
								Tags
								{#if selectedTags.length > 0}
									<Badge variant="secondary" class="text-[10px] px-1.5 py-0">
										{#snippet children()}{selectedTags.length}{/snippet}
									</Badge>
								{/if}
							</span>
							{#if tagsExpanded}
								<ChevronUp class="h-3.5 w-3.5" />
							{:else}
								<ChevronDown class="h-3.5 w-3.5" />
							{/if}
						</button>

						{#if selectedTags.length > 0}
							<div class="flex flex-wrap gap-1.5 mt-2">
								{#each selectedTags as tag}
									<button
										onclick={() => onToggleTag(tag)}
										class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/30 text-accent-foreground text-xs font-medium hover:bg-accent/50 transition-colors"
									>
										{tag}
										<X class="h-3 w-3" />
									</button>
								{/each}
								<button
									onclick={onClearTags}
									class="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
								>
									Clear
								</button>
							</div>
						{/if}

						{#if tagsExpanded}
							<div class="mt-2 space-y-2">
								<Input
									placeholder="Search tags..."
									bind:value={tagSearch}
								/>
								<div class="space-y-0.5 max-h-32 overflow-y-auto">
									{#each filteredTagOptions as tag}
										{@const isActive = selectedTags.includes(tag.name)}
										<button
											onclick={() => onToggleTag(tag.name)}
											class="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted transition-colors flex items-center justify-between gap-2 {isActive ? 'bg-accent/20 text-accent-foreground' : ''}"
										>
											<span class="truncate">{tag.name}</span>
											<span class="text-muted-foreground shrink-0">{tag.count}</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<!-- Target Audience filter -->
					<div class="border-t border-border pt-2">
						<button
							onclick={() => audiencesExpanded = !audiencesExpanded}
							class="flex items-center justify-between w-full text-xs font-medium text-muted-foreground"
						>
							<span class="flex items-center gap-1.5">
								<Target class="h-3 w-3" />
								Target Audience
								{#if selectedAudiences.length > 0}
									<Badge variant="secondary" class="text-[10px] px-1.5 py-0">
										{#snippet children()}{selectedAudiences.length}{/snippet}
									</Badge>
								{/if}
							</span>
							{#if audiencesExpanded}
								<ChevronUp class="h-3.5 w-3.5" />
							{:else}
								<ChevronDown class="h-3.5 w-3.5" />
							{/if}
						</button>

						{#if selectedAudiences.length > 0}
							<div class="flex flex-wrap gap-1.5 mt-2">
								{#each selectedAudiences as audience}
									<button
										onclick={() => onToggleAudience(audience)}
										class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-chart-2/15 text-foreground text-xs font-medium hover:bg-chart-2/25 transition-colors"
									>
										{audience}
										<X class="h-3 w-3" />
									</button>
								{/each}
								<button
									onclick={onClearAudiences}
									class="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
								>
									Clear
								</button>
							</div>
						{/if}

						{#if audiencesExpanded}
							<div class="mt-2 space-y-2">
								{#if allAudiencesWithCounts.length > 10}
									<Input placeholder="Search audiences..." bind:value={audienceSearch} />
								{/if}
								<div class="space-y-0.5 max-h-32 overflow-y-auto">
									{#each filteredAudienceOptions as audience}
										{@const isActive = selectedAudiences.includes(audience.name)}
										<button
											onclick={() => onToggleAudience(audience.name)}
											class="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted transition-colors flex items-center justify-between gap-2 {isActive ? 'bg-chart-2/10 text-foreground font-medium' : ''}"
										>
											<span class="truncate">{audience.name}</span>
											<span class="text-muted-foreground shrink-0">{audience.count}</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<!-- Digitization Method filter -->
					<div class="border-t border-border pt-2">
						<button
							onclick={() => methodsExpanded = !methodsExpanded}
							class="flex items-center justify-between w-full text-xs font-medium text-muted-foreground"
						>
							<span class="flex items-center gap-1.5">
								<HardDrive class="h-3 w-3" />
								Digitization Method
								{#if selectedMethods.length > 0}
									<Badge variant="secondary" class="text-[10px] px-1.5 py-0">
										{#snippet children()}{selectedMethods.length}{/snippet}
									</Badge>
								{/if}
							</span>
							{#if methodsExpanded}
								<ChevronUp class="h-3.5 w-3.5" />
							{:else}
								<ChevronDown class="h-3.5 w-3.5" />
							{/if}
						</button>

						{#if selectedMethods.length > 0}
							<div class="flex flex-wrap gap-1.5 mt-2">
								{#each selectedMethods as method}
									<button
										onclick={() => onToggleMethod(method)}
										class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-chart-1/15 text-foreground text-xs font-medium hover:bg-chart-1/25 transition-colors"
									>
										{method}
										<X class="h-3 w-3" />
									</button>
								{/each}
								<button
									onclick={onClearMethods}
									class="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
								>
									Clear
								</button>
							</div>
						{/if}

						{#if methodsExpanded}
							<div class="mt-2 space-y-2">
								<div class="space-y-0.5 max-h-32 overflow-y-auto">
									{#each filteredMethodOptions as method}
										{@const isActive = selectedMethods.includes(method.name)}
										<button
											onclick={() => onToggleMethod(method.name)}
											class="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted transition-colors flex items-center justify-between gap-2 {isActive ? 'bg-chart-1/10 text-foreground font-medium' : ''}"
										>
											<span class="truncate">{method.name}</span>
											<span class="text-muted-foreground shrink-0">{method.count}</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/snippet}
		</CardContent>
	{/snippet}
</Card>

<style>
	/* Inset focus ring so it isn't clipped by the overflow-y-auto scroll container */
	.filter-scroll :global(input:focus-visible),
	.filter-scroll :global(select:focus-visible) {
		outline: none;
		box-shadow: inset 0 0 0 1px hsl(var(--ring));
		border-color: hsl(var(--ring));
		--tw-ring-offset-width: 0px;
		--tw-ring-shadow: 0 0 #0000;
	}
</style>
