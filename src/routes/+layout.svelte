<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { base } from '$app/paths';
	import { Sidebar, Header } from '$lib/components/layout';
	import { ScrollToTop } from '$lib/components/ui';
	import {
		initializeData,
		theme,
		isLoading,
		collectionsLoading,
		loadError
	} from '$lib/stores/data';
	import type { Snippet } from 'svelte';
	import { AlertCircle } from '@lucide/svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	let sidebarOpen = $state(false);
	let sidebarCollapsed = $state(false);

	onMount(() => {
		// Initialize theme
		theme.init();

		// Load saved sidebar state
		const savedCollapsed = localStorage.getItem('sidebar-collapsed');
		if (savedCollapsed !== null) {
			sidebarCollapsed = savedCollapsed === 'true';
		}

		// Load data
		if (browser) {
			initializeData(base);
		}
	});

	function toggleSidebarCollapse() {
		sidebarCollapsed = !sidebarCollapsed;
		if (browser) {
			localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
		}
	}
</script>

<div
	class="flex min-h-screen bg-background"
	style:--sidebar-offset={sidebarCollapsed
		? 'var(--layout-sidebar-width-icon)'
		: 'var(--layout-sidebar-width)'}
>
	<Sidebar
		isOpen={sidebarOpen}
		isCollapsed={sidebarCollapsed}
		onClose={() => (sidebarOpen = false)}
		onToggleCollapse={toggleSidebarCollapse}
	/>

	<div class="flex-1 flex flex-col min-w-0">
		<Header
			onMenuClick={() => (sidebarOpen = !sidebarOpen)}
			isSidebarCollapsed={sidebarCollapsed}
		/>

		<main id="app-scroll" class="flex-1 p-4 lg:p-6 overflow-auto">
			{#if $loadError}
				<div class="flex items-center justify-center h-64 animate-fade-in">
					<div class="text-center max-w-md">
						<div
							class="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4"
						>
							<AlertCircle class="h-8 w-8 text-destructive" />
						</div>
						<h2 class="text-lg font-display font-semibold text-destructive">Error Loading Data</h2>
						<p class="text-sm text-muted-foreground mt-2">{$loadError}</p>
						<button
							class="mt-4 px-4 py-2 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
							onclick={() => window.location.reload()}
						>
							Try Again
						</button>
					</div>
				</div>
			{:else}
				<!--
					Children render unconditionally so the page header (the LCP
					element on most routes) paints immediately. Two-tier load:
					`isLoading` covers the lightweight stores (~500 kB) and
					flips false within a few hundred ms. `collectionsLoading`
					covers the heavier per-university dumps (~13 MB) and stays
					true while they trickle in — the banner stays up so the
					user knows charts will fill in shortly. Routes that don't
					need collections (people, institutions, groups,
					project-explorer) are fully interactive once `isLoading`
					flips, regardless of `collectionsLoading`.
				-->
				{#if $isLoading || $collectionsLoading}
					<div
						class="flex items-center justify-center gap-2 mb-4 text-sm text-muted-foreground animate-fade-in"
						aria-live="polite"
					>
						<div
							class="h-3 w-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin"
						></div>
						<span>{$isLoading ? 'Loading research data…' : 'Indexing collections…'}</span>
					</div>
				{/if}
				<div class="animate-fade-in">
					{@render children()}
				</div>
			{/if}
		</main>
	</div>
	<ScrollToTop target="#app-scroll" />
</div>
