<script lang="ts">
	import {
		StatCard,
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		Badge,
		BackToList,
		SEO,
		SectionBadge
	} from '$lib/components/ui';
	import {
		EntityCard,
		EntityBrowseGrid,
		EntityToolbar,
		EntityDetailHeader,
		SearchableItemsCard,
		applyEntitySort,
		type EntitySort
	} from '$lib/components/entity-browse';
	import {
		projects,
		allCollections,
		persons,
		universitiesData,
		ensureCollections
	} from '$lib/stores/data';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { createEntityDetailState } from '$lib/utils/loaders';
	import { personUrl, projectUrl, researchSectionsUrl } from '$lib/utils/urls';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import type { Project, CollectionItem } from '$lib/types';
	import { formatDate, getProjectTitle } from '$lib/utils/helpers';
	import { createSearchFilter } from '$lib/utils/search';
	import { base } from '$app/paths';
	import { Building2, Briefcase, Users } from '@lucide/svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { EntityKnowledgeGraph } from '$lib/components/charts';
	import { EntityDashboardSection } from '$lib/components/dashboards';

	const urlSelection = createUrlSelection('name');

	let searchQuery = $state('');
	let sort = $state<EntitySort>('count-desc');
	let partnerFilter = $state<'all' | 'partner' | 'contributor'>('all');

	let selectedName = $derived($page.url.searchParams.get('name') ?? '');

	interface InstitutionData {
		name: string;
		count: number; // total reach (projects + people + items) — used for sorting and the card badge
		projects: Project[];
		people: Set<string>;
		collectionItemCount: number;
		isPartner: boolean;
	}

	let institutionMap = $derived.by(() => {
		const map = new SvelteMap<string, InstitutionData>();

		const getOrCreate = (name: string): InstitutionData => {
			if (!map.has(name)) {
				map.set(name, {
					name,
					count: 0,
					projects: [],
					people: new Set(),
					collectionItemCount: 0,
					isPartner: false
				});
			}
			return map.get(name)!;
		};

		$projects.forEach((p) => {
			(p.institutions || []).forEach((instName) => {
				const inst = getOrCreate(instName);
				inst.isPartner = true;
				inst.projects.push(p);
				(p.pi || []).forEach((pi) => {
					if (typeof pi === 'string') inst.people.add(pi);
				});
				if (Array.isArray(p.members)) {
					p.members.forEach((m) => {
						if (typeof m === 'string') inst.people.add(m);
					});
				}
			});
		});

		$persons.forEach((p) => {
			(p.affiliation || []).forEach((aff) => {
				if (aff) getOrCreate(aff).people.add(p.name);
			});
		});

		$allCollections.forEach((item) => {
			if (!Array.isArray(item.name)) return;
			item.name.forEach((n) => {
				if (n?.name?.label && n?.name?.qualifier === 'institution') {
					getOrCreate(n.name.label).collectionItemCount++;
				}
				if (n?.name?.label && Array.isArray(n.affl)) {
					n.affl.forEach((aff) => {
						if (aff) getOrCreate(aff).people.add(n.name.label);
					});
				}
			});
		});

		const projectInstitutions = new SvelteMap<string, string[]>();
		$projects.forEach((p) => projectInstitutions.set(p.id, p.institutions || []));
		$allCollections.forEach((item) => {
			const instNames = projectInstitutions.get(item.project?.id || '');
			if (instNames) {
				instNames.forEach((instName) => {
					if (map.has(instName)) map.get(instName)!.collectionItemCount++;
				});
			}
		});

		// Finalize count: used by toolbar sort and card badge. We use collectionItemCount
		// as the "item count" (primary), falling back to project count for partner-only orgs.
		map.forEach((inst) => {
			inst.count = inst.collectionItemCount || inst.projects.length;
		});

		return map;
	});

	let allInstitutions = $derived(Array.from(institutionMap.values()));
	let partnerCount = $derived(allInstitutions.filter((i) => i.isPartner).length);
	let contributorCount = $derived(allInstitutions.filter((i) => !i.isPartner).length);
	let totalPeople = $derived(new Set(allInstitutions.flatMap((i) => [...i.people])).size);

	const searchInstitutions = createSearchFilter<InstitutionData>([(i) => i.name]);

	let filteredByPartner = $derived(
		partnerFilter === 'partner'
			? allInstitutions.filter((i) => i.isPartner)
			: partnerFilter === 'contributor'
				? allInstitutions.filter((i) => !i.isPartner)
				: allInstitutions
	);

	let visibleInstitutions = $derived(
		applyEntitySort(searchInstitutions(filteredByPartner, searchQuery), sort)
	);

	const detail = createEntityDetailState('institution', () => selectedName);

	let selectedInstitution = $derived.by((): InstitutionData | null => {
		if (!selectedName) return null;
		const live = institutionMap.get(selectedName);
		if (live) return live;
		// Fallback for direct detail-URL nav: synthesise a shell record from
		// the per-entity JSON so the header/items/dashboard render without
		// waiting on the 13 MB collections dump.
		if (detail.data?.meta) {
			return {
				name: detail.data.meta.name ?? selectedName,
				count: detail.data.meta.count ?? 0,
				projects: [],
				people: new Set(),
				collectionItemCount: detail.data.meta.count ?? 0,
				isPartner: false
			};
		}
		return null;
	});

	let institutionItems = $derived.by((): CollectionItem[] => {
		if (!selectedInstitution) return [];
		// Prefer precomputed items to skip the 13 MB dump on direct URLs.
		if (detail.items.length > 0) return detail.items;
		const name = selectedInstitution.name;
		const projectIds = new Set(selectedInstitution.projects.map((p) => p.id));
		const seen = new SvelteSet<string>();
		const results: CollectionItem[] = [];
		$allCollections.forEach((item) => {
			const id = item._id || item.dre_id;
			if (seen.has(id)) return;
			const byProject = projectIds.has(item.project?.id || '');
			const byContributor =
				Array.isArray(item.name) &&
				item.name.some((n) => n?.name?.label === name && n?.name?.qualifier === 'institution');
			if (byProject || byContributor) {
				seen.add(id);
				results.push(item);
			}
		});
		return results;
	});

	onMount(() => {
		if (!selectedName) void ensureCollections(base);
	});

	$effect(() => {
		if (!selectedName) void ensureCollections(base);
	});

	function selectInstitution(name: string) {
		urlSelection.pushToUrl(name);
		scrollToTop();
	}

	function clearSelection() {
		urlSelection.removeFromUrl();
		scrollToTop();
	}
</script>

<SEO
	title="Institutions"
	description="Browse partner institutions and their associated projects, researchers, and research items"
/>

<div class="space-y-8 animate-slide-in-up">
	<div>
		<h1 class="page-title">Institutions</h1>
		<p class="page-subtitle">
			Browse partner institutions and their associated projects, researchers, and research items
		</p>
	</div>

	{#if selectedInstitution}
		<div class="space-y-6">
			<BackToList show={true} onclick={clearSelection} label="Back to institutions" />
			<EntityDetailHeader
				title={selectedInstitution.name}
				icon={Building2}
				wisskiCategory="institutions"
				wisskiKey={selectedInstitution.name}
			>
				{#snippet badges()}
					{#if selectedInstitution.isPartner}
						<Badge>{#snippet children()}Partner{/snippet}</Badge>
					{/if}
					<Badge variant="secondary">
						{#snippet children()}{selectedInstitution.projects.length} project{selectedInstitution
								.projects.length !== 1
								? 's'
								: ''}{/snippet}
					</Badge>
					<Badge variant="secondary">
						{#snippet children()}{selectedInstitution.people.size} people{/snippet}
					</Badge>
					{#if selectedInstitution.collectionItemCount > 0}
						<Badge variant="outline">
							{#snippet children()}{selectedInstitution.collectionItemCount} item{selectedInstitution.collectionItemCount !==
								1
									? 's'
									: ''}{/snippet}
						</Badge>
					{/if}
				{/snippet}
			</EntityDetailHeader>

			{#if selectedInstitution.projects.length > 0}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}
										<span class="flex items-center gap-2">
											<Briefcase class="h-5 w-5 text-primary" />
											Projects
											<Badge variant="secondary">
												{#snippet children()}{selectedInstitution.projects.length}{/snippet}
											</Badge>
										</span>
									{/snippet}
								</CardTitle>
							{/snippet}
						</CardHeader>
						<CardContent>
							{#snippet children()}
								<ul class="space-y-3">
									{#each selectedInstitution.projects as project (project.id)}
										<li class="p-3 rounded-lg bg-muted/30">
											<a
												href={projectUrl(project.id)}
												class="text-sm font-medium text-foreground hover:text-primary transition-colors break-words"
											>
												{getProjectTitle(project)}
											</a>
											<div class="flex flex-wrap items-center gap-2 mt-1">
												{#if project.idShort}
													<span class="text-xs text-muted-foreground font-mono">{project.id}</span>
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
											{#if project.pi?.length}
												<p class="text-xs text-muted-foreground mt-1.5">
													PI: {#each project.pi as pi, i (pi)}{#if i > 0},&nbsp;{/if}<a
															href={personUrl(pi)}
															class="hover:text-primary transition-colors">{pi}</a
														>{/each}
												</p>
											{/if}
										</li>
									{/each}
								</ul>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}

			{#if selectedInstitution.people.size > 0}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}
										<span class="flex items-center gap-2">
											<Users class="h-5 w-5 text-muted-foreground" />
											People
											<Badge variant="secondary">
												{#snippet children()}{selectedInstitution.people.size}{/snippet}
											</Badge>
										</span>
									{/snippet}
								</CardTitle>
							{/snippet}
						</CardHeader>
						<CardContent>
							{#snippet children()}
								<div class="flex flex-wrap gap-2">
									{#each [...selectedInstitution.people].sort() as person (person)}
										<a
											href={personUrl(person)}
											class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-sm text-foreground hover:text-primary hover:bg-muted transition-colors"
										>
											{person}
										</a>
									{/each}
								</div>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}

			{#if institutionItems.length > 0}
				<SearchableItemsCard items={institutionItems} showProject={false} />
			{/if}

			<EntityDashboardSection
				entityType="institution"
				entityId={selectedInstitution.name}
				items={institutionItems}
				data={detail.data}
			/>

			<EntityKnowledgeGraph
				entityType="institution"
				entityId={selectedInstitution.name}
				title="Institution knowledge graph"
			/>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-3">
			<StatCard label="Partner Institutions" value={partnerCount} icon={Building2} />
			<StatCard label="Contributor Orgs" value={contributorCount} icon={Building2} />
			<StatCard label="Total People" value={totalPeople} icon={Users} />
		</div>

		<div class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
			{#each $universitiesData as uniData, index (uniData.university.code)}
				<div class="stat-card animate-slide-in-up" style="animation-delay: {75 + index * 50}ms">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium text-muted-foreground">{uniData.university.code}</p>
							<p class="stat-value mt-2">{uniData.count}</p>
							<p class="stat-label truncate" title={uniData.university.name}>
								{uniData.university.name}
							</p>
						</div>
						<div
							class="size-9 sm:size-10 rounded-lg bg-white flex items-center justify-center p-1.5 shadow-sm flex-shrink-0"
						>
							<img
								src="{base}/{uniData.university.logo}"
								alt="{uniData.university.name} logo"
								class="h-full w-full object-contain"
							/>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Partner/contributor filter -->
		<div class="flex rounded-lg border border-input overflow-hidden w-fit">
			<button
				onclick={() => (partnerFilter = 'all')}
				class="px-4 py-2 text-sm font-medium transition-colors {partnerFilter === 'all'
					? 'bg-primary text-primary-foreground'
					: 'hover:bg-muted'}"
			>
				All ({allInstitutions.length})
			</button>
			<button
				onclick={() => (partnerFilter = 'partner')}
				class="px-4 py-2 text-sm font-medium transition-colors {partnerFilter === 'partner'
					? 'bg-primary text-primary-foreground'
					: 'hover:bg-muted'}"
			>
				Partners ({partnerCount})
			</button>
			<button
				onclick={() => (partnerFilter = 'contributor')}
				class="px-4 py-2 text-sm font-medium transition-colors {partnerFilter === 'contributor'
					? 'bg-primary text-primary-foreground'
					: 'hover:bg-muted'}"
			>
				Contributors ({contributorCount})
			</button>
		</div>

		<EntityToolbar
			{searchQuery}
			onSearchChange={(v) => (searchQuery = v)}
			searchPlaceholder="Search institutions..."
			{sort}
			onSortChange={(v) => (sort = v)}
			totalCount={visibleInstitutions.length}
			totalLabel="institutions"
		/>

		<EntityBrowseGrid
			items={visibleInstitutions}
			getKey={(i) => i.name}
			emptyMessage="No institutions match your search"
			density="comfortable"
		>
			{#snippet card(inst)}
				<EntityCard
					name={inst.name}
					description={inst.isPartner ? 'Partner institution' : 'Contributor organisation'}
					count={inst.count || undefined}
					countLabel="item"
					icon={Building2}
					onclick={() => selectInstitution(inst.name)}
				>
					{#snippet meta()}
						{#if inst.isPartner}
							<Badge class="text-2xs">{#snippet children()}Partner{/snippet}</Badge>
						{/if}
						{#if inst.projects.length > 0}
							<span class="inline-flex items-center gap-1" title="Projects">
								<Briefcase class="h-3 w-3" />
								{inst.projects.length} project{inst.projects.length === 1 ? '' : 's'}
							</span>
						{/if}
						{#if inst.people.size > 0}
							<span class="inline-flex items-center gap-1" title="People">
								<Users class="h-3 w-3" />
								{inst.people.size}
								{inst.people.size === 1 ? 'person' : 'people'}
							</span>
						{/if}
					{/snippet}
				</EntityCard>
			{/snippet}
		</EntityBrowseGrid>
	{/if}
</div>
