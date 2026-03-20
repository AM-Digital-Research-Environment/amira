<script lang="ts">
	import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, Input, Pagination, BackToList, CollectionItemRow, SEO } from '$lib/components/ui';
	import { projects, allCollections, researchSections, persons } from '$lib/stores/data';
	import { page } from '$app/stores';
	import { researchSectionsUrl, projectUrl, subjectUrl, locationUrl, languageUrl, resourceTypeUrl } from '$lib/utils/urls';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import type { Project, CollectionItem } from '$lib/types';
	import { formatDate, getProjectTitle } from '$lib/utils/helpers';
	import { languageName } from '$lib/utils/languages';
	import { createSearchFilter } from '$lib/utils/search';
	import { paginate } from '$lib/utils/pagination';
	import { Users, Briefcase, BookOpen, FileText, Building2, Tag, MapPin, Languages, Layers, UserCheck, ExternalLink } from '@lucide/svelte';
	import { institutionUrl } from '$lib/utils/urls';
	import { WissKILink } from '$lib/components/ui';
	import { getWisskiUrl } from '$lib/utils/wisskiUrl';

	const urlSelection = createUrlSelection('name');

	let searchQuery = $state('');
	let selectedName = $state('');

	// Sync from URL query param on navigation (e.g. coming from research sections page)
	$effect(() => {
		const urlName = $page.url.searchParams.get('name');
		if (urlName) selectedName = urlName;
	});

	// Build people index from projects
	interface PersonData {
		name: string;
		piOf: Project[];
		memberOf: Project[];
		sections: Set<string>;
		affiliations: Set<string>;
		isSectionPI: boolean;
	}

	let peopleMap = $derived.by(() => {
		const map = new Map<string, PersonData>();

		const getOrCreate = (name: string): PersonData => {
			if (!map.has(name)) {
				map.set(name, { name, piOf: [], memberOf: [], sections: new Set(), affiliations: new Set(), isSectionPI: false });
			}
			return map.get(name)!;
		};

		// From projects
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

		// From collection item contributors (persons only) + their affiliations
		$allCollections.forEach((item) => {
			if (!Array.isArray(item.name)) return;
			item.name.forEach((n) => {
				if (n?.name?.label && n?.name?.qualifier === 'person') {
					const person = getOrCreate(n.name.label);
					if (Array.isArray(n.affl)) {
						n.affl.forEach((a) => { if (a) person.affiliations.add(a); });
					}
				}
			});
		});

		// From persons store
		$persons.forEach((p) => {
			if (p.name && Array.isArray(p.affiliation)) {
				const person = getOrCreate(p.name);
				p.affiliation.forEach((a) => { if (a) person.affiliations.add(a); });
			}
		});

		// Mark research section PIs and members
		Object.entries($researchSections).forEach(([sectionName, info]) => {
			(info.principalInvestigators || []).forEach((name) => {
				const person = getOrCreate(name);
				person.isSectionPI = true;
				person.sections.add(sectionName);
			});
			(info.members || []).forEach((name) => {
				const person = getOrCreate(name);
				person.sections.add(sectionName);
			});
		});

		return map;
	});

	/** Check if a person has any dashboard data beyond just existing in the persons store */
	function personHasData(p: PersonData): boolean {
		return p.piOf.length > 0
			|| p.memberOf.length > 0
			|| p.sections.size > 0
			|| p.affiliations.size > 0
			|| p.isSectionPI;
	}

	// Also check collection items for people that otherwise have no data
	let peopleWithCollectionItems = $derived.by(() => {
		const names = new Set<string>();
		$allCollections.forEach((item) => {
			if (Array.isArray(item.name)) {
				item.name.forEach((n) => {
					if (n?.name?.label && n?.name?.qualifier === 'person') {
						names.add(n.name.label);
					}
				});
			}
		});
		return names;
	});

	function personHasAnyData(p: PersonData): boolean {
		return personHasData(p) || peopleWithCollectionItems.has(p.name);
	}

	let personRolesMap = $derived.by(() => {
		const map = new Map<string, Set<string>>();
		$allCollections.forEach((item) => {
			if (!Array.isArray(item.name)) return;
			item.name.forEach((n) => {
				if (n?.name?.label && n?.name?.qualifier === 'person' && n.role) {
					if (!map.has(n.name.label)) map.set(n.name.label, new Set());
					map.get(n.name.label)!.add(n.role);
				}
			});
		});
		return map;
	});

	let allRolesWithCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const roles of personRolesMap.values()) {
			for (const role of roles) {
				counts.set(role, (counts.get(role) || 0) + 1);
			}
		}
		return Array.from(counts.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([name, count]) => ({ name, count }));
	});

	let people = $derived(
		Array.from(peopleMap.values()).sort((a, b) => a.name.localeCompare(b.name))
	);

	let hideNoData = $state(false);
	let selectedRole = $state('');

	const searchPeople = createSearchFilter<PersonData>([(p) => p.name]);

	let filteredPeople = $derived.by(() => {
		let result = searchPeople(people, searchQuery);
		if (hideNoData) {
			result = result.filter(personHasAnyData);
		}
		if (selectedRole) {
			result = result.filter((p) => personRolesMap.get(p.name)?.has(selectedRole));
		}
		return result;
	});

	let noDataCount = $derived(people.filter((p) => !personHasAnyData(p)).length);

	// Selected person's data
	let selectedPerson = $derived(selectedName ? peopleMap.get(selectedName) || null : null);

	// Collection items for selected person
	let personCollectionItems = $derived.by((): CollectionItem[] => {
		if (!selectedPerson) return [];
		const name = selectedPerson.name;
		return $allCollections.filter((item) =>
			Array.isArray(item.name) && item.name.some((n) => n?.name?.label === name)
		);
	});

	// Pagination for collection items
	const collectionItemsPerPage = 10;
	let collectionPage = $state(0);
	let paginatedCollectionItems = $derived(paginate(personCollectionItems, collectionPage, collectionItemsPerPage));

	// Reset pagination when person changes
	$effect(() => {
		selectedName;
		collectionPage = 0;
	});

	function selectPerson(name: string) {
		selectedName = name;
		urlSelection.pushToUrl(name);
		scrollToTop();
	}

	function clearSelection() {
		selectedName = '';
		urlSelection.removeFromUrl();
		scrollToTop();
	}

	function getPersonRole(item: CollectionItem, personName: string): string {
		if (!Array.isArray(item.name)) return '';
		const entry = item.name.find((n) => n?.name?.label === personName);
		return entry?.role || '';
	}

	// Research profile derived from collection items
	let personProfile = $derived.by(() => {
		if (!selectedPerson || personCollectionItems.length === 0) return null;

		const roles = new Map<string, number>();
		const subjects = new Map<string, number>();
		const languages = new Map<string, number>();
		const countries = new Map<string, number>();
		const resourceTypes = new Map<string, number>();

		for (const item of personCollectionItems) {
			// Roles
			const role = getPersonRole(item, selectedPerson.name);
			if (role) roles.set(role, (roles.get(role) || 0) + 1);

			// Subjects
			if (Array.isArray(item.subject)) {
				for (const s of item.subject) {
					const label = s.authLabel || s.origLabel;
					if (label) subjects.set(label, (subjects.get(label) || 0) + 1);
				}
			}

			// Languages
			if (Array.isArray(item.language)) {
				for (const lang of item.language) {
					if (lang) languages.set(lang, (languages.get(lang) || 0) + 1);
				}
			}

			// Locations (countries)
			if (item.location?.origin) {
				for (const loc of item.location.origin) {
					if (loc.l1) countries.set(loc.l1, (countries.get(loc.l1) || 0) + 1);
				}
			}

			// Resource types
			if (item.typeOfResource) {
				resourceTypes.set(item.typeOfResource, (resourceTypes.get(item.typeOfResource) || 0) + 1);
			}
		}

		const sortDesc = (map: Map<string, number>) =>
			[...map.entries()].sort((a, b) => b[1] - a[1]);

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
	<!-- Header -->
	<div>
		<h1 class="page-title">People</h1>
		<p class="page-subtitle">Browse researchers, principal investigators, and project members across the cluster</p>
	</div>

	<!-- Stats -->
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
		<StatCard
			label="Roles"
			value={allRolesWithCounts.length}
			icon={UserCheck}
		/>
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- People List -->
		<Card class="lg:col-span-1 lg:sticky lg:top-20 lg:self-start overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle>
							{#snippet children()}
								<BackToList show={!!selectedName} onclick={clearSelection} />
								<span class="flex items-center justify-between">
									People
									<Badge variant="secondary">
										{#snippet children()}{filteredPeople.length}{/snippet}
									</Badge>
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="space-y-3">
							<Input
								placeholder="Search people..."
								bind:value={searchQuery}
							/>
							<select
								value={selectedRole}
								onchange={(e) => selectedRole = (e.currentTarget as HTMLSelectElement).value}
								class="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
							>
								<option value="">All roles</option>
								{#each allRolesWithCounts as role}
									<option value={role.name}>{role.name} ({role.count})</option>
								{/each}
							</select>
							{#if noDataCount > 0}
								<label class="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
									<input
										type="checkbox"
										bind:checked={hideNoData}
										class="rounded border-input accent-primary h-3.5 w-3.5"
									/>
									Hide {noDataCount} with no data
								</label>
							{/if}
							<div class="space-y-0.5 max-h-[60vh] overflow-y-auto">
								{#each filteredPeople as person}
									{@const isSelected = selectedName === person.name}
									<button
										onclick={() => selectPerson(person.name)}
										class="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors flex items-center justify-between gap-2 {isSelected ? 'bg-primary/10 text-primary font-medium' : ''}"
									>
										<span class="truncate">{person.name}</span>
										<span class="flex items-center gap-1.5 shrink-0">
											{#if person.isSectionPI}
												<BookOpen class="h-3 w-3 text-primary" />
											{/if}
											{#if person.piOf.length > 0}
												<Badge variant="secondary" class="text-[10px] px-1.5 py-0">
													{#snippet children()}PI{/snippet}
												</Badge>
											{/if}
										</span>
									</button>
								{/each}
							</div>
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>

		<!-- Person Detail -->
		<div class="lg:col-span-2 space-y-6">
			{#if selectedPerson}
				<!-- Person Header -->
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<div class="flex items-start justify-between gap-3 min-w-0">
									<div class="min-w-0">
										<CardTitle class="break-words">
											{#snippet children()}{selectedPerson.name}{/snippet}
										</CardTitle>
										<div class="flex flex-wrap gap-2 mt-2">
											{#if selectedPerson.isSectionPI}
												<Badge>
													{#snippet children()}Section PI{/snippet}
												</Badge>
											{/if}
											{#if selectedPerson.piOf.length > 0}
												<Badge variant="secondary">
													{#snippet children()}PI of {selectedPerson.piOf.length} project{selectedPerson.piOf.length !== 1 ? 's' : ''}{/snippet}
												</Badge>
											{/if}
											{#if selectedPerson.memberOf.length > 0}
												<Badge variant="secondary">
													{#snippet children()}Member of {selectedPerson.memberOf.length} project{selectedPerson.memberOf.length !== 1 ? 's' : ''}{/snippet}
												</Badge>
											{/if}
											{#if personCollectionItems.length > 0}
												<Badge variant="outline">
													{#snippet children()}{personCollectionItems.length} research item{personCollectionItems.length !== 1 ? 's' : ''}{/snippet}
												</Badge>
											{/if}
											<WissKILink category="persons" entityKey={selectedPerson.name} />
										</div>
									</div>
								</div>
							{/snippet}
						</CardHeader>
					{/snippet}
				</Card>

				<!-- No dashboard data notice -->
				{#if !personHasAnyData(selectedPerson) && personCollectionItems.length === 0}
					{@const wisskiHref = getWisskiUrl('persons', selectedPerson.name)}
					<Card class="overflow-hidden border-dashed">
						{#snippet children()}
							<CardContent>
								{#snippet children()}
									<div class="flex flex-col items-center justify-center py-8 text-center">
										<Users class="h-10 w-10 text-muted-foreground/40 mb-3" />
										<p class="text-sm text-muted-foreground">
											No project, research item, or affiliation data is available for this person in the dashboard.
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

				<!-- Affiliations -->
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
										{#each [...selectedPerson.affiliations].sort() as aff}
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

				<!-- Research Profile (derived from collection items) -->
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
										<!-- Roles -->
										{#if personProfile.roles.length > 0}
											<div>
												<h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Roles</h4>
												<div class="flex flex-wrap gap-1.5">
													{#each personProfile.roles as [role, count]}
														<Badge variant="secondary" class="text-xs">
															{#snippet children()}{role} <span class="text-muted-foreground ml-1">({count})</span>{/snippet}
														</Badge>
													{/each}
												</div>
											</div>
										{/if}

										<!-- Resource Types -->
										{#if personProfile.resourceTypes.length > 0}
											<div>
												<h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Resource Types</h4>
												<div class="flex flex-wrap gap-1.5">
													{#each personProfile.resourceTypes as [type, count]}
														<a href={resourceTypeUrl(type)} class="hover:opacity-80 transition-opacity">
															<Badge variant="outline" class="text-xs hover:bg-primary/10 transition-colors">
																{#snippet children()}<Layers class="h-3 w-3 mr-1" />{type} <span class="text-muted-foreground ml-1">({count})</span>{/snippet}
															</Badge>
														</a>
													{/each}
												</div>
											</div>
										{/if}

										<!-- Languages -->
										{#if personProfile.languages.length > 0}
											<div>
												<h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Languages</h4>
												<div class="flex flex-wrap gap-1.5">
													{#each personProfile.languages as [lang, count]}
														<a href={languageUrl(lang)} class="hover:opacity-80 transition-opacity">
															<Badge variant="outline" class="text-xs hover:bg-primary/10 transition-colors">
																{#snippet children()}<Languages class="h-3 w-3 mr-1" />{languageName(lang)} <span class="text-muted-foreground ml-1">({count})</span>{/snippet}
															</Badge>
														</a>
													{/each}
												</div>
											</div>
										{/if}

										<!-- Countries -->
										{#if personProfile.countries.length > 0}
											<div>
												<h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Countries</h4>
												<div class="flex flex-wrap gap-1.5">
													{#each personProfile.countries as [country, count]}
														<a href={locationUrl(country)} class="hover:opacity-80 transition-opacity">
															<Badge variant="outline" class="text-xs hover:bg-primary/10 transition-colors">
																{#snippet children()}<MapPin class="h-3 w-3 mr-1" />{country} <span class="text-muted-foreground ml-1">({count})</span>{/snippet}
															</Badge>
														</a>
													{/each}
												</div>
											</div>
										{/if}
									</div>

									<!-- Subjects (full width below) -->
									{#if personProfile.subjects.length > 0}
										<div class="mt-4 pt-4 border-t">
											<h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Top Subjects</h4>
											<div class="flex flex-wrap gap-1.5">
												{#each personProfile.subjects as [subject, count]}
													<a href={subjectUrl(subject)} class="hover:opacity-80 transition-opacity">
														<Badge variant="outline" class="text-xs hover:bg-primary/10 transition-colors">
															{#snippet children()}{subject} <span class="text-muted-foreground ml-1">({count})</span>{/snippet}
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

				<!-- Research Sections -->
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
										{#each [...selectedPerson.sections].sort() as section}
											<a
												href={researchSectionsUrl(section)}
												class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
											>
												{section}
											</a>
										{/each}
									</div>
								{/snippet}
							</CardContent>
						{/snippet}
					</Card>
				{/if}

				<!-- Projects as PI -->
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
										{#each selectedPerson.piOf as project}
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
															<span class="text-xs text-muted-foreground font-mono">{project.idShort}</span>
														{/if}
														{#if project.date?.start || project.date?.end}
															<span class="text-xs text-muted-foreground">
																{formatDate(project.date.start)}{project.date.end ? ` – ${formatDate(project.date.end)}` : ''}
															</span>
														{/if}
													</div>
													{#if project.researchSection?.length}
														<div class="flex flex-wrap gap-1 mt-1.5">
															{#each project.researchSection as section}
																<a href={researchSectionsUrl(section)} class="hover:opacity-80 transition-opacity">
																	<Badge variant="outline" class="text-[10px] hover:bg-primary/10 transition-colors">
																		{#snippet children()}{section}{/snippet}
																	</Badge>
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

				<!-- Projects as Member -->
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
										{#each selectedPerson.memberOf as project}
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
														<span class="text-xs text-muted-foreground font-mono block mt-0.5">{project.idShort}</span>
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

				<!-- Research Items -->
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
											</span>
										{/snippet}
									</CardTitle>
								{/snippet}
							</CardHeader>
							<CardContent>
								{#snippet children()}
									<ul class="space-y-2">
										{#each paginatedCollectionItems as item}
											<CollectionItemRow {item}>
												{#snippet extraMetadata()}
													{#if getPersonRole(item, selectedPerson.name)}
														<Badge variant="outline" class="text-[10px]">
															{#snippet children()}{getPersonRole(item, selectedPerson.name)}{/snippet}
														</Badge>
													{/if}
												{/snippet}
											</CollectionItemRow>
										{/each}
									</ul>
									<Pagination
										currentPage={collectionPage}
										totalItems={personCollectionItems.length}
										itemsPerPage={collectionItemsPerPage}
										onPageChange={(p) => collectionPage = p}
									/>
								{/snippet}
							</CardContent>
						{/snippet}
					</Card>
				{/if}

			{:else}
				<!-- No person selected -->
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardContent>
							{#snippet children()}
								<div class="flex flex-col items-center justify-center py-16 text-center">
									<Users class="h-12 w-12 text-muted-foreground/50 mb-4" />
									<p class="text-lg font-medium text-muted-foreground">Select a person</p>
									<p class="text-sm text-muted-foreground/70 mt-1">
										Choose someone from the list to view their projects, research sections, and research items
									</p>
								</div>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}
		</div>
	</div>
</div>
