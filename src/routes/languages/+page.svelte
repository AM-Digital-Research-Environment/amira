<script lang="ts">
	import { StatCard, ChartCard, SEO } from '$lib/components/ui';
	import { StackedAreaChart, HeatmapChart } from '$lib/components/charts';
	import {
		EntityCard,
		EntityBrowseGrid,
		EntityToolbar,
		EntityDetailHeader,
		EntityDetailViewShell,
		EntityPageContainer,
		SearchableItemsCard,
		applyEntitySort,
		type EntitySort
	} from '$lib/components/entity-browse';
	import { allCollections } from '$lib/stores/data';
	import { page } from '$app/stores';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import { languageName, normalizeLanguageCode } from '$lib/utils/languages';
	import { createSearchFilter } from '$lib/utils/search';
	import { extractItemYear } from '$lib/utils/transforms/dates';
	import type { CollectionItem, StackedAreaDataPoint, HeatmapDataPoint } from '$lib/types';
	import { Languages, FileText } from '@lucide/svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { EntityDashboardSection } from '$lib/components/dashboards';
	import { createEntityDetailState } from '$lib/utils/loaders';

	const urlSelection = createUrlSelection('code');

	let searchQuery = $state('');
	let sort = $state<EntitySort>('count-desc');

	// URL is the source of truth for the selected code so browser Back clears
	// the detail view automatically.
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

	// Lazy per-entity JSON load (items + aggregates). Skips the 13 MB
	// collections dump on direct-detail-URL hits.
	const detail = createEntityDetailState('language', () => selectedCode);

	let selectedLanguage = $derived.by((): LanguageData | null => {
		if (!selectedCode) return null;
		const live = languageMap.get(selectedCode);
		if (live && live.items.length > 0) return live;
		if (detail.data?.meta) {
			return {
				code: selectedCode,
				name: detail.data.meta.name ?? languageName(selectedCode),
				count: detail.data.meta.count ?? 0,
				items: detail.items
			};
		}
		return null;
	});

	let mostCommon = $derived(applyEntitySort(languages, 'count-desc')[0]?.name ?? '—');

	// Top 8 languages get their own series in the stacked-area; everything
	// else folds into "Other" so the chart stays readable when the long tail
	// of dialect codes is included.
	const TOP_LANGUAGE_SERIES = 8;
	let topLanguageNames = $derived(
		applyEntitySort(languages, 'count-desc')
			.slice(0, TOP_LANGUAGE_SERIES)
			.map((l) => l.name)
	);

	let languageTimelineData = $derived.by((): StackedAreaDataPoint[] => {
		const top = new SvelteSet(topLanguageNames);
		const byYear = new SvelteMap<number, Record<string, number>>();
		for (const item of $allCollections) {
			const year = extractItemYear(item);
			if (year == null) continue;
			const codes = item.language || [];
			if (codes.length === 0) continue;
			const seen = new SvelteSet<string>();
			for (const raw of codes) {
				const name = languageName(normalizeLanguageCode(raw));
				const bucket = top.has(name) ? name : 'Other';
				if (seen.has(bucket)) continue;
				seen.add(bucket);
				let row = byYear.get(year);
				if (!row) {
					row = {};
					byYear.set(year, row);
				}
				row[bucket] = (row[bucket] ?? 0) + 1;
			}
		}
		return Array.from(byYear.entries())
			.sort(([a], [b]) => a - b)
			.map(([year, byCategory]) => ({ year, byCategory }));
	});

	// Heatmap: language (y) × resource type (x). Capped to the top 10
	// languages and 10 types so the cell labels stay legible.
	let languageTypeHeatmap = $derived.by((): HeatmapDataPoint[] => {
		const langTotals = new SvelteMap<string, number>();
		const typeTotals = new SvelteMap<string, number>();
		const cell = new SvelteMap<string, number>();
		for (const item of $allCollections) {
			const codes = item.language || [];
			if (codes.length === 0) continue;
			const rtype = item.typeOfResource || 'Unknown';
			typeTotals.set(rtype, (typeTotals.get(rtype) ?? 0) + 1);
			const seen = new SvelteSet<string>();
			for (const raw of codes) {
				const name = languageName(normalizeLanguageCode(raw));
				if (seen.has(name)) continue;
				seen.add(name);
				langTotals.set(name, (langTotals.get(name) ?? 0) + 1);
				const key = `${rtype}|${name}`;
				cell.set(key, (cell.get(key) ?? 0) + 1);
			}
		}
		const topLangs = Array.from(langTotals.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([name]) => name);
		const topTypes = Array.from(typeTotals.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([name]) => name);
		const result: HeatmapDataPoint[] = [];
		for (const t of topTypes) {
			for (const l of topLangs) {
				const v = cell.get(`${t}|${l}`) ?? 0;
				if (v > 0) result.push({ x: t, y: l, value: v });
			}
		}
		return result;
	});

	function selectLanguage(code: string) {
		urlSelection.pushToUrl(code);
		scrollToTop();
	}

	function clearSelection() {
		urlSelection.removeFromUrl();
		scrollToTop();
	}
</script>

<SEO
	title="Languages"
	description="Explore the languages represented in the Africa Multiple research collections — distribution over time, co-occurrence, and per-language archives. ISO 639 controlled vocabulary."
	keywords={['languages', 'African languages', 'multilingual', 'language distribution', 'ISO 639']}
/>

<EntityPageContainer
	title="Languages"
	subtitle="Browse research items by language across all universities and projects"
	selected={() => selectedCode}
>
	{#snippet detailView()}
		<EntityDetailViewShell
			backLabel="Back to languages"
			onBack={clearSelection}
			resolved={selectedLanguage}
			loading={detail.loading}
			emptyMessage="No data available for this language."
		>
			{#snippet body(language)}
				<EntityDetailHeader
					title={language.name}
					icon={Languages}
					subtitle={`Code: ${language.code}`}
					count={language.count}
					wisskiCategory="languages"
					wisskiKey={language.name}
				/>
				<SearchableItemsCard items={language.items} />
				<EntityDashboardSection
					entityType="language"
					entityId={language.code}
					items={language.items}
					data={detail.data}
				/>
			{/snippet}
		</EntityDetailViewShell>
	{/snippet}

	{#snippet listView()}
		<div class="grid gap-4 sm:grid-cols-3">
			<StatCard label="Languages" value={languages.length} icon={Languages} />
			<StatCard
				label="Items with language"
				value={$allCollections.filter((i) => i.language?.length > 0).length}
				icon={FileText}
			/>
			<StatCard label="Most common" value={mostCommon} icon={Languages} />
		</div>

		{#if languageTimelineData.length > 0}
			<ChartCard
				title="Languages over time"
				subtitle="Top {TOP_LANGUAGE_SERIES} languages by item count, with smaller languages folded into 'Other'"
				contentHeight="h-chart-lg"
			>
				<StackedAreaChart data={languageTimelineData} class="h-full w-full" />
			</ChartCard>
		{/if}

		{#if languageTypeHeatmap.length > 0}
			<ChartCard
				title="Language × resource type"
				subtitle="Where each language concentrates across the archive"
				contentHeight="h-chart-lg"
			>
				<HeatmapChart data={languageTypeHeatmap} class="h-full w-full" />
			</ChartCard>
		{/if}

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
	{/snippet}
</EntityPageContainer>
