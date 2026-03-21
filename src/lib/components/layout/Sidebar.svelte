<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { Layers, ChevronsLeft, X, Home, Folder, BarChart3, Briefcase, Share2, BookOpen, Users, FileText, Building2, UsersRound, MapPin, Languages, Tag, BookType, Sparkles } from '@lucide/svelte';
	import type { Component } from 'svelte';

	interface Props {
		isOpen?: boolean;
		isCollapsed?: boolean;
		onClose?: () => void;
		onToggleCollapse?: () => void;
	}

	let {
		isOpen = false,
		isCollapsed = false,
		onClose,
		onToggleCollapse
	}: Props = $props();

	interface NavGroup {
		label: string;
		items: { href: string; label: string; icon: Component }[];
	}

	const navGroups: NavGroup[] = [
		{
			label: 'Browse',
			items: [
				{ href: `${base}/whats-new`, label: "What's New", icon: Sparkles },
				{ href: `${base}/research-sections`, label: 'Research Sections', icon: BookOpen },
				{ href: `${base}/projects`, label: 'Projects', icon: Briefcase },
				{ href: `${base}/research-items`, label: 'Research Items', icon: FileText },
				{ href: `${base}/people`, label: 'People', icon: Users },
				{ href: `${base}/groups`, label: 'Groups', icon: UsersRound },
				{ href: `${base}/institutions`, label: 'Institutions', icon: Building2 },
				{ href: `${base}/locations`, label: 'Locations', icon: MapPin },
				{ href: `${base}/languages`, label: 'Languages', icon: Languages },
				{ href: `${base}/subjects`, label: 'Subjects & Tags', icon: Tag },
				{ href: `${base}/resource-types`, label: 'Resource Types', icon: Layers },
				{ href: `${base}/genres`, label: 'Genres', icon: BookType }
			]
		},
		{
			label: 'Visualize',
			items: [
				{ href: `${base}/`, label: 'Overview', icon: Home },
				{ href: `${base}/collections`, label: 'Collections', icon: Folder },
				{ href: `${base}/compare`, label: 'Compare', icon: BarChart3 },
				{ href: `${base}/network`, label: 'Network', icon: Share2 }
			]
		}
	];

	function isActive(href: string) {
		const path = $page.url.pathname;
		if (href === `${base}/`) {
			return path === `${base}/` || path === base;
		}
		return path.startsWith(href);
	}

	function handleNavClick() {
		// Close mobile sidebar on navigation
		if (window.innerWidth < 1024) {
			onClose?.();
		}
	}
</script>

<!-- Mobile overlay -->
<button
	type="button"
	class="sidebar-overlay lg:hidden"
	data-visible={isOpen}
	onclick={onClose}
	aria-label="Close sidebar"
></button>

<!-- Sidebar wrapper for layout spacing -->
<div
	class="sidebar-wrapper hidden lg:block"
	data-collapsed={isCollapsed}
>
	<!-- This div takes up space in the layout -->
</div>

<!-- Sidebar -->
<aside
	class="sidebar"
	data-collapsed={isCollapsed}
	data-open={isOpen}
>
	<!-- Header -->
	<div class="sidebar-header">
		<a href="{base}/" class="sidebar-logo">
			<img
				src="{base}/logos/UBT logo.jpg"
				alt="University of Bayreuth"
				class="sidebar-logo-icon-img"
			/>
			<span class="sidebar-logo-text">Africa Multiple WissKI Explorer</span>
		</a>

		<!-- Desktop collapse toggle -->
		<button
			type="button"
			class="sidebar-toggle ml-auto hidden lg:flex"
			onclick={onToggleCollapse}
			aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
		>
			<ChevronsLeft class="sidebar-toggle-icon" />
		</button>

		<!-- Mobile close button -->
		<button
			type="button"
			class="sidebar-toggle ml-auto lg:hidden"
			onclick={onClose}
			aria-label="Close sidebar"
		>
			<X class="w-4 h-4" />
		</button>
	</div>

	<!-- Content -->
	<div class="sidebar-content">
		{#each navGroups as group}
			<div class="sidebar-group">
				<div class="sidebar-group-label">{group.label}</div>
				<nav>
					{#each group.items as item}
						{@const Icon = item.icon}
						<a
							href={item.href}
							class={cn('sidebar-nav-item', isActive(item.href) && 'active')}
							onclick={handleNavClick}
							title={isCollapsed ? item.label : undefined}
						>
							<span class="sidebar-nav-icon">
								<Icon />
							</span>
							<span class="sidebar-nav-label">{item.label}</span>
						</a>
					{/each}
				</nav>
			</div>
		{/each}
	</div>

	<!-- Footer -->
	<div class="sidebar-footer">
		<a
			href="https://www.africamultiple.uni-bayreuth.de/"
			target="_blank"
			rel="noopener noreferrer"
			class="block mx-auto mb-2 opacity-80 hover:opacity-100 transition-opacity"
			style="max-width: 140px;"
		>
			<img
				src="{base}/logos/africamultiple.jpg"
				alt="Africa Multiple"
				class="w-full h-auto rounded-md"
			/>
		</a>
		<p class="text-2xs text-center" style="color: hsl(var(--sidebar-muted-foreground))">
			v{__APP_VERSION__}
		</p>
		<a
			href="https://www.frederickmadore.com/"
			target="_blank"
			rel="noopener noreferrer"
			class="text-2xs text-center block mt-1 hover:text-primary transition-colors"
			style="color: hsl(var(--sidebar-muted-foreground))"
		>
			Frédérick Madore
		</a>
	</div>

	<!-- Rail for resize/toggle (desktop only) -->
	<button
		type="button"
		class="sidebar-rail hidden lg:flex"
		onclick={onToggleCollapse}
		aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
	></button>
</aside>
