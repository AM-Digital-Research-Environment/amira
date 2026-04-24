<script lang="ts">
	import { StatCard, BackToList, SEO } from '$lib/components/ui';
	import {
		EntityCard,
		EntityBrowseGrid,
		EntityToolbar,
		EntityDetailHeader,
		EntityItemsCard,
		applyEntitySort,
		type EntitySort
	} from '$lib/components/entity-browse';
	import { allCollections } from '$lib/stores/data';
	import { page } from '$app/stores';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import { languageName, normalizeLanguageCode } from '$lib/utils/languages';
	import { createSearchFilter } from '$lib/utils/search';
	import type { CollectionItem } from '$lib/types';
	import { Languages, FileText } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { EntityDashboard, getEntityLayout } from '$lib/components/dashboards';
	import type { EntityDashboardData } from '$lib/components/dashboards';
	import { loadEntityDashboard } from '$lib/utils/loaders/entityDashboardLoader';

	const urlSelection = createUrlSelection('code');

	let searchQuery = $state('');
	let sort = $state<EntitySort>('count-desc');

	// Writable $derived — URL is the source of truth for the selected code
	// so browser Back clears the detail view automatically.
	let selectedCode = $derived($page.url.searchParams.get('code') ?? '');

	interface LanguageData {
		code: string;
		name: string;
		count: number;
		items: CollectionItem[];
	}

	let languageMap = $derived.by(() => {
		const map = new SvelteMap<string, LanguageData>();
		$allCollections.forEach((item) => {
			(item.language || []).forEach((rawCode) => {
				if (!rawCode) return;
				const code = normalizeLanguageCode(rawCode);
				if (!map.has(code)) {
					map.set(code, { code, name: languageName(code), count: 0, items: [] });
				}
				const lang = map.get(code)!;
				lang.count++;
				lang.items.push(item);
			});
		});
		return map;
	});

	let languages = $derived(Array.from(languageMap.values()));

	const searchLanguages = createSearchFilter<LanguageData>([(l) => l.name, (l) => l.code]);
	let visibleLanguages = $derived(applyEntitySort(searchLanguages(languages, searchQuery), sort));

	let selectedLanguage = $derived(selectedCode ? languageMap.get(selectedCode) || null : null);
	let mostCommon = $derived(applyEntitySort(languages, 'count-desc')[0]?.name ?? '—');

	function selectLanguage(code: string) {
		urlSelection.pushToUrl(code);
		scrollToTop();
	}

	function clearSelection() {
		urlSelection.removeFromUrl();
		scrollToTop();
	}

	// Per-language dashboard: loads precomputed JSON emitted by
	// `scripts/precompute_entity_dashboards.py --entity language`. When the
	// file is missing (pre-pipeline runs, or a language without precomputed
	// data), we silently fall back to the existing items-list view.
	const languageLayout = getEntityLayout('language');
	let dashboardData = $state<EntityDashboardData | null>(null);
	let dashboardLoading = $state(false);

	$effect(() => {
		if (!selectedCode) {
			dashboardData = null;
			return;
		}
		// Capture the code so a stale fetch doesn't clobber newer state.
		const requestedCode = selectedCode;
		dashboardLoading = true;
		loadEntityDashboard('language', requestedCode).then((data) => {
			if (requestedCode === selectedCode) {
				dashboardData = data;
				dashboardLoading = false;
			}
		});
	});
</script>

<SEO
	title="Languages"
	description="Explore the languages represented in the research collections"
/>

<div class="space-y-8 animate-slide-in-up">
	<div>
		<h1 class="page-title">Languages</h1>
		<p class="page-subtitle">
			Browse research items by language across all universities and projects
		</p>
	</div>

	{#if selectedLanguage}
		<div class="space-y-6">
			<BackToList show={true} onclick={clearSelection} label="Back to languages" />
			<EntityDetailHeader
				title={selectedLanguage.name}
				icon={Languages}
				subtitle={`Code: ${selectedLanguage.code}`}
				count={selectedLanguage.count}
				wisskiCategory="languages"
				wisskiKey={selectedLanguage.name}
			/>
			<EntityItemsCard items={selectedLanguage.items} showProject={true} />
			{#if languageLayout && dashboardData}
				<EntityDashboard
					layout={languageLayout}
					data={dashboardData}
					items={selectedLanguage.items}
				/>
			{:else if dashboardLoading}
				<p class="text-sm text-muted-foreground">Loading dashboard…</p>
			{/if}
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-3">
			<StatCard label="Languages" value={languages.length} icon={Languages} />
			<StatCard
				label="Items with language"
				value={$allCollections.filter((i) => i.language?.length > 0).length}
				icon={FileText}
			/>
			<StatCard label="Most common" value={mostCommon} icon={Languages} />
		</div>

		<EntityToolbar
			{searchQuery}
			onSearchChange={(v) => (searchQuery = v)}
			searchPlaceholder="Search languages..."
			{sort}
			onSortChange={(v) => (sort = v)}
			totalCount={visibleLanguages.length}
			totalLabel="languages"
		/>

		<EntityBrowseGrid
			items={visibleLanguages}
			getKey={(l) => l.code}
			emptyMessage="No languages match your search"
		>
			{#snippet card(lang)}
				<EntityCard
					name={lang.name}
					subtitle={lang.code.toUpperCase()}
					description="Language"
					count={lang.count}
					countLabel="item"
					icon={Languages}
					onclick={() => selectLanguage(lang.code)}
				/>
			{/snippet}
		</EntityBrowseGrid>
	{/if}
</div>
