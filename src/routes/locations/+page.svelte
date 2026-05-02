<script lang="ts">
	import {
		StatCard,
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		Badge,
		BackToList,
		ChartCard,
		SEO
	} from '$lib/components/ui';
	import {
		EntityCard,
		EntityBrowseGrid,
		EntityToolbar,
		EntityDetailHeader,
		SearchableItemsCard,
		FilterToggleBar,
		applyEntitySort,
		type EntitySort
	} from '$lib/components/entity-browse';
	import {
		allCollections,
		enrichedLocations,
		ensureEnrichedLocations,
		ensureCollections
	} from '$lib/stores/data';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { createEntityDetailState } from '$lib/utils/loaders';
	import {
		MiniMap,
		EntityKnowledgeGraph,
		BarChart,
		Timeline,
		ChoroplethMap
	} from '$lib/components/charts';
	import { extractItemYear } from '$lib/utils/transforms/dates';
	import type { BarChartDataPoint, TimelineDataPoint } from '$lib/types';
	import { EntityDashboardSection } from '$lib/components/dashboards';
	import { page } from '$app/stores';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import { createSearchFilter } from '$lib/utils/search';
	import { locationUrl } from '$lib/utils/urls';
	import type { CollectionItem } from '$lib/types';
	import { MapPin, Globe, Building2 } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { getLocationColor } from '$lib/styles';

	const urlSelection = createUrlSelection('name');

	onMount(() => {
		void ensureEnrichedLocations(base);
		if (!selectedName) void ensureCollections(base);
	});

	$effect(() => {
		if (!selectedName) void ensureCollections(base);
	});

	let searchQuery = $state('');
	let viewMode = $state<'countries' | 'regions' | 'cities' | 'current'>('countries');
	let sort = $state<EntitySort>('count-desc');

	let selectedName = $derived($page.url.searchParams.get('name') ?? '');

	interface LocationData {
		name: string;
		type: 'country' | 'region' | 'city' | 'current';
		country?: string;
		region?: string;
		count: number;
		items: CollectionItem[];
	}

	let locationIndex = $derived.by(() => {
		const countries = new SvelteMap<string, LocationData>();
		const regions = new SvelteMap<string, LocationData>();
		const cities = new SvelteMap<string, LocationData>();
		const current = new SvelteMap<string, LocationData>();

		$allCollections.forEach((item) => {
			(item.location?.origin || []).forEach((o) => {
				if (o.l1) {
					if (!countries.has(o.l1)) {
						countries.set(o.l1, { name: o.l1, type: 'country', count: 0, items: [] });
					}
					const c = countries.get(o.l1)!;
					c.count++;
					c.items.push(item);
				}
				if (o.l2 && o.l1) {
					const key = `${o.l2}|${o.l1}`;
					if (!regions.has(key)) {
						regions.set(key, { name: o.l2, type: 'region', country: o.l1, count: 0, items: [] });
					}
					const r = regions.get(key)!;
					r.count++;
					r.items.push(item);
				}
				if (o.l3 && o.l1) {
					const key = `${o.l3}|${o.l1}`;
					if (!cities.has(key)) {
						cities.set(key, {
							name: o.l3,
							type: 'city',
							country: o.l1,
							region: o.l2 || undefined,
							count: 0,
							items: []
						});
					}
					const c = cities.get(key)!;
					c.count++;
					c.items.push(item);
				}
			});
			(item.location?.current || []).forEach((loc) => {
				if (loc) {
					if (!current.has(loc)) {
						current.set(loc, { name: loc, type: 'current', count: 0, items: [] });
					}
					const c = current.get(loc)!;
					c.count++;
					c.items.push(item);
				}
			});
		});

		return { countries, regions, cities, current };
	});

	let countryList = $derived(Array.from(locationIndex.countries.values()));
	let regionList = $derived(Array.from(locationIndex.regions.values()));
	let cityList = $derived(Array.from(locationIndex.cities.values()));
	let currentLocationList = $derived(Array.from(locationIndex.current.values()));

	// Country totals for the archive-wide choropleth. Reuses the country-level
	// aggregation already computed for the browse grid so the choropleth and
	// the country list always show the same numbers.
	let countryChoroplethData = $derived(
		countryList.map((c) => ({ country: c.name, count: c.count }))
	);

	// Top 20 cities by item count, for the list-overview bar chart.
	let topCitiesBar = $derived.by((): BarChartDataPoint[] => {
		return cityList
			.slice()
			.sort((a, b) => b.count - a.count)
			.slice(0, 20)
			.map((c) => ({
				name: c.country ? `${c.name} (${c.country})` : c.name,
				value: c.count
			}));
	});

	// Items per year tagged with at least one origin location. Useful for
	// spotting periods where geographic metadata coverage shifts.
	let locationTaggedTimeline = $derived.by((): TimelineDataPoint[] => {
		const counts = new SvelteMap<number, number>();
		for (const item of $allCollections) {
			const origins = item.location?.origin || [];
			if (origins.length === 0) continue;
			const year = extractItemYear(item);
			if (year == null) continue;
			counts.set(year, (counts.get(year) ?? 0) + 1);
		}
		return Array.from(counts.entries())
			.sort(([a], [b]) => a - b)
			.map(([year, count]) => ({ year, count }));
	});

	let currentList = $derived(
		viewMode === 'countries'
			? countryList
			: viewMode === 'regions'
				? regionList
				: viewMode === 'cities'
					? cityList
					: currentLocationList
	);

	const searchLocations = createSearchFilter<LocationData>([(l) => l.name, (l) => l.country]);
	let visibleLocations = $derived(applyEntitySort(searchLocations(currentList, searchQuery), sort));

	const detail = createEntityDetailState('location', () => selectedName);

	let selectedLocation = $derived.by((): LocationData | null => {
		if (!selectedName) return null;
		if (locationIndex.countries.has(selectedName))
			return locationIndex.countries.get(selectedName)!;
		for (const region of locationIndex.regions.values()) {
			if (region.name === selectedName) return region;
		}
		for (const city of locationIndex.cities.values()) {
			if (city.name === selectedName) return city;
		}
		for (const loc of locationIndex.current.values()) {
			if (loc.name === selectedName) return loc;
		}
		// Fallback when collections aren't loaded yet: synthesise the location
		// from the per-entity JSON so the detail view can render immediately.
		// The specific sub-type (country/region/city/current) is unknown here,
		// so default to 'country' — the most common bucket in the dataset.
		if (detail.data?.meta) {
			return {
				name: detail.data.meta.name ?? selectedName,
				type: 'country',
				count: detail.data.meta.count ?? 0,
				items: detail.items
			};
		}
		return null;
	});

	function selectLocation(loc: LocationData) {
		urlSelection.pushToUrl(loc.name);
		scrollToTop();
	}

	function clearSelection() {
		urlSelection.removeFromUrl();
		scrollToTop();
	}

	function switchView(mode: 'countries' | 'regions' | 'cities' | 'current') {
		viewMode = mode;
		searchQuery = '';
	}

	let locationMapMarkers = $derived.by(() => {
		if (!selectedLocation || !$enrichedLocations) return [];
		const name = selectedLocation.name;
		const markers: { latitude: number; longitude: number; label: string; color?: string }[] = [];

		if (selectedLocation.type === 'country') {
			const loc = $enrichedLocations.countries[name];
			if (loc?.latitude && loc?.longitude) {
				markers.push({
					latitude: loc.latitude,
					longitude: loc.longitude,
					label: name,
					color: getLocationColor('country')
				});
			}
			citiesInLocation.forEach((city) => {
				const key = `${city.name}|${city.country}`;
				const cityLoc = $enrichedLocations!.cities[key];
				if (cityLoc?.latitude && cityLoc?.longitude) {
					markers.push({
						latitude: cityLoc.latitude,
						longitude: cityLoc.longitude,
						label: city.name,
						color: getLocationColor('city')
					});
				}
			});
		} else if (selectedLocation.type === 'city' && selectedLocation.country) {
			const key = `${name}|${selectedLocation.country}`;
			const loc = $enrichedLocations.cities[key];
			if (loc?.latitude && loc?.longitude) {
				markers.push({
					latitude: loc.latitude,
					longitude: loc.longitude,
					label: name,
					color: getLocationColor('city')
				});
			} else {
				const countryLoc = $enrichedLocations.countries[selectedLocation.country];
				if (countryLoc?.latitude && countryLoc?.longitude) {
					markers.push({
						latitude: countryLoc.latitude,
						longitude: countryLoc.longitude,
						label: `${name} (${selectedLocation.country})`,
						color: getLocationColor('city')
					});
				}
			}
		} else if (selectedLocation.type === 'region' && selectedLocation.country) {
			const key = `${name}|${selectedLocation.country}`;
			const loc = $enrichedLocations.regions[key];
			if (loc?.latitude && loc?.longitude) {
				markers.push({
					latitude: loc.latitude,
					longitude: loc.longitude,
					label: name,
					color: getLocationColor('region')
				});
			} else {
				const countryLoc = $enrichedLocations.countries[selectedLocation.country];
				if (countryLoc?.latitude && countryLoc?.longitude) {
					markers.push({
						latitude: countryLoc.latitude,
						longitude: countryLoc.longitude,
						label: `${name} (${selectedLocation.country})`,
						color: getLocationColor('region')
					});
				}
			}
			citiesInLocation.forEach((city) => {
				const cityKey = `${city.name}|${city.country}`;
				const cityLoc = $enrichedLocations!.cities[cityKey];
				if (cityLoc?.latitude && cityLoc?.longitude) {
					markers.push({
						latitude: cityLoc.latitude,
						longitude: cityLoc.longitude,
						label: city.name,
						color: getLocationColor('city')
					});
				}
			});
		}

		return markers;
	});

	let regionsInCountry = $derived.by(() => {
		if (!selectedLocation || selectedLocation.type !== 'country') return [];
		return regionList.filter((r) => r.country === selectedLocation.name);
	});

	let citiesInLocation = $derived.by(() => {
		if (!selectedLocation) return [];
		if (selectedLocation.type === 'country') {
			return cityList.filter((c) => c.country === selectedLocation.name);
		}
		if (selectedLocation.type === 'region') {
			return cityList.filter(
				(c) => c.region === selectedLocation.name && c.country === selectedLocation.country
			);
		}
		return [];
	});

	function iconFor(type: LocationData['type']) {
		if (type === 'country') return Globe;
		if (type === 'current') return Building2;
		return MapPin;
	}

	function iconColorFor(type: LocationData['type']) {
		if (type === 'country') return 'text-location-country';
		if (type === 'region') return 'text-location-region';
		if (type === 'city') return 'text-location-city';
		return 'text-location-current';
	}

	function typeLabel(type: LocationData['type']) {
		if (type === 'country') return 'Country';
		if (type === 'region') return 'Region';
		if (type === 'city') return 'City';
		return 'Current Location';
	}

	function wisskiFor(loc: LocationData) {
		if (loc.type === 'country') return { category: 'countries', key: loc.name };
		if (loc.type === 'region' && loc.country)
			return { category: 'regions', key: `${loc.name}|${loc.country}` };
		if (loc.type === 'city') {
			const suffix = loc.region || loc.country;
			if (suffix) return { category: 'cities', key: `${loc.name}|${suffix}` };
		}
		if (loc.type === 'current') return { category: 'institutions', key: loc.name };
		return { category: '', key: '' };
	}

	/** Resolve a location row to (lat, lng) via the enriched-locations store.
	 *  Returns null if the location can't be geocoded. */
	function geocode(loc: LocationData): { latitude: number; longitude: number } | null {
		if (!$enrichedLocations) return null;
		if (loc.type === 'country') {
			const c = $enrichedLocations.countries[loc.name];
			if (c?.latitude && c?.longitude) return { latitude: c.latitude, longitude: c.longitude };
		}
		if (loc.type === 'region' && loc.country) {
			const r = $enrichedLocations.regions[`${loc.name}|${loc.country}`];
			if (r?.latitude && r?.longitude) return { latitude: r.latitude, longitude: r.longitude };
		}
		if (loc.type === 'city' && loc.country) {
			const c = $enrichedLocations.cities[`${loc.name}|${loc.country}`];
			if (c?.latitude && c?.longitude) return { latitude: c.latitude, longitude: c.longitude };
		}
		if (loc.type === 'current') {
			// Current locations are bare strings — try country → city → region.
			const country = $enrichedLocations.countries[loc.name];
			if (country?.latitude && country?.longitude) {
				return { latitude: country.latitude, longitude: country.longitude };
			}
			for (const [key, c] of Object.entries($enrichedLocations.cities)) {
				if (key.split('|')[0] === loc.name && c.latitude && c.longitude) {
					return { latitude: c.latitude, longitude: c.longitude };
				}
			}
			for (const [key, r] of Object.entries($enrichedLocations.regions)) {
				if (key.split('|')[0] === loc.name && r.latitude && r.longitude) {
					return { latitude: r.latitude, longitude: r.longitude };
				}
			}
		}
		return null;
	}

	// Markers for the top-of-page browse map: everything in the current view
	// that can be geocoded. Each marker's popup links to the detail view.
	let browseMapMarkers = $derived.by(() => {
		if (!$enrichedLocations) return [];
		return visibleLocations
			.map((loc) => {
				const coords = geocode(loc);
				if (!coords) return null;
				return {
					latitude: coords.latitude,
					longitude: coords.longitude,
					label: loc.name,
					sublabel: `${typeLabel(loc.type)} · ${loc.count} item${loc.count === 1 ? '' : 's'}`,
					color: getLocationColor(loc.type),
					href: locationUrl(loc.name)
				};
			})
			.filter((m): m is NonNullable<typeof m> => m !== null);
	});
</script>

<SEO
	title="Locations"
	description="Explore geographic origins and current holding locations of research items in the Africa Multiple Cluster of Excellence — country choropleth, point map, and per-location archives."
	keywords={[
		'locations',
		'geography',
		'African geography',
		'choropleth map',
		'archive geography',
		'origins'
	]}
/>

<div class="space-y-8 animate-slide-in-up">
	<div>
		<h1 class="page-title">Locations</h1>
		<p class="page-subtitle">
			Explore geographic origins and current holding locations of research items
		</p>
	</div>

	{#if selectedLocation}
		{@const wisski = wisskiFor(selectedLocation)}
		<div class="space-y-6">
			<BackToList show={true} onclick={clearSelection} label="Back to locations" />
			<EntityDetailHeader
				title={selectedLocation.name}
				icon={iconFor(selectedLocation.type)}
				iconColorClass={iconColorFor(selectedLocation.type)}
				subtitle={selectedLocation.country && selectedLocation.type !== 'country'
					? `In ${selectedLocation.country}`
					: undefined}
				count={selectedLocation.count}
				wisskiCategory={wisski.category || undefined}
				wisskiKey={wisski.key || undefined}
			>
				{#snippet badges()}
					<Badge>
						{#snippet children()}{typeLabel(selectedLocation.type)}{/snippet}
					</Badge>
					{#if selectedLocation.country && selectedLocation.type !== 'country'}
						<button
							type="button"
							onclick={() => urlSelection.pushToUrl(selectedLocation.country || '')}
							class="hover:opacity-80 transition-opacity"
						>
							<Badge variant="secondary" class="hover:bg-primary/20 transition-colors">
								{#snippet children()}{selectedLocation.country}{/snippet}
							</Badge>
						</button>
					{/if}
				{/snippet}
			</EntityDetailHeader>

			{#if locationMapMarkers.length > 0}
				<MiniMap markers={locationMapMarkers} class="h-chart-sm" />
			{/if}

			{#if regionsInCountry.length > 0}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}
										<span class="flex items-center gap-2">
											<MapPin class="h-5 w-5 text-location-region" />
											Regions
											<Badge variant="secondary">
												{#snippet children()}{regionsInCountry.length}{/snippet}
											</Badge>
										</span>
									{/snippet}
								</CardTitle>
							{/snippet}
						</CardHeader>
						<CardContent>
							{#snippet children()}
								<div class="flex flex-wrap gap-2">
									{#each regionsInCountry as region (`${region.name}|${region.country ?? ''}`)}
										<button
											onclick={() => selectLocation(region)}
											class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-sm text-foreground hover:text-primary hover:bg-muted transition-colors"
										>
											{region.name}
											<span class="text-xs text-muted-foreground">({region.count})</span>
										</button>
									{/each}
								</div>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}

			{#if citiesInLocation.length > 0}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<CardTitle class="text-lg">
									{#snippet children()}
										<span class="flex items-center gap-2">
											<MapPin class="h-5 w-5 text-location-city" />
											Cities
											<Badge variant="secondary">
												{#snippet children()}{citiesInLocation.length}{/snippet}
											</Badge>
										</span>
									{/snippet}
								</CardTitle>
							{/snippet}
						</CardHeader>
						<CardContent>
							{#snippet children()}
								<div class="flex flex-wrap gap-2">
									{#each citiesInLocation as city (`${city.name}|${city.country ?? ''}|${city.region ?? ''}`)}
										<button
											onclick={() => selectLocation(city)}
											class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-sm text-foreground hover:text-primary hover:bg-muted transition-colors"
										>
											{city.name}
											<span class="text-xs text-muted-foreground">({city.count})</span>
										</button>
									{/each}
								</div>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>
			{/if}

			<SearchableItemsCard items={selectedLocation.items} />

			<EntityDashboardSection
				entityType="location"
				entityId={selectedLocation.name}
				items={selectedLocation.items}
				enrichedLocations={$enrichedLocations}
				data={detail.data}
			/>

			<EntityKnowledgeGraph
				entityType="location"
				entityId={selectedLocation.name}
				title="Place-based knowledge graph"
			/>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-4">
			<StatCard
				label="Countries"
				value={countryList.length}
				icon={Globe}
				iconBgClass="bg-location-country/10"
			/>
			<StatCard
				label="Regions"
				value={regionList.length}
				icon={MapPin}
				iconBgClass="bg-location-region/10"
			/>
			<StatCard
				label="Cities"
				value={cityList.length}
				icon={MapPin}
				iconBgClass="bg-location-city/10"
			/>
			<StatCard
				label="Current Locations"
				value={currentLocationList.length}
				icon={Building2}
				iconBgClass="bg-location-current/10"
			/>
		</div>

		<!-- View switcher -->
		<FilterToggleBar
			options={[
				{ value: 'countries', label: 'countries' },
				{ value: 'regions', label: 'regions' },
				{ value: 'cities', label: 'cities' },
				{ value: 'current', label: 'Current' }
			]}
			value={viewMode}
			onChange={(v) => switchView(v as typeof viewMode)}
			capitalize
			aria-label="Choose location view mode"
		/>

		<!-- Browse map: shows every location in the current view that can be
		     geocoded. Click a marker to open its detail page. -->
		{#if browseMapMarkers.length > 0}
			<div class="space-y-1">
				<MiniMap markers={browseMapMarkers} class="h-chart-md" />
				<p class="text-xs text-muted-foreground">
					Showing {browseMapMarkers.length} of {visibleLocations.length}
					{viewMode === 'current' ? 'locations' : viewMode} on the map. Click a marker to open the location
					page.
				</p>
			</div>
		{/if}

		{#if countryChoroplethData.length > 0}
			<ChartCard
				title="Items per country"
				subtitle="Geographic distribution of origin countries across the archive"
				contentHeight="h-chart-2xl"
			>
				<ChoroplethMap data={countryChoroplethData} class="h-full w-full" />
			</ChartCard>
		{/if}

		<div class="grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-2">
			{#if topCitiesBar.length > 0}
				<ChartCard
					title="Top cities"
					subtitle="Most-tagged origin cities across the archive"
					contentHeight="h-chart-lg"
				>
					<BarChart data={topCitiesBar} class="h-full w-full" />
				</ChartCard>
			{/if}

			{#if locationTaggedTimeline.length > 0}
				<ChartCard
					title="Location-tagged items per year"
					subtitle="How often items carry an origin location across the timeline"
					contentHeight="h-chart-lg"
				>
					<Timeline data={locationTaggedTimeline} class="h-full w-full" />
				</ChartCard>
			{/if}
		</div>

		<EntityToolbar
			{searchQuery}
			onSearchChange={(v) => (searchQuery = v)}
			searchPlaceholder="Search {viewMode}..."
			{sort}
			onSortChange={(v) => (sort = v)}
			totalCount={visibleLocations.length}
			totalLabel={viewMode === 'current' ? 'locations' : viewMode}
		/>

		<EntityBrowseGrid
			items={visibleLocations}
			getKey={(l) => `${l.type}:${l.name}|${l.country ?? ''}|${l.region ?? ''}`}
			emptyMessage="No locations match your search"
		>
			{#snippet card(loc)}
				<EntityCard
					name={loc.name}
					subtitle={loc.country && loc.type !== 'country' ? loc.country : undefined}
					description={typeLabel(loc.type)}
					count={loc.count}
					countLabel="item"
					icon={iconFor(loc.type)}
					iconColorClass={iconColorFor(loc.type)}
					onclick={() => selectLocation(loc)}
				/>
			{/snippet}
		</EntityBrowseGrid>
	{/if}
</div>
