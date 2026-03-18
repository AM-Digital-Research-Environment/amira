<script lang="ts">
	import { StatCard, Card, CardContent } from '$lib/components/ui';
	import { allCollections, enrichedLocations } from '$lib/stores/data';
	import { page } from '$app/stores';
	import type { CollectionItem } from '$lib/types';
	import { getItemTitle } from '$lib/utils/helpers';
	import { paginate } from '$lib/utils/pagination';
	import { FileText, Layers, BookOpen } from '@lucide/svelte';
	import { ItemDetail, ItemFilters, getContributors, getSubjects } from '$lib/components/research-items';

	let searchQuery = $state('');
	let selectedType = $state('all');
	let selectedSubjects = $state<string[]>([]);
	let selectedTags = $state<string[]>([]);
	let selectedId = $state('');
	let listPage = $state(0);
	const listPerPage = 20;

	let filtersRef: ReturnType<typeof ItemFilters> | undefined = $state();

	// Sync from URL query param
	$effect(() => {
		const urlId = $page.url.searchParams.get('id');
		if (urlId) selectedId = urlId;
	});

	// Unique resource types for filter
	let resourceTypes = $derived.by(() => {
		const types = new Set<string>();
		$allCollections.forEach((item) => {
			if (item.typeOfResource) types.add(item.typeOfResource);
		});
		return ['all', ...Array.from(types).sort()];
	});

	// Subjects (LCSH controlled vocabulary) with counts
	let allSubjectsWithCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		$allCollections.forEach((item) => {
			if (!Array.isArray(item.subject)) return;
			item.subject.forEach((s) => {
				const label = s.authLabel || s.origLabel;
				if (label) counts.set(label, (counts.get(label) || 0) + 1);
			});
		});
		return Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => ({ name, count }));
	});

	// Tags (free-form keywords) with counts
	let allTagsWithCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		$allCollections.forEach((item) => {
			if (!Array.isArray(item.tags)) return;
			item.tags.forEach((t) => {
				if (t) counts.set(t, (counts.get(t) || 0) + 1);
			});
		});
		return Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => ({ name, count }));
	});

	function toggleSubject(subject: string) {
		if (selectedSubjects.includes(subject)) {
			selectedSubjects = selectedSubjects.filter((s) => s !== subject);
		} else {
			selectedSubjects = [...selectedSubjects, subject];
		}
	}

	function toggleTag(tag: string) {
		if (selectedTags.includes(tag)) {
			selectedTags = selectedTags.filter((t) => t !== tag);
		} else {
			selectedTags = [...selectedTags, tag];
		}
	}

	// Filtered items
	let filteredItems = $derived.by(() => {
		let items = $allCollections;
		if (selectedType !== 'all') {
			items = items.filter((item) => item.typeOfResource === selectedType);
		}
		if (selectedSubjects.length > 0) {
			items = items.filter((item) => {
				if (!Array.isArray(item.subject)) return false;
				const labels = item.subject.map((s) => s.authLabel || s.origLabel).filter(Boolean);
				return selectedSubjects.every((s) => labels.includes(s));
			});
		}
		if (selectedTags.length > 0) {
			items = items.filter((item) => {
				if (!Array.isArray(item.tags)) return false;
				return selectedTags.every((t) => item.tags.includes(t));
			});
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			items = items.filter((item) => {
				const title = getItemTitle(item).toLowerCase();
				const contributors = getContributors(item).map((c) => c.name.toLowerCase()).join(' ');
				const subjects = getSubjects(item).join(' ').toLowerCase();
				return title.includes(q) || contributors.includes(q) || subjects.includes(q);
			});
		}
		return items;
	});

	// Paginated items
	let paginatedItems = $derived(paginate(filteredItems, listPage, listPerPage));

	// Reset page on filter change
	$effect(() => {
		searchQuery;
		selectedType;
		selectedSubjects;
		selectedTags;
		listPage = 0;
	});

	// Selected item
	let selectedItem = $derived.by((): CollectionItem | null => {
		if (!selectedId) return null;
		return $allCollections.find((item) => item._id === selectedId || item.dre_id === selectedId) || null;
	});

	function selectItem(item: CollectionItem) {
		selectedId = item._id || item.dre_id;
		const url = new URL(window.location.href);
		url.searchParams.set('id', selectedId);
		history.pushState({}, '', url.toString());
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function clearSelection() {
		selectedId = '';
		const url = new URL(window.location.href);
		url.searchParams.delete('id');
		history.pushState({}, '', url.toString());
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	// Map markers for selected item
	let itemMapMarkers = $derived.by(() => {
		if (!selectedItem || !$enrichedLocations) return [];
		const origins = selectedItem.location?.origin || [];
		const markers: { latitude: number; longitude: number; label: string }[] = [];
		origins.forEach((o) => {
			// Try city first, then region, then country
			if (o.l3 && o.l1) {
				const key = `${o.l3}|${o.l1}`;
				const loc = $enrichedLocations!.cities[key];
				if (loc?.latitude && loc?.longitude) {
					markers.push({ latitude: loc.latitude, longitude: loc.longitude, label: o.l3 });
					return;
				}
			}
			if (o.l2 && o.l1) {
				const key = `${o.l2}|${o.l1}`;
				const loc = $enrichedLocations!.regions[key];
				if (loc?.latitude && loc?.longitude) {
					markers.push({ latitude: loc.latitude, longitude: loc.longitude, label: o.l2 });
					return;
				}
			}
			if (o.l1) {
				const loc = $enrichedLocations!.countries[o.l1];
				if (loc?.latitude && loc?.longitude) {
					markers.push({ latitude: loc.latitude, longitude: loc.longitude, label: o.l1 });
				}
			}
		});
		return markers;
	});

	function handleAddSubject(subject: string) {
		if (!selectedSubjects.includes(subject)) {
			selectedSubjects = [...selectedSubjects, subject];
			filtersRef?.expandSubjects();
		}
	}

	function handleAddTag(tag: string) {
		if (!selectedTags.includes(tag)) {
			selectedTags = [...selectedTags, tag];
			filtersRef?.expandTags();
		}
	}
</script>

<div class="space-y-8 animate-slide-in-up">
	<!-- Header -->
	<div>
		<h1 class="page-title">Research Items</h1>
		<p class="page-subtitle">Browse and explore collection items across all universities and projects</p>
	</div>

	<!-- Stats -->
	<div class="grid gap-4 sm:grid-cols-3">
		<StatCard label="Total Items" value={$allCollections.length} icon={FileText} />
		<StatCard
			label="Resource Types"
			value={resourceTypes.length - 1}
			icon={Layers}
		/>
		<StatCard
			label="Filtered Results"
			value={filteredItems.length}
			icon={BookOpen}
		/>
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Item List & Filters -->
		<ItemFilters
			bind:this={filtersRef}
			{filteredItems}
			{paginatedItems}
			{resourceTypes}
			{allSubjectsWithCounts}
			{allTagsWithCounts}
			{selectedId}
			{searchQuery}
			{selectedType}
			{selectedSubjects}
			{selectedTags}
			{listPage}
			{listPerPage}
			onSelectItem={selectItem}
			onClearSelection={clearSelection}
			onSearchQueryChange={(v) => searchQuery = v}
			onSelectedTypeChange={(v) => selectedType = v}
			onToggleSubject={toggleSubject}
			onClearSubjects={() => selectedSubjects = []}
			onToggleTag={toggleTag}
			onClearTags={() => selectedTags = []}
			onPageChange={(p) => listPage = p}
		/>

		<!-- Item Detail -->
		<div class="lg:col-span-2 space-y-6">
			{#if selectedItem}
				<ItemDetail
					item={selectedItem}
					mapMarkers={itemMapMarkers}
					onAddSubject={handleAddSubject}
					onAddTag={handleAddTag}
				/>
			{:else}
				<!-- No item selected -->
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardContent>
							{#snippet children()}
								<div class="flex flex-col items-center justify-center py-16 text-center">
									<FileText class="h-12 w-12 text-muted-foreground/50 mb-4" />
									<p class="text-lg font-medium text-muted-foreground">Select an item</p>
									<p class="text-sm text-muted-foreground/70 mt-1">
										Choose an item from the list to view its full metadata, contributors, and subjects
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
