<script lang="ts">
	import { StatCard, Pagination, SEO } from '$lib/components/ui';
	import { allCollections, enrichedLocations, ensureEnrichedLocations } from '$lib/stores/data';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { CollectionItem } from '$lib/types';
	import { getItemTitle } from '$lib/utils/helpers';
	import { paginate } from '$lib/utils/pagination';
	import { FileText, Layers, BookOpen, SlidersHorizontal, Target, HardDrive } from '@lucide/svelte';
	import {
		ItemDetail,
		ItemFilters,
		ItemTable,
		getContributors,
		getSubjects,
		getOrigins,
		getLanguages
	} from '$lib/components/research-items';
	import { BackToList } from '$lib/components/ui';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	// Lazy-load enriched geolocation: only this page reads $enrichedLocations
	// for the per-item map, so we fetch it on mount instead of at app start.
	onMount(() => {
		void ensureEnrichedLocations(base);
	});

	let searchQuery = $state('');
	let selectedType = $state('all');
	let selectedSubjects = $state<string[]>([]);
	let selectedTags = $state<string[]>([]);
	let selectedCountries = $state<string[]>([]);
	let selectedProjects = $state<string[]>([]);
	let selectedLanguages = $state<string[]>([]);
	let selectedAudiences = $state<string[]>([]);
	let selectedMethods = $state<string[]>([]);
	let selectedId = $state('');
	let listPage = $state(0);
	const listPerPage = 20;
	let showMobileFilters = $state(false);

	let filtersRef: ReturnType<typeof ItemFilters> | undefined = $state();

	// Sync from URL query param
	$effect(() => {
		const params = $page.url.searchParams;
		const urlId = params.get('id');
		const urlAudience = params.get('audience');
		const urlMethod = params.get('method');
		if (urlId) {
			selectedId = urlId;
		} else {
			selectedId = '';
			if (urlAudience) selectedAudiences = [urlAudience];
			if (urlMethod) selectedMethods = [urlMethod];
		}
	});

	// Unique resource types for filter
	let resourceTypes = $derived.by(() => {
		const types = new SvelteSet<string>();
		$allCollections.forEach((item) => {
			if (item.typeOfResource) types.add(item.typeOfResource);
		});
		return ['all', ...Array.from(types).sort()];
	});

	// Subjects (LCSH controlled vocabulary) with counts
	let allSubjectsWithCounts = $derived.by(() => {
		const counts = new SvelteMap<string, number>();
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
		const counts = new SvelteMap<string, number>();
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

	// Countries with counts
	let allCountriesWithCounts = $derived.by(() => {
		const counts = new SvelteMap<string, number>();
		$allCollections.forEach((item) => {
			const origins = getOrigins(item);
			origins.forEach((o) => {
				if (o.country) counts.set(o.country, (counts.get(o.country) || 0) + 1);
			});
		});
		return Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => ({ name, count }));
	});

	// Projects with counts
	let allProjectsWithCounts = $derived.by(() => {
		const counts = new SvelteMap<string, number>();
		$allCollections.forEach((item) => {
			if (item.project?.name) {
				counts.set(item.project.name, (counts.get(item.project.name) || 0) + 1);
			}
		});
		return Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => ({ name, count }));
	});

	// Languages with counts
	let allLanguagesWithCounts = $derived.by(() => {
		const counts = new SvelteMap<string, number>();
		$allCollections.forEach((item) => {
			const langs = getLanguages(item);
			langs.forEach((l) => {
				if (l) counts.set(l, (counts.get(l) || 0) + 1);
			});
		});
		return Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => ({ name, count }));
	});

	let allAudiencesWithCounts = $derived.by(() => {
		const counts = new SvelteMap<string, number>();
		$allCollections.forEach((item) => {
			if (Array.isArray(item.targetAudience)) {
				item.targetAudience.forEach((a) => {
					if (a && typeof a === 'string') counts.set(a, (counts.get(a) || 0) + 1);
				});
			}
		});
		return Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => ({ name, count }));
	});

	let allMethodsWithCounts = $derived.by(() => {
		const counts = new SvelteMap<string, number>();
		$allCollections.forEach((item) => {
			const method = item.physicalDescription?.method;
			if (method && typeof method === 'string') counts.set(method, (counts.get(method) || 0) + 1);
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

	function toggleCountry(country: string) {
		if (selectedCountries.includes(country)) {
			selectedCountries = selectedCountries.filter((c) => c !== country);
		} else {
			selectedCountries = [...selectedCountries, country];
		}
	}

	function toggleProject(project: string) {
		if (selectedProjects.includes(project)) {
			selectedProjects = selectedProjects.filter((p) => p !== project);
		} else {
			selectedProjects = [...selectedProjects, project];
		}
	}

	function toggleLanguage(language: string) {
		if (selectedLanguages.includes(language)) {
			selectedLanguages = selectedLanguages.filter((l) => l !== language);
		} else {
			selectedLanguages = [...selectedLanguages, language];
		}
	}

	function toggleAudience(audience: string) {
		if (selectedAudiences.includes(audience)) {
			selectedAudiences = selectedAudiences.filter((a) => a !== audience);
		} else {
			selectedAudiences = [...selectedAudiences, audience];
		}
	}

	function toggleMethod(method: string) {
		if (selectedMethods.includes(method)) {
			selectedMethods = selectedMethods.filter((m) => m !== method);
		} else {
			selectedMethods = [...selectedMethods, method];
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
		if (selectedCountries.length > 0) {
			items = items.filter((item) => {
				const origins = getOrigins(item);
				const countries = origins.map((o) => o.country).filter(Boolean);
				return selectedCountries.some((c) => countries.includes(c));
			});
		}
		if (selectedProjects.length > 0) {
			items = items.filter((item) => {
				return item.project?.name && selectedProjects.includes(item.project.name);
			});
		}
		if (selectedLanguages.length > 0) {
			items = items.filter((item) => {
				const langs = getLanguages(item);
				return selectedLanguages.some((l) => langs.includes(l));
			});
		}
		if (selectedAudiences.length > 0) {
			items = items.filter((item) => {
				if (!Array.isArray(item.targetAudience)) return false;
				return selectedAudiences.some((a) => item.targetAudience.includes(a));
			});
		}
		if (selectedMethods.length > 0) {
			items = items.filter((item) => {
				const method = item.physicalDescription?.method;
				return method && selectedMethods.includes(method);
			});
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			items = items.filter((item) => {
				const title = getItemTitle(item).toLowerCase();
				const contributors = getContributors(item)
					.map((c) => c.name.toLowerCase())
					.join(' ');
				const subjects = getSubjects(item).join(' ').toLowerCase();
				return title.includes(q) || contributors.includes(q) || subjects.includes(q);
			});
		}
		return items;
	});

	// Whether any filter is active
	let hasActiveFilters = $derived(
		searchQuery.trim() !== '' ||
			selectedType !== 'all' ||
			selectedSubjects.length > 0 ||
			selectedTags.length > 0 ||
			selectedCountries.length > 0 ||
			selectedProjects.length > 0 ||
			selectedLanguages.length > 0 ||
			selectedAudiences.length > 0 ||
			selectedMethods.length > 0
	);

	function clearAllFilters() {
		searchQuery = '';
		selectedType = 'all';
		selectedSubjects = [];
		selectedTags = [];
		selectedCountries = [];
		selectedProjects = [];
		selectedLanguages = [];
		selectedAudiences = [];
		selectedMethods = [];
	}

	// Paginated items
	let paginatedItems = $derived(paginate(filteredItems, listPage, listPerPage));

	// Reset page on filter change
	$effect(() => {
		searchQuery;
		selectedType;
		selectedSubjects;
		selectedTags;
		selectedCountries;
		selectedProjects;
		selectedLanguages;
		selectedAudiences;
		selectedMethods;
		listPage = 0;
	});

	// Selected item
	let selectedItem = $derived.by((): CollectionItem | null => {
		if (!selectedId) return null;
		return (
			$allCollections.find((item) => item._id === selectedId || item.dre_id === selectedId) || null
		);
	});

	function selectItem(item: CollectionItem) {
		const id = item._id || item.dre_id;
		goto(`?id=${encodeURIComponent(id)}`, { noScroll: true });
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function clearSelection() {
		goto('?', { noScroll: true });
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	// Map markers for selected item. Origin markers use the default chart
	// color; "located at" (location.current) markers use an accent color so
	// they're visually distinguishable. Current locations are often bare
	// strings (e.g. institution or city names); we try country first, then
	// city/region by name match, and skip any string we can't geolocate.
	let itemMapMarkers = $derived.by(() => {
		if (!selectedItem || !$enrichedLocations) return [];
		const enriched = $enrichedLocations;
		const markers: {
			latitude: number;
			longitude: number;
			label: string;
			color?: string;
			kind: 'origin' | 'current';
		}[] = [];

		const origins = selectedItem.location?.origin || [];
		origins.forEach((o) => {
			if (o.l3 && o.l1) {
				const loc = enriched.cities[`${o.l3}|${o.l1}`];
				if (loc?.latitude && loc?.longitude) {
					markers.push({
						latitude: loc.latitude,
						longitude: loc.longitude,
						label: `Origin: ${o.l3}`,
						kind: 'origin'
					});
					return;
				}
			}
			if (o.l2 && o.l1) {
				const loc = enriched.regions[`${o.l2}|${o.l1}`];
				if (loc?.latitude && loc?.longitude) {
					markers.push({
						latitude: loc.latitude,
						longitude: loc.longitude,
						label: `Origin: ${o.l2}`,
						kind: 'origin'
					});
					return;
				}
			}
			if (o.l1) {
				const loc = enriched.countries[o.l1];
				if (loc?.latitude && loc?.longitude) {
					markers.push({
						latitude: loc.latitude,
						longitude: loc.longitude,
						label: `Origin: ${o.l1}`,
						kind: 'origin'
					});
				}
			}
		});

		const currents = selectedItem.location?.current || [];
		const currentColor = 'hsl(var(--chart-2))';
		currents.forEach((name) => {
			if (!name) return;
			// Country name directly
			const country = enriched.countries[name];
			if (country?.latitude && country?.longitude) {
				markers.push({
					latitude: country.latitude,
					longitude: country.longitude,
					label: `Located at: ${name}`,
					color: currentColor,
					kind: 'current'
				});
				return;
			}
			// City name (keys are "City|Country")
			for (const [key, loc] of Object.entries(enriched.cities)) {
				if (key.split('|')[0] === name && loc.latitude && loc.longitude) {
					markers.push({
						latitude: loc.latitude,
						longitude: loc.longitude,
						label: `Located at: ${name}`,
						color: currentColor,
						kind: 'current'
					});
					return;
				}
			}
			// Region name (keys are "Region|Country")
			for (const [key, loc] of Object.entries(enriched.regions)) {
				if (key.split('|')[0] === name && loc.latitude && loc.longitude) {
					markers.push({
						latitude: loc.latitude,
						longitude: loc.longitude,
						label: `Located at: ${name}`,
						color: currentColor,
						kind: 'current'
					});
					return;
				}
			}
		});

		return markers;
	});
</script>

<SEO
	title="Research Items"
	description="Browse and filter the full catalog of digitized research items"
/>

<div class="space-y-8 animate-slide-in-up">
	<!-- Header -->
	<div>
		<h1 class="page-title">Research Items</h1>
		<p class="page-subtitle">
			Browse and explore research items across all universities and projects
		</p>
	</div>

	{#if selectedItem}
		<!-- Detail mode: full-width -->
		<div class="space-y-6">
			<BackToList show={true} onclick={clearSelection} label="Back to results" />
			<ItemDetail item={selectedItem} mapMarkers={itemMapMarkers} />
		</div>
	{:else}
		<!-- Stats -->
		<div class="grid gap-4 sm:grid-cols-5">
			<StatCard label="Total Items" value={$allCollections.length} icon={FileText} />
			<StatCard label="Resource Types" value={resourceTypes.length - 1} icon={Layers} />
			<StatCard label="Projects" value={allProjectsWithCounts.length} icon={BookOpen} />
			<StatCard label="Target Audiences" value={allAudiencesWithCounts.length} icon={Target} />
			<StatCard label="Digitization Methods" value={allMethodsWithCounts.length} icon={HardDrive} />
		</div>

		<!-- Mobile filter toggle -->
		<button
			onclick={() => (showMobileFilters = !showMobileFilters)}
			class="lg:hidden flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
		>
			<SlidersHorizontal class="h-4 w-4" />
			Filters
			{#if hasActiveFilters}
				<span
					class="bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 leading-none"
					>{filteredItems.length}</span
				>
			{/if}
		</button>

		<!-- Table mode: filters sidebar + table -->
		<div class="grid gap-6 lg:grid-cols-4">
			<div class="lg:col-span-1 {showMobileFilters ? '' : 'hidden lg:block'}">
				<ItemFilters
					bind:this={filtersRef}
					{filteredItems}
					{resourceTypes}
					{allSubjectsWithCounts}
					{allTagsWithCounts}
					{allCountriesWithCounts}
					{allProjectsWithCounts}
					{allLanguagesWithCounts}
					{allAudiencesWithCounts}
					{allMethodsWithCounts}
					{searchQuery}
					{selectedType}
					{selectedSubjects}
					{selectedTags}
					{selectedCountries}
					{selectedProjects}
					{selectedLanguages}
					{selectedAudiences}
					{selectedMethods}
					onSearchQueryChange={(v) => (searchQuery = v)}
					onSelectedTypeChange={(v) => (selectedType = v)}
					onToggleSubject={toggleSubject}
					onClearSubjects={() => (selectedSubjects = [])}
					onToggleTag={toggleTag}
					onClearTags={() => (selectedTags = [])}
					onToggleCountry={toggleCountry}
					onClearCountries={() => (selectedCountries = [])}
					onToggleProject={toggleProject}
					onClearProjects={() => (selectedProjects = [])}
					onToggleLanguage={toggleLanguage}
					onClearLanguages={() => (selectedLanguages = [])}
					onToggleAudience={toggleAudience}
					onClearAudiences={() => (selectedAudiences = [])}
					onToggleMethod={toggleMethod}
					onClearMethods={() => (selectedMethods = [])}
					onClearAll={clearAllFilters}
					{hasActiveFilters}
				/>
			</div>

			<div class="lg:col-span-3">
				<ItemTable items={paginatedItems} onSelectItem={selectItem} />
				<Pagination
					currentPage={listPage}
					totalItems={filteredItems.length}
					itemsPerPage={listPerPage}
					onPageChange={(p) => (listPage = p)}
				/>
			</div>
		</div>
	{/if}
</div>
