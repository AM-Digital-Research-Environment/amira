<script lang="ts">
	import {
		StatCard,
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		Badge,
		Input,
		Pagination,
		BackToList,
		CollectionItemRow,
		Combobox,
		SEO,
		SectionBadge,
		EmptyState,
		WissKILink
	} from '$lib/components/ui';
	import {
		EntityCard,
		EntityBrowseGrid,
		EntityToolbar,
		applyEntitySort,
		type EntitySort
	} from '$lib/components/entity-browse';
	import { projects, allCollections, researchSections, persons } from '$lib/stores/data';
	import { page } from '$app/stores';
	import {
		researchSectionsUrl,
		projectUrl,
		subjectUrl,
		locationUrl,
		languageUrl,
		resourceTypeUrl,
		institutionUrl
	} from '$lib/utils/urls';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import type { Project, CollectionItem } from '$lib/types';
	import { formatDate, getProjectTitle, getItemTitle } from '$lib/utils/helpers';
	import { languageName } from '$lib/utils/languages';
	import { createSearchFilter } from '$lib/utils/search';
	import { paginate } from '$lib/utils/pagination';
	import {
		Users,
		Briefcase,
		BookOpen,
		FileText,
		Building2,
		MapPin,
		Languages,
		Layers,
		UserCheck,
		ExternalLink,
		ArrowUpDown,
		Search
	} from '@lucide/svelte';
	import { formatDateInfo } from '$lib/components/research-items/itemHelpers';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { getWisskiUrl, loadWisskiUrls } from '$lib/utils/wisskiUrl.svelte';
	import { onMount } from 'svelte';
	import { EntityKnowledgeGraph } from '$lib/components/charts';

	onMount(() => {
		void loadWisskiUrls('persons');
	});

	const urlSelection = createUrlSelection('name');

	let searchQuery = $state('');
	let sort = $state<EntitySort>('count-desc');
	let hideNoData = $state(false);
	let selectedRole = $state('');
	let selectedAffiliation = $state('');

	let selectedName = $derived($page.url.searchParams.get('name') ?? '');

	interface PersonData {
		name: string;
		/** Sortable primary metric: projects + collection items contributed to. */
		count: number;
		piOf: Project[];
		memberOf: Project[];
		sections: Set<string>;
		piOfSections: Set<string>;
		spokespersonOfSections: Set<string>;
		affiliations: Set<string>;
		isSectionPI: boolean;
		isSectionSpokesperson: boolean;
		itemCount: number;
	}

	let itemCountsByPerson = $derived.by(() => {
		const counts = new SvelteMap<string, number>();
		$allCollections.forEach((item) => {
			if (!Array.isArray(item.name)) return;
			const seen = new SvelteSet<string>();
			item.name.forEach((n) => {
				if (n?.name?.label && n?.name?.qualifier === 'person' && !seen.has(n.name.label)) {
					seen.add(n.name.label);
					counts.set(n.name.label, (counts.get(n.name.label) || 0) + 1);
				}
			});
		});
		return counts;
	});

	let peopleMap = $derived.by(() => {
		const map = new SvelteMap<string, PersonData>();

		const getOrCreate = (name: string): PersonData => {
			if (!map.has(name)) {
				map.set(name, {
					name,
					count: 0,
					piOf: [],
					memberOf: [],
					sections: new SvelteSet(),
					piOfSections: new SvelteSet(),
					spokespersonOfSections: new SvelteSet(),
					affiliations: new SvelteSet(),
					isSectionPI: false,
					isSectionSpokesperson: false,
					itemCount: 0
				});
			}
			return map.get(name)!;
		};

		$projects.forEach((p) => {
			(p.pi || []).forEach((name) => {
				if (typeof name !== 'string') return;
				const person = getOrCreate(name);
				person.piOf.push(p);
				p.researchSection?.forEach((s) => person.sections.add(s));
			});
			if (Array.isArray(p.members)) {
				p.members.forEach((name) => {
					if (typeof name !== 'string') return;
					const person = getOrCreate(name);
					person.memberOf.push(p);
					p.researchSection?.forEach((s) => person.sections.add(s));
				});
			}
		});

		const projectSectionsById = new SvelteMap<string, string[]>();
		$projects.forEach((p) => {
			if (p.id && p.researchSection?.length) {
				projectSectionsById.set(p.id, p.researchSection);
			}
		});

		$allCollections.forEach((item) => {
			if (!Array.isArray(item.name)) return;
			const itemSections = projectSectionsById.get(item.project?.id || '') ?? [];
			item.name.forEach((n) => {
				if (n?.name?.label && n?.name?.qualifier === 'person') {
					const person = getOrCreate(n.name.label);
					if (Array.isArray(n.affl)) {
						n.affl.forEach((a) => {
							if (a) person.affiliations.add(a);
						});
					}
					itemSections.forEach((s) => person.sections.add(s));
				}
			});
		});

		$persons.forEach((p) => {
			if (p.name && Array.isArray(p.affiliation)) {
				const person = getOrCreate(p.name);
				p.affiliation.forEach((a) => {
					if (a) person.affiliations.add(a);
				});
			}
		});

		Object.entries($researchSections).forEach(([sectionName, info]) => {
			(info.principalInvestigators || []).forEach((name) => {
				const person = getOrCreate(name);
				person.isSectionPI = true;
				person.sections.add(sectionName);
				person.piOfSections.add(sectionName);
			});
			if (info.spokesperson) {
				const person = getOrCreate(info.spokesperson);
				person.isSectionSpokesperson = true;
				person.sections.add(sectionName);
				person.spokespersonOfSections.add(sectionName);
			}
			(info.members || []).forEach((name) => {
				const person = getOrCreate(name);
				person.sections.add(sectionName);
			});
		});

		// Finalize count: items + projects (as PI or member)
		map.forEach((person) => {
			person.itemCount = itemCountsByPerson.get(person.name) || 0;
			person.count = person.itemCount + person.piOf.length + person.memberOf.length;
		});

		return map;
	});

	function personHasData(p: PersonData): boolean {
		return (
			p.piOf.length > 0 ||
			p.memberOf.length > 0 ||
			p.sections.size > 0 ||
			p.affiliations.size > 0 ||
			p.isSectionPI ||
			p.isSectionSpokesperson ||
			p.itemCount > 0
		);
	}

	let personRolesMap = $derived.by(() => {
		const map = new SvelteMap<string, Set<string>>();
		$allCollections.forEach((item) => {
			if (!Array.isArray(item.name)) return;
			item.name.forEach((n) => {
				if (n?.name?.label && n?.name?.qualifier === 'person' && n.role) {
					if (!map.has(n.name.label)) map.set(n.name.label, new SvelteSet());
					map.get(n.name.label)!.add(n.role);
				}
			});
		});
		return map;
	});

	let allRolesWithCounts = $derived.by(() => {
		const counts = new SvelteMap<string, number>();
		for (const roles of personRolesMap.values()) {
			for (const role of roles) {
				counts.set(role, (counts.get(role) || 0) + 1);
			}
		}
		return Array.from(counts.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([name, count]) => ({ name, count }));
	});

	let people = $derived(Array.from(peopleMap.values()));

	let allAffiliationsWithCounts = $derived.by(() => {
		const counts = new SvelteMap<string, number>();
		for (const person of people) {
			for (const aff of person.affiliations) {
				counts.set(aff, (counts.get(aff) || 0) + 1);
			}
		}
		return Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.map(([name, count]) => ({ name, count }));
	});

	const searchPeople = createSearchFilter<PersonData>([(p) => p.name]);

	let filteredPeople = $derived.by(() => {
		let result = searchPeople(people, searchQuery);
		if (hideNoData) {
			result = result.filter(personHasData);
		}
		if (selectedRole) {
			result = result.filter((p) => personRolesMap.get(p.name)?.has(selectedRole));
		}
		if (selectedAffiliation) {
			result = result.filter((p) => p.affiliations.has(selectedAffiliation));
		}
		return applyEntitySort(result, sort);
	});

	let noDataCount = $derived(people.filter((p) => !personHasData(p)).length);

	let selectedPerson = $derived(selectedName ? peopleMap.get(selectedName) || null : null);

	let personCollectionItems = $derived.by((): CollectionItem[] => {
		if (!selectedPerson) return [];
		const name = selectedPerson.name;
		return $allCollections.filter(
			(item) => Array.isArray(item.name) && item.name.some((n) => n?.name?.label === name)
		);
	});

	let itemSearchQuery = $state('');
	let itemTypeFilter = $state('');
	let itemSortBy = $state<'title' | 'date' | 'type'>('title');
	let itemSortAsc = $state(true);

	let itemResourceTypes = $derived.by(() => {
		const types = new SvelteSet<string>();
		personCollectionItems.forEach((item) => {
			if (item.typeOfResource) types.add(item.typeOfResource);
		});
		return Array.from(types).sort();
	});

	let filteredCollectionItems = $derived.by((): CollectionItem[] => {
		let items = personCollectionItems;

		if (itemSearchQuery) {
			const q = itemSearchQuery.toLowerCase();
			items = items.filter(
				(item) =>
					getItemTitle(item).toLowerCase().includes(q) ||
					item.typeOfResource?.toLowerCase().includes(q) ||
					item.language?.some((l) => languageName(l).toLowerCase().includes(q))
			);
		}

		if (itemTypeFilter) {
			items = items.filter((item) => item.typeOfResource === itemTypeFilter);
		}

		items = [...items].sort((a, b) => {
			let cmp = 0;
			if (itemSortBy === 'title') {
				cmp = getItemTitle(a).localeCompare(getItemTitle(b));
			} else if (itemSortBy === 'type') {
				cmp = (a.typeOfResource || '').localeCompare(b.typeOfResource || '');
			} else if (itemSortBy === 'date') {
				const getTime = (item: CollectionItem) => {
					const d =
						item.dateInfo?.issue?.start ||
						item.dateInfo?.created?.start ||
						item.dateInfo?.captured?.start ||
						item.dateInfo?.other?.start;
					return d ? new Date(d).getTime() : 0;
				};
				cmp = getTime(a) - getTime(b);
			}
			if (cmp === 0 && itemSortBy !== 'title') {
				cmp = getItemTitle(a).localeCompare(getItemTitle(b));
			}
			return itemSortAsc ? cmp : -cmp;
		});

		return items;
	});

	const collectionItemsPerPage = 10;
	let collectionPage = $state(0);
	let paginatedCollectionItems = $derived(
		paginate(filteredCollectionItems, collectionPage, collectionItemsPerPage)
	);

	$effect(() => {
		selectedName;
		itemSearchQuery = '';
		itemTypeFilter = '';
		collectionPage = 0;
	});

	$effect(() => {
		itemSearchQuery;
		itemTypeFilter;
		itemSortBy;
		itemSortAsc;
		collectionPage = 0;
	});

	function toggleItemSort(field: 'title' | 'date' | 'type') {
		if (itemSortBy === field) {
			itemSortAsc = !itemSortAsc;
		} else {
			itemSortBy = field;
			itemSortAsc = true;
		}
	}

	function selectPerson(name: string) {
		urlSelection.pushToUrl(name);
		scrollToTop();
	}

	function clearSelection() {
		urlSelection.removeFromUrl();
		scrollToTop();
	}

	function getPersonRole(item: CollectionItem, personName: string): string {
		if (!Array.isArray(item.name)) return '';
		const entry = item.name.find((n) => n?.name?.label === personName);
		return entry?.role || '';
	}

	let personProfile = $derived.by(() => {
		if (!selectedPerson || personCollectionItems.length === 0) return null;

		const roles = new SvelteMap<string, number>();
		const subjects = new SvelteMap<string, number>();
		const languages = new SvelteMap<string, number>();
		const countries = new SvelteMap<string, number>();
		const resourceTypes = new SvelteMap<string, number>();

		for (const item of personCollectionItems) {
			const role = getPersonRole(item, selectedPerson.name);
			if (role) roles.set(role, (roles.get(role) || 0) + 1);

			if (Array.isArray(item.subject)) {
				for (const s of item.subject) {
					const label = s.authLabel || s.origLabel;
					if (label) subjects.set(label, (subjects.get(label) || 0) + 1);
				}
			}

			if (Array.isArray(item.language)) {
				for (const lang of item.language) {
					if (lang) languages.set(lang, (languages.get(lang) || 0) + 1);
				}
			}

			if (item.location?.origin) {
				for (const loc of item.location.origin) {
					if (loc.l1) countries.set(loc.l1, (countries.get(loc.l1) || 0) + 1);
				}
			}

			if (item.typeOfResource) {
				resourceTypes.set(item.typeOfResource, (resourceTypes.get(item.typeOfResource) || 0) + 1);
			}
		}

		const sortDesc = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1]);

		return {
			roles: sortDesc(roles),
			subjects: sortDesc(subjects).slice(0, 15),
			languages: sortDesc(languages),
			countries: sortDesc(countries),
			resourceTypes: sortDesc(resourceTypes)
		};
	});
</script>

<SEO title="People" description="Browse researchers, contributors, and their affiliations" />

<div class="space-y-8 animate-slide-in-up">
	<div>
		<h1 class="page-title">People</h1>
		<p class="page-subtitle">
			Browse researchers, principal investigators, and project members across the cluster
		</p>
	</div>

	{#if selectedPerson}
		<div class="space-y-6">
			<BackToList show={true} onclick={clearSelection} label="Back to people" />

			<!-- Person Header -->
			<Card class="overflow-hidden">
				{#snippet children()}
					<CardHeader>
						{#snippet children()}
							<div class="min-w-0">
								<div class="flex items-center gap-2">
									<Users class="h-6 w-6 text-primary shrink-0" />
									<CardTitle class="break-words">
										{#snippet children()}{selectedPerson.name}{/snippet}
									</CardTitle>
								</div>
								<div class="flex flex-wrap gap-2 mt-3">
									{#if selectedPerson.isSectionPI}
										<Badge>{#snippet children()}Section PI{/snippet}</Badge>
									{/if}
									{#if selectedPerson.isSectionSpokesperson}
										<Badge>{#snippet children()}Spokesperson{/snippet}</Badge>
									{/if}
									{#if selectedPerson.piOf.length > 0}
										<Badge variant="secondary">
											{#snippet children()}PI of {selectedPerson.piOf.length} project{selectedPerson
													.piOf.length !== 1
													? 's'
													: ''}{/snippet}
										</Badge>
									{/if}
									{#if selectedPerson.memberOf.length > 0}
										<Badge variant="secondary">
											{#snippet children()}Member of {selectedPerson.memberOf.length} project{selectedPerson
													.memberOf.length !== 1
													? 's'
													: ''}{/snippet}
										</Badge>
									{/if}
									{#if personCollectionItems.length > 0}
										<Badge variant="outline">
											{#snippet children()}{personCollectionItems.length} research item{personCollectionItems.length !==
												1
													? 's'
													: ''}{/snippet}
										</Badge>
									{/if}
									<WissKILink category="persons" entityKey={selectedPerson.name} />
								</div>
							</div>
						{/snippet}
					</CardHeader>
				{/snippet}
			</Card>

			{#if !personHasData(selectedPerson)}
				{@const wisskiHref = getWisskiUrl('persons', selectedPerson.name)}
				<Card class="overflow-hidden border-dashed">
					{#snippet children()}
						<CardContent>
							{#snippet children()}
								<div class="flex flex-col items-center justify-center py-8 text-center">
									<Users class="h-10 w-10 text-muted-foreground/40 mb-3" />
									<p class="text-sm text-muted-foreground">
										No project, research item, or affiliation data is available for this person in
										the dashboard.
									</p>
									{#if wisskiHref}
										<a
											href={wisskiHref}
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex items-center gap-1.5 mt-3 text-sm text-primary hover:underline"
										>
											<ExternalLink class="h-3.5 w-3.5" />
											View in WissKI
										</a>
									{/if}
								</div>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}

			{#if selectedPerson.affiliations.size > 0}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}
										<span class="flex items-center gap-2">
											<Building2 class="h-5 w-5 text-primary" />
											Affiliations
										</span>
									{/snippet}
								</CardTitle>
							{/snippet}
						</CardHeader>
						<CardContent>
							{#snippet children()}
								<div class="flex flex-wrap gap-2">
									{#each [...selectedPerson.affiliations].sort() as aff (aff)}
										<a href={institutionUrl(aff)} class="hover:opacity-80 transition-opacity">
											<Badge variant="outline" class="hover:bg-primary/10 transition-colors">
												{#snippet children()}{aff}{/snippet}
											</Badge>
										</a>
									{/each}
								</div>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}

			{#if personProfile}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}
										<span class="flex items-center gap-2">
											<UserCheck class="h-5 w-5 text-primary" />
											Research Profile
										</span>
									{/snippet}
								</CardTitle>
							{/snippet}
						</CardHeader>
						<CardContent>
							{#snippet children()}
								<div class="grid gap-4 sm:grid-cols-2">
									{#if personProfile.roles.length > 0}
										<div>
											<h4
												class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2"
											>
												Roles
											</h4>
											<div class="flex flex-wrap gap-1.5">
												{#each personProfile.roles as [role, count] (role)}
													<Badge variant="secondary" class="text-xs">
														{#snippet children()}{role}
															<span class="text-muted-foreground ml-1">({count})</span>{/snippet}
													</Badge>
												{/each}
											</div>
										</div>
									{/if}

									{#if personProfile.resourceTypes.length > 0}
										<div>
											<h4
												class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2"
											>
												Resource Types
											</h4>
											<div class="flex flex-wrap gap-1.5">
												{#each personProfile.resourceTypes as [type, count] (type)}
													<a
														href={resourceTypeUrl(type)}
														class="hover:opacity-80 transition-opacity"
													>
														<Badge
															variant="outline"
															class="text-xs hover:bg-primary/10 transition-colors"
														>
															{#snippet children()}<Layers class="h-3 w-3 mr-1" />{type}
																<span class="text-muted-foreground ml-1">({count})</span>{/snippet}
														</Badge>
													</a>
												{/each}
											</div>
										</div>
									{/if}

									{#if personProfile.languages.length > 0}
										<div>
											<h4
												class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2"
											>
												Languages
											</h4>
											<div class="flex flex-wrap gap-1.5">
												{#each personProfile.languages as [lang, count] (lang)}
													<a href={languageUrl(lang)} class="hover:opacity-80 transition-opacity">
														<Badge
															variant="outline"
															class="text-xs hover:bg-primary/10 transition-colors"
														>
															{#snippet children()}<Languages class="h-3 w-3 mr-1" />{languageName(
																	lang
																)}
																<span class="text-muted-foreground ml-1">({count})</span>{/snippet}
														</Badge>
													</a>
												{/each}
											</div>
										</div>
									{/if}

									{#if personProfile.countries.length > 0}
										<div>
											<h4
												class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2"
											>
												Countries
											</h4>
											<div class="flex flex-wrap gap-1.5">
												{#each personProfile.countries as [country, count] (country)}
													<a
														href={locationUrl(country)}
														class="hover:opacity-80 transition-opacity"
													>
														<Badge
															variant="outline"
															class="text-xs hover:bg-primary/10 transition-colors"
														>
															{#snippet children()}<MapPin class="h-3 w-3 mr-1" />{country}
																<span class="text-muted-foreground ml-1">({count})</span>{/snippet}
														</Badge>
													</a>
												{/each}
											</div>
										</div>
									{/if}
								</div>

								{#if personProfile.subjects.length > 0}
									<div class="mt-4 pt-4 border-t">
										<h4
											class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2"
										>
											Top Subjects
										</h4>
										<div class="flex flex-wrap gap-1.5">
											{#each personProfile.subjects as [subject, count] (subject)}
												<a href={subjectUrl(subject)} class="hover:opacity-80 transition-opacity">
													<Badge
														variant="outline"
														class="text-xs hover:bg-primary/10 transition-colors"
													>
														{#snippet children()}{subject}
															<span class="text-muted-foreground ml-1">({count})</span>{/snippet}
													</Badge>
												</a>
											{/each}
										</div>
									</div>
								{/if}
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}

			{#if selectedPerson.sections.size > 0}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}
										<span class="flex items-center gap-2">
											<BookOpen class="h-5 w-5 text-primary" />
											Research Sections
										</span>
									{/snippet}
								</CardTitle>
							{/snippet}
						</CardHeader>
						<CardContent>
							{#snippet children()}
								<div class="flex flex-wrap gap-2">
									{#each [...selectedPerson.sections].sort() as section (section)}
										{@const isSectionPi = selectedPerson.piOfSections.has(section)}
										{@const isSectionSpokesperson =
											selectedPerson.spokespersonOfSections.has(section)}
										<a
											href={researchSectionsUrl(section)}
											class="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity"
											title={isSectionSpokesperson
												? `Spokesperson of the ${section} section`
												: isSectionPi
													? `PI of the ${section} section`
													: section}
										>
											<SectionBadge {section} />
											{#if isSectionSpokesperson}
												<Badge class="text-2xs">
													{#snippet children()}Spokesperson{/snippet}
												</Badge>
											{:else if isSectionPi}
												<Badge class="text-2xs">
													{#snippet children()}PI{/snippet}
												</Badge>
											{/if}
										</a>
									{/each}
								</div>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}

			{#if selectedPerson.piOf.length > 0}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}
										<span class="flex items-center gap-2">
											<Briefcase class="h-5 w-5 text-primary" />
											Projects as Principal Investigator
										</span>
									{/snippet}
								</CardTitle>
							{/snippet}
						</CardHeader>
						<CardContent>
							{#snippet children()}
								<ul class="space-y-3">
									{#each selectedPerson.piOf as project (project.id)}
										<li class="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
											<Briefcase class="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
											<div class="min-w-0">
												<a
													href={projectUrl(project.id)}
													class="text-sm font-medium text-foreground hover:text-primary transition-colors break-words"
												>
													{getProjectTitle(project)}
												</a>
												<div class="flex flex-wrap items-center gap-2 mt-1">
													{#if project.idShort}
														<span class="text-xs text-muted-foreground font-mono"
															>{project.idShort}</span
														>
													{/if}
													{#if project.date?.start || project.date?.end}
														<span class="text-xs text-muted-foreground">
															{formatDate(project.date.start)}{project.date.end
																? ` – ${formatDate(project.date.end)}`
																: ''}
														</span>
													{/if}
												</div>
												{#if project.researchSection?.length}
													<div class="flex flex-wrap gap-1 mt-1.5">
														{#each project.researchSection as section (section)}
															<a
																href={researchSectionsUrl(section)}
																class="hover:opacity-80 transition-opacity"
															>
																<SectionBadge {section} small />
															</a>
														{/each}
													</div>
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

			{#if selectedPerson.memberOf.length > 0}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}
										<span class="flex items-center gap-2">
											<Users class="h-5 w-5 text-muted-foreground" />
											Projects as Member
										</span>
									{/snippet}
								</CardTitle>
							{/snippet}
						</CardHeader>
						<CardContent>
							{#snippet children()}
								<ul class="space-y-3">
									{#each selectedPerson.memberOf as project (project.id)}
										<li class="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
											<Briefcase class="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
											<div class="min-w-0">
												<a
													href={projectUrl(project.id)}
													class="text-sm font-medium text-foreground hover:text-primary transition-colors break-words"
												>
													{getProjectTitle(project)}
												</a>
												{#if project.idShort}
													<span class="text-xs text-muted-foreground font-mono block mt-0.5"
														>{project.idShort}</span
													>
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

			{#if personCollectionItems.length > 0}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}
										<span class="flex items-center gap-2">
											<FileText class="h-5 w-5 text-muted-foreground" />
											Research Items
											<Badge variant="secondary">
												{#snippet children()}{filteredCollectionItems.length}{#if filteredCollectionItems.length !== personCollectionItems.length}
														/ {personCollectionItems.length}{/if}{/snippet}
											</Badge>
										</span>
									{/snippet}
								</CardTitle>
							{/snippet}
						</CardHeader>
						<CardContent>
							{#snippet children()}
								<div class="flex flex-col sm:flex-row gap-3 mb-4">
									<div class="relative flex-1">
										<Search
											class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
										/>
										<Input
											placeholder="Search items..."
											bind:value={itemSearchQuery}
											class="pl-9"
										/>
									</div>
									<select
										bind:value={itemTypeFilter}
										class="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
									>
										<option value="">All types</option>
										{#each itemResourceTypes as type (type)}
											<option value={type}>{type}</option>
										{/each}
									</select>
								</div>

								<div class="flex items-center gap-1 mb-4 text-xs text-muted-foreground">
									<ArrowUpDown class="h-3.5 w-3.5" />
									<span>Sort by:</span>
									<button
										onclick={() => toggleItemSort('title')}
										class="px-2 py-0.5 rounded transition-colors {itemSortBy === 'title'
											? 'bg-primary/10 text-primary font-medium'
											: 'hover:bg-muted'}"
									>
										Title {itemSortBy === 'title' ? (itemSortAsc ? '↑' : '↓') : ''}
									</button>
									<button
										onclick={() => toggleItemSort('date')}
										class="px-2 py-0.5 rounded transition-colors {itemSortBy === 'date'
											? 'bg-primary/10 text-primary font-medium'
											: 'hover:bg-muted'}"
									>
										Date {itemSortBy === 'date' ? (itemSortAsc ? '↑' : '↓') : ''}
									</button>
									<button
										onclick={() => toggleItemSort('type')}
										class="px-2 py-0.5 rounded transition-colors {itemSortBy === 'type'
											? 'bg-primary/10 text-primary font-medium'
											: 'hover:bg-muted'}"
									>
										Type {itemSortBy === 'type' ? (itemSortAsc ? '↑' : '↓') : ''}
									</button>
								</div>

								{#if filteredCollectionItems.length === 0}
									<EmptyState message="No items match your filters" icon={Search} />
								{:else}
									<ul class="space-y-2">
										{#each paginatedCollectionItems as item (item._id || item.dre_id)}
											<CollectionItemRow {item}>
												{#snippet extraMetadata()}
													{#if getPersonRole(item, selectedPerson.name)}
														<Badge variant="outline" class="text-2xs">
															{#snippet children()}{getPersonRole(
																	item,
																	selectedPerson.name
																)}{/snippet}
														</Badge>
													{/if}
													{#if formatDateInfo(item)}
														<span class="text-xs text-muted-foreground"
															>· {formatDateInfo(item)}</span
														>
													{/if}
												{/snippet}
											</CollectionItemRow>
										{/each}
									</ul>
									<Pagination
										currentPage={collectionPage}
										totalItems={filteredCollectionItems.length}
										itemsPerPage={collectionItemsPerPage}
										onPageChange={(p) => (collectionPage = p)}
									/>
								{/if}
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}

			<EntityKnowledgeGraph
				entityType="person"
				entityId={selectedPerson.name}
				title="Collaboration & influence graph"
			/>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-4">
			<StatCard label="Total People" value={people.length} icon={Users} />
			<StatCard
				label="Principal Investigators"
				value={people.filter((p) => p.piOf.length > 0).length}
				icon={Briefcase}
			/>
			<StatCard
				label="Section PIs"
				value={people.filter((p) => p.isSectionPI).length}
				icon={BookOpen}
			/>
			<StatCard label="Roles" value={allRolesWithCounts.length} icon={UserCheck} />
		</div>

		<!-- Secondary filters (role + affiliation + hide-empty). Kept separate
		     from the main toolbar so this page reads the same as other entity
		     pages; affiliation uses a Combobox because there are often 100+
		     affiliations and a plain <select> is unusable at that length. -->
		<div
			class="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-border/60 bg-card"
		>
			<div class="flex-1 min-w-0 sm:max-w-xs">
				<Combobox
					options={[
						{ value: '', label: 'All affiliations' },
						...allAffiliationsWithCounts.map((a) => ({
							value: a.name,
							label: `${a.name} (${a.count})`,
							title: a.name
						}))
					]}
					value={selectedAffiliation}
					placeholder="Affiliation..."
					onchange={(v) => (selectedAffiliation = v)}
				/>
			</div>
			<select
				value={selectedRole}
				onchange={(e) => (selectedRole = (e.currentTarget as HTMLSelectElement).value)}
				class="h-10 rounded-md border border-input bg-background px-3 text-sm"
			>
				<option value="">All roles</option>
				{#each allRolesWithCounts as role (role.name)}
					<option value={role.name}>{role.name} ({role.count})</option>
				{/each}
			</select>
			{#if noDataCount > 0}
				<label class="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
					<input
						type="checkbox"
						bind:checked={hideNoData}
						class="rounded border-input accent-primary h-3.5 w-3.5"
					/>
					Hide {noDataCount} with no data
				</label>
			{/if}
			{#if selectedRole || selectedAffiliation}
				<button
					type="button"
					onclick={() => {
						selectedRole = '';
						selectedAffiliation = '';
					}}
					class="text-xs text-muted-foreground hover:text-foreground transition-colors"
				>
					Clear filters
				</button>
			{/if}
		</div>

		<EntityToolbar
			{searchQuery}
			onSearchChange={(v) => (searchQuery = v)}
			searchPlaceholder="Search people..."
			{sort}
			onSortChange={(v) => (sort = v)}
			totalCount={filteredPeople.length}
			totalLabel="people"
		/>

		<EntityBrowseGrid
			items={filteredPeople}
			getKey={(p) => p.name}
			emptyMessage="No people match your filters"
			density="comfortable"
		>
			{#snippet card(person)}
				{@const firstAff = [...person.affiliations][0]}
				<EntityCard
					name={person.name}
					subtitle={firstAff}
					description={person.isSectionSpokesperson
						? 'Section spokesperson'
						: person.isSectionPI
							? 'Section PI'
							: person.piOf.length > 0
								? 'Principal investigator'
								: person.memberOf.length > 0
									? 'Project member'
									: 'Contributor'}
					icon={Users}
					onclick={() => selectPerson(person.name)}
				>
					{#snippet meta()}
						{#if person.piOf.length > 0}
							<Badge variant="secondary" class="text-2xs">
								{#snippet children()}PI ×{person.piOf.length}{/snippet}
							</Badge>
						{/if}
						{#if person.itemCount > 0}
							<span class="inline-flex items-center gap-1" title="Research items">
								<FileText class="h-3 w-3" />
								{person.itemCount} item{person.itemCount === 1 ? '' : 's'}
							</span>
						{/if}
						{#if person.affiliations.size > 1}
							<span class="inline-flex items-center gap-1" title="Affiliations">
								<Building2 class="h-3 w-3" />
								+{person.affiliations.size - 1} more
							</span>
						{/if}
					{/snippet}
				</EntityCard>
			{/snippet}
		</EntityBrowseGrid>
	{/if}
</div>
