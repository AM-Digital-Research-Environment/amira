<script lang="ts">
	import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, Input, Pagination, CollectionItemRow, BackToList, SEO } from '$lib/components/ui';
	import { allCollections, enrichedLocations } from '$lib/stores/data';
	import { MiniMap } from '$lib/components/charts';
	import { page } from '$app/stores';
	import { createUrlSelection, scrollToTop } from '$lib/utils/urlSelection';
	import { createSearchFilter } from '$lib/utils/search';
	import { paginate } from '$lib/utils/pagination';
	import type { CollectionItem } from '$lib/types';
	import { MapPin, Globe, FileText } from '@lucide/svelte';
	import { WissKILink } from '$lib/components/ui';

	const urlSelection = createUrlSelection('name');

	let searchQuery = $state('');
	let selectedName = $state('');
	let viewMode = $state<'countries' | 'regions' | 'cities'>('countries');

	// Sync from URL query param
	$effect(() => {
		const urlName = $page.url.searchParams.get('name');
		if (urlName) selectedName = urlName;
	});

	// Build location index from collection items
	interface LocationData {
		name: string;
		type: 'country' | 'region' | 'city';
		country?: string;
		region?: string;
		count: number;
		items: CollectionItem[];
	}

	let locationIndex = $derived.by(() => {
		const countries = new Map<string, LocationData>();
		const regions = new Map<string, LocationData>();
		const cities = new Map<string, LocationData>();

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
						cities.set(key, { name: o.l3, type: 'city', country: o.l1, region: o.l2 || undefined, count: 0, items: [] });
					}
					const c = cities.get(key)!;
					c.count++;
					c.items.push(item);
				}
			});
		});

		return { countries, regions, cities };
	});

	let countryList = $derived(
		Array.from(locationIndex.countries.values()).sort((a, b) => b.count - a.count)
	);

	let regionList = $derived(
		Array.from(locationIndex.regions.values()).sort((a, b) => b.count - a.count)
	);

	let cityList = $derived(
		Array.from(locationIndex.cities.values()).sort((a, b) => b.count - a.count)
	);

	let currentList = $derived(
		viewMode === 'countries' ? countryList : viewMode === 'regions' ? regionList : cityList
	);

	const searchLocations = createSearchFilter<LocationData>([(l) => l.name, (l) => l.country]);

	let filteredLocations = $derived(searchLocations(currentList, searchQuery));

	// Selected location
	let selectedLocation = $derived.by((): LocationData | null => {
		if (!selectedName) return null;
		if (locationIndex.countries.has(selectedName)) return locationIndex.countries.get(selectedName)!;
		for (const region of locationIndex.regions.values()) {
			if (region.name === selectedName) return region;
		}
		for (const city of locationIndex.cities.values()) {
			if (city.name === selectedName) return city;
		}
		return null;
	});

	// Pagination for items
	const itemsPerPage = 10;
	let itemPage = $state(0);
	let paginatedItems = $derived.by(() => {
		if (!selectedLocation) return [];
		return paginate(selectedLocation.items, itemPage, itemsPerPage);
	});

	$effect(() => {
		selectedName;
		itemPage = 0;
	});

	function selectLocation(loc: LocationData) {
		selectedName = loc.name;
		urlSelection.pushToUrl(loc.name);
		scrollToTop();
	}

	function clearSelection() {
		selectedName = '';
		urlSelection.removeFromUrl();
		scrollToTop();
	}

	// Map markers for selected location
	let locationMapMarkers = $derived.by(() => {
		if (!selectedLocation || !$enrichedLocations) return [];
		const name = selectedLocation.name;
		const markers: { latitude: number; longitude: number; label: string }[] = [];

		if (selectedLocation.type === 'country') {
			const loc = $enrichedLocations.countries[name];
			if (loc?.latitude && loc?.longitude) {
				markers.push({ latitude: loc.latitude, longitude: loc.longitude, label: name });
			}
			// Also show cities
			citiesInLocation.forEach((city) => {
				const key = `${city.name}|${city.country}`;
				const cityLoc = $enrichedLocations!.cities[key];
				if (cityLoc?.latitude && cityLoc?.longitude) {
					markers.push({ latitude: cityLoc.latitude, longitude: cityLoc.longitude, label: city.name });
				}
			});
		} else if (selectedLocation.type === 'city' && selectedLocation.country) {
			const key = `${name}|${selectedLocation.country}`;
			const loc = $enrichedLocations.cities[key];
			if (loc?.latitude && loc?.longitude) {
				markers.push({ latitude: loc.latitude, longitude: loc.longitude, label: name });
			} else {
				// Fallback to country coordinates
				const countryLoc = $enrichedLocations.countries[selectedLocation.country];
				if (countryLoc?.latitude && countryLoc?.longitude) {
					markers.push({ latitude: countryLoc.latitude, longitude: countryLoc.longitude, label: `${name} (${selectedLocation.country})` });
				}
			}
		} else if (selectedLocation.type === 'region' && selectedLocation.country) {
			const key = `${name}|${selectedLocation.country}`;
			const loc = $enrichedLocations.regions[key];
			if (loc?.latitude && loc?.longitude) {
				markers.push({ latitude: loc.latitude, longitude: loc.longitude, label: name });
			} else {
				// Fallback to country coordinates
				const countryLoc = $enrichedLocations.countries[selectedLocation.country];
				if (countryLoc?.latitude && countryLoc?.longitude) {
					markers.push({ latitude: countryLoc.latitude, longitude: countryLoc.longitude, label: `${name} (${selectedLocation.country})` });
				}
			}
			// Also show cities in this region
			citiesInLocation.forEach((city) => {
				const cityKey = `${city.name}|${city.country}`;
				const cityLoc = $enrichedLocations!.cities[cityKey];
				if (cityLoc?.latitude && cityLoc?.longitude) {
					markers.push({ latitude: cityLoc.latitude, longitude: cityLoc.longitude, label: city.name });
				}
			});
		}

		return markers;
	});

	// Regions in a selected country
	let regionsInCountry = $derived.by(() => {
		if (!selectedLocation || selectedLocation.type !== 'country') return [];
		return regionList.filter((r) => r.country === selectedLocation.name);
	});

	// Cities in a selected country or region
	let citiesInLocation = $derived.by(() => {
		if (!selectedLocation) return [];
		if (selectedLocation.type === 'country') {
			return cityList.filter((c) => c.country === selectedLocation.name);
		}
		if (selectedLocation.type === 'region') {
			return cityList.filter((c) => c.region === selectedLocation.name && c.country === selectedLocation.country);
		}
		return [];
	});
</script>
<SEO title="Locations" description="Explore geographic origins of research items across Africa and beyond" />

<div class="space-y-8 animate-slide-in-up">
	<div>
		<h1 class="page-title">Locations</h1>
		<p class="page-subtitle">Explore geographic origins of research items across the cluster</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		<StatCard label="Countries" value={countryList.length} icon={Globe} />
		<StatCard label="Regions" value={regionList.length} icon={MapPin} />
		<StatCard label="Cities" value={cityList.length} icon={MapPin} />
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Location List -->
		<Card class="lg:col-span-1 lg:sticky lg:top-20 lg:self-start overflow-hidden">
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle>
							{#snippet children()}
								<BackToList show={!!selectedName} onclick={clearSelection} />
								<span class="flex items-center justify-between">
									Locations
									<Badge variant="secondary">
										{#snippet children()}{filteredLocations.length}{/snippet}
									</Badge>
								</span>
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent>
					{#snippet children()}
						<div class="space-y-3">
							<!-- View mode toggle -->
							<div class="flex rounded-lg border border-input overflow-hidden">
								<button
									onclick={() => viewMode = 'countries'}
									class="flex-1 px-2 py-1.5 text-xs font-medium transition-colors {viewMode === 'countries' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
								>
									Countries
								</button>
								<button
									onclick={() => viewMode = 'regions'}
									class="flex-1 px-2 py-1.5 text-xs font-medium transition-colors {viewMode === 'regions' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
								>
									Regions
								</button>
								<button
									onclick={() => viewMode = 'cities'}
									class="flex-1 px-2 py-1.5 text-xs font-medium transition-colors {viewMode === 'cities' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
								>
									Cities
								</button>
							</div>

							<Input placeholder="Search locations..." bind:value={searchQuery} />

							<div class="space-y-0.5 max-h-[55vh] overflow-y-auto">
								{#each filteredLocations as loc}
									{@const isSelected = selectedName === loc.name}
									<button
										onclick={() => selectLocation(loc)}
										class="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors {isSelected ? 'bg-primary/10 text-primary font-medium' : ''}"
									>
										<span class="flex items-center justify-between gap-2">
											<span class="truncate">
												{loc.name}
												{#if (loc.type === 'city' || loc.type === 'region') && loc.country}
													<span class="text-muted-foreground text-xs">({loc.country})</span>
												{/if}
											</span>
											<Badge variant="secondary" class="text-[10px] px-1.5 py-0 shrink-0">
												{#snippet children()}{loc.count}{/snippet}
											</Badge>
										</span>
									</button>
								{/each}
								{#if filteredLocations.length === 0}
									<p class="text-sm text-muted-foreground text-center py-4">No locations found</p>
								{/if}
							</div>
						</div>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>

		<!-- Location Detail -->
		<div class="lg:col-span-2 space-y-6">
			{#if selectedLocation}
				<!-- Header -->
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardHeader>
							{#snippet children()}
								<div class="min-w-0">
									<div class="flex items-center gap-2">
										{#if selectedLocation.type === 'country'}
											<Globe class="h-6 w-6 text-primary shrink-0" />
										{:else}
											<MapPin class="h-6 w-6 text-primary shrink-0" />
										{/if}

										<CardTitle class="break-words">
											{#snippet children()}{selectedLocation.name}{/snippet}
										</CardTitle>
									</div>
									<div class="flex flex-wrap gap-2 mt-3">
										<Badge>
											{#snippet children()}{selectedLocation.type === 'country' ? 'Country' : selectedLocation.type === 'region' ? 'Region' : 'City'}{/snippet}
										</Badge>
										{#if selectedLocation.country}
											<button onclick={() => { selectedName = selectedLocation.country || ''; }} class="hover:opacity-80 transition-opacity">
												<Badge variant="secondary" class="hover:bg-primary/20 transition-colors">
													{#snippet children()}{selectedLocation.country}{/snippet}
												</Badge>
											</button>
										{/if}
										<Badge variant="outline">
											{#snippet children()}{selectedLocation.count} item{selectedLocation.count !== 1 ? 's' : ''}{/snippet}
										</Badge>
										{#if selectedLocation.type === 'country'}
											<WissKILink category="countries" entityKey={selectedLocation.name} />
										{:else if selectedLocation.type === 'region' && selectedLocation.country}
											<WissKILink category="regions" entityKey="{selectedLocation.name}|{selectedLocation.country}" />
										{:else if selectedLocation.type === 'city'}
											<!-- Cities in WissKI are keyed by "CityName|RegionName", try region first then country -->
											{#if selectedLocation.region}
												<WissKILink category="cities" entityKey="{selectedLocation.name}|{selectedLocation.region}" />
											{:else if selectedLocation.country}
												<WissKILink category="cities" entityKey="{selectedLocation.name}|{selectedLocation.country}" />
											{/if}
										{/if}
									</div>
								</div>
							{/snippet}
						</CardHeader>
					{/snippet}
				</Card>

				<!-- Map -->
				{#if locationMapMarkers.length > 0}
					<MiniMap markers={locationMapMarkers} class="h-[300px]" />
				{/if}

				<!-- Regions in this country -->
				{#if regionsInCountry.length > 0}
					<Card class="overflow-hidden">
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-lg">
										{#snippet children()}
											<span class="flex items-center gap-2">
												<MapPin class="h-5 w-5 text-primary" />
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
										{#each regionsInCountry as region}
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

				<!-- Cities in this country or region -->
				{#if citiesInLocation.length > 0}
					<Card class="overflow-hidden">
						{#snippet children()}
							<CardHeader>
								{#snippet children()}
									<CardTitle class="text-lg">
										{#snippet children()}
											<span class="flex items-center gap-2">
												<MapPin class="h-5 w-5 text-muted-foreground" />
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
										{#each citiesInLocation as city}
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

				<!-- Research Items -->
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
												{#snippet children()}{selectedLocation.items.length}{/snippet}
											</Badge>
										</span>
									{/snippet}
								</CardTitle>
							{/snippet}
						</CardHeader>
						<CardContent>
							{#snippet children()}
								<ul class="space-y-2">
									{#each paginatedItems as item}
										<CollectionItemRow {item} showProject={true} />
									{/each}
								</ul>
								<Pagination
									currentPage={itemPage}
									totalItems={selectedLocation.items.length}
									{itemsPerPage}
									onPageChange={(p) => itemPage = p}
								/>
							{/snippet}
						</CardContent>
					{/snippet}
				</Card>

			{:else}
				<Card class="overflow-hidden">
					{#snippet children()}
						<CardContent>
							{#snippet children()}
								<div class="flex flex-col items-center justify-center py-16 text-center">
									<MapPin class="h-12 w-12 text-muted-foreground/50 mb-4" />
									<p class="text-lg font-medium text-muted-foreground">Select a location</p>
									<p class="text-sm text-muted-foreground/70 mt-1">
										Choose a country or city from the list to view its associated research items
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
