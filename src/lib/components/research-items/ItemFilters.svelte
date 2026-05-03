<script lang="ts">
	import { Card, CardHeader, CardTitle, CardContent, Badge, Input } from '$lib/components/ui';
	import { Tag, BookOpen, Globe, Briefcase, Languages, Target, HardDrive } from '@lucide/svelte';
	import { languageName } from '$lib/utils/languages';
	import { ItemFilterGroup, ItemFilterTypeSelect } from './filters';

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

	// Local UI state for expand/collapse and per-facet filter search.
	let subjectsExpanded = $state(false);
	let tagsExpanded = $state(false);
	let countriesExpanded = $state(false);
	let projectsExpanded = $state(false);
	let languagesExpanded = $state(false);
	let audiencesExpanded = $state(false);
	let methodsExpanded = $state(false);

	let subjectSearch = $state('');
	let tagSearch = $state('');
	let countrySearch = $state('');
	let projectSearch = $state('');
	let languageSearch = $state('');
	let audienceSearch = $state('');
	let methodSearch = $state('');

	function trimToVisible(
		all: SubjectOrTag[],
		query: string,
		labelize?: (s: string) => string
	): SubjectOrTag[] {
		const q = query.trim().toLowerCase();
		if (!q) return all.slice(0, 30);
		return all
			.filter((s) => {
				const label = labelize ? labelize(s.name) : s.name;
				return label.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
			})
			.slice(0, 30);
	}

	let visibleSubjects = $derived(trimToVisible(allSubjectsWithCounts, subjectSearch));
	let visibleTags = $derived(trimToVisible(allTagsWithCounts, tagSearch));
	let visibleCountries = $derived(trimToVisible(allCountriesWithCounts, countrySearch));
	let visibleProjects = $derived(trimToVisible(allProjectsWithCounts, projectSearch));
	let visibleLanguages = $derived(
		trimToVisible(allLanguagesWithCounts, languageSearch, languageName)
	);
	let visibleAudiences = $derived(trimToVisible(allAudiencesWithCounts, audienceSearch));
	let visibleMethods = $derived(trimToVisible(allMethodsWithCounts, methodSearch));

	// Expose expand state so the parent page can trigger it (e.g. when a
	// pill is added from outside the sidebar).
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

					<ItemFilterTypeSelect {resourceTypes} {selectedType} onChange={onSelectedTypeChange} />

					<ItemFilterGroup
						title="Country"
						icon={Globe}
						theme="chart-3"
						options={visibleCountries}
						totalOptionCount={allCountriesWithCounts.length}
						selected={selectedCountries}
						expanded={countriesExpanded}
						onToggleExpanded={() => (countriesExpanded = !countriesExpanded)}
						onToggle={onToggleCountry}
						onClear={onClearCountries}
						searchValue={countrySearch}
						onSearchChange={(v) => (countrySearch = v)}
						searchPlaceholder="Search countries..."
						searchHideThreshold={11}
					/>

					<ItemFilterGroup
						title="Project"
						icon={Briefcase}
						theme="chart-4"
						options={visibleProjects}
						totalOptionCount={allProjectsWithCounts.length}
						selected={selectedProjects}
						expanded={projectsExpanded}
						onToggleExpanded={() => (projectsExpanded = !projectsExpanded)}
						onToggle={onToggleProject}
						onClear={onClearProjects}
						searchValue={projectSearch}
						onSearchChange={(v) => (projectSearch = v)}
						searchPlaceholder="Search projects..."
						searchHideThreshold={11}
					/>

					<ItemFilterGroup
						title="Language"
						icon={Languages}
						theme="chart-5"
						options={visibleLanguages}
						totalOptionCount={allLanguagesWithCounts.length}
						selected={selectedLanguages}
						expanded={languagesExpanded}
						onToggleExpanded={() => (languagesExpanded = !languagesExpanded)}
						onToggle={onToggleLanguage}
						onClear={onClearLanguages}
						searchValue={languageSearch}
						onSearchChange={(v) => (languageSearch = v)}
						searchPlaceholder="Search languages..."
						searchHideThreshold={11}
						formatLabel={languageName}
					/>

					<ItemFilterGroup
						title="Subjects"
						icon={BookOpen}
						theme="primary"
						options={visibleSubjects}
						totalOptionCount={allSubjectsWithCounts.length}
						selected={selectedSubjects}
						expanded={subjectsExpanded}
						onToggleExpanded={() => (subjectsExpanded = !subjectsExpanded)}
						onToggle={onToggleSubject}
						onClear={onClearSubjects}
						searchValue={subjectSearch}
						onSearchChange={(v) => (subjectSearch = v)}
						searchPlaceholder="Search subjects..."
					/>

					<ItemFilterGroup
						title="Tags"
						icon={Tag}
						theme="accent"
						options={visibleTags}
						totalOptionCount={allTagsWithCounts.length}
						selected={selectedTags}
						expanded={tagsExpanded}
						onToggleExpanded={() => (tagsExpanded = !tagsExpanded)}
						onToggle={onToggleTag}
						onClear={onClearTags}
						searchValue={tagSearch}
						onSearchChange={(v) => (tagSearch = v)}
						searchPlaceholder="Search tags..."
					/>

					<ItemFilterGroup
						title="Target Audience"
						icon={Target}
						theme="chart-2"
						options={visibleAudiences}
						totalOptionCount={allAudiencesWithCounts.length}
						selected={selectedAudiences}
						expanded={audiencesExpanded}
						onToggleExpanded={() => (audiencesExpanded = !audiencesExpanded)}
						onToggle={onToggleAudience}
						onClear={onClearAudiences}
						searchValue={audienceSearch}
						onSearchChange={(v) => (audienceSearch = v)}
						searchPlaceholder="Search audiences..."
						searchHideThreshold={11}
					/>

					<ItemFilterGroup
						title="Digitization Method"
						icon={HardDrive}
						theme="chart-1"
						options={visibleMethods}
						totalOptionCount={allMethodsWithCounts.length}
						selected={selectedMethods}
						expanded={methodsExpanded}
						onToggleExpanded={() => (methodsExpanded = !methodsExpanded)}
						onToggle={onToggleMethod}
						onClear={onClearMethods}
						searchValue={methodSearch}
						onSearchChange={(v) => (methodSearch = v)}
						searchEnabled={false}
					/>
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
