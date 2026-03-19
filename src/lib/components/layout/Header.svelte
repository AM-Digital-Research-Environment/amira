<script lang="ts">
	import { theme } from '$lib/stores/data';
	import Button from '$lib/components/ui/button.svelte';
	import { Menu, Sun, Moon } from '@lucide/svelte';

	interface Props {
		onMenuClick?: () => void;
		isSidebarCollapsed?: boolean;
	}

	let { onMenuClick }: Props = $props();

	function toggleTheme() {
		const newTheme = $theme === 'dark' ? 'light' : 'dark';
		theme.setTheme(newTheme);
	}
</script>

<header class="header gap-4">
	<!-- Mobile menu button -->
	<Button variant="ghost" size="icon" class="lg:hidden flex-shrink-0" onclick={onMenuClick}>
		{#snippet children()}
			<Menu class="h-5 w-5" />
		{/snippet}
	</Button>

	<!-- Page title area -->
	<div class="flex-1 flex items-center gap-3 min-w-0">
		<div class="hidden lg:flex items-center gap-3">
			<div class="h-6 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40 flex-shrink-0"></div>
			<h1 class="header-title truncate">Africa Multiple WissKI Explorer</h1>
		</div>
		<h1 class="lg:hidden text-lg font-semibold font-display truncate">Africa Multiple WissKI Explorer</h1>
	</div>

	<!-- Theme toggle -->
	<Button variant="ghost" size="icon" onclick={toggleTheme} class="flex-shrink-0">
		{#snippet children()}
			<div class="relative w-5 h-5">
				{#if $theme === 'dark'}
					<Sun class="h-5 w-5 transition-transform duration-300" />
				{:else}
					<Moon class="h-5 w-5 transition-transform duration-300" />
				{/if}
			</div>
		{/snippet}
	</Button>
</header>
