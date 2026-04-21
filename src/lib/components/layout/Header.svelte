<script lang="ts">
	import { theme } from '$lib/stores/data';
	import Button from '$lib/components/ui/button.svelte';
	import { Menu, Sun, Moon, Maximize, Minimize } from '@lucide/svelte';
	import { onMount } from 'svelte';

	interface Props {
		onMenuClick?: () => void;
		isSidebarCollapsed?: boolean;
	}

	let { onMenuClick }: Props = $props();

	function toggleTheme() {
		const newTheme = $theme === 'dark' ? 'light' : 'dark';
		theme.setTheme(newTheme);
	}

	// Fullscreen toggle. Useful when the dashboard is embedded as an iframe --
	// the browser Fullscreen API promotes the document to the entire viewport
	// (the parent page's iframe attribute `allow="fullscreen"` is required for
	// this to work cross-document).
	let isFullscreen = $state(false);

	function syncFullscreen() {
		isFullscreen = !!document.fullscreenElement;
	}

	async function toggleFullscreen() {
		try {
			if (!document.fullscreenElement) {
				await document.documentElement.requestFullscreen();
			} else {
				await document.exitFullscreen();
			}
		} catch {
			// Some browsers/iframe contexts block the request. Fall back silently.
		}
	}

	onMount(() => {
		syncFullscreen();
		document.addEventListener('fullscreenchange', syncFullscreen);
		return () => document.removeEventListener('fullscreenchange', syncFullscreen);
	});
</script>

<header class="header gap-2 lg:gap-4">
	<!-- Mobile menu button -->
	<Button
		variant="ghost"
		size="icon"
		class="lg:hidden flex-shrink-0"
		onclick={onMenuClick}
		aria-label="Open navigation menu"
	>
		{#snippet children()}
			<Menu class="h-5 w-5" />
		{/snippet}
	</Button>

	<!-- Page title area -->
	<div class="flex-1 flex items-center gap-3 min-w-0">
		<div class="hidden lg:flex items-center gap-3">
			<div
				class="h-6 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40 flex-shrink-0"
			></div>
			<h1 class="header-title truncate">Africa Multiple WissKI Explorer</h1>
		</div>
		<h1 class="lg:hidden text-lg font-semibold font-display truncate text-center w-full">
			Africa Multiple WissKI Explorer
		</h1>
	</div>

	<!-- Right-side toggles grouped so the theme + fullscreen buttons sit close
	     together instead of inheriting the header's wide `gap-4`. -->
	<div class="flex items-center gap-0.5 flex-shrink-0">
		<!-- Theme toggle -->
		<Button
			variant="ghost"
			size="icon"
			onclick={toggleTheme}
			aria-label={$theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
		>
			{#snippet children()}
				<div class="relative w-5 h-5">
					{#if $theme === 'dark'}
						<Sun class="h-5 w-5 transition-transform duration-normal ease-out" />
					{:else}
						<Moon class="h-5 w-5 transition-transform duration-normal ease-out" />
					{/if}
				</div>
			{/snippet}
		</Button>

		<!-- Fullscreen toggle (useful when the dashboard is embedded in an iframe) -->
		<Button
			variant="ghost"
			size="icon"
			onclick={toggleFullscreen}
			aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
		>
			{#snippet children()}
				<div class="relative w-5 h-5">
					{#if isFullscreen}
						<Minimize class="h-5 w-5" />
					{:else}
						<Maximize class="h-5 w-5" />
					{/if}
				</div>
			{/snippet}
		</Button>
	</div>
</header>
