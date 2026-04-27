<script lang="ts">
	/**
	 * Generalised compare route — accepts a `[type]` segment and renders the
	 * appropriate side-by-side comparison UI.
	 *
	 * Roadmap-parity Phase 5 foundation. The projects implementation is the
	 * existing `/compare-projects` page (kept in place to avoid duplicating
	 * 500 lines of selectors); this route redirects users to that
	 * implementation while a future PR migrates the projects UI in here.
	 *
	 * Other types render a stub with a "coming soon" notice and the same
	 * tab bar so users can hop between types without going through the
	 * sidebar.
	 */
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { Card, CardHeader, CardTitle, CardContent, SEO } from '$lib/components/ui';
	import {
		Briefcase,
		Users,
		Building2,
		Tags,
		Languages,
		BookOpen,
		Construction
	} from '@lucide/svelte';
	import { COMPARE_TYPES, type CompareType } from './compareTypes';
	import { cn } from '$lib/utils/cn';

	interface Props {
		data: { type: CompareType };
	}

	let { data }: Props = $props();

	const TYPE_META: Record<
		CompareType,
		{ label: string; description: string; icon: typeof Briefcase }
	> = {
		projects: {
			label: 'Projects',
			description: 'Side-by-side comparison of research metadata across universities and projects',
			icon: Briefcase
		},
		people: {
			label: 'People',
			description: 'Compare two contributors — items, co-authors, subjects, year span',
			icon: Users
		},
		institutions: {
			label: 'Institutions',
			description: 'Compare two institutions — affiliated contributors, projects, geographic reach',
			icon: Building2
		},
		subjects: {
			label: 'Subjects',
			description: 'Compare two subject headings — co-occurring subjects, contributors, timelines',
			icon: Tags
		},
		languages: {
			label: 'Languages',
			description: 'Compare two languages — corpus size, contributors, geographic distribution',
			icon: Languages
		},
		genres: {
			label: 'Genres',
			description: 'Compare two genres — language mix, subjects, timelines',
			icon: BookOpen
		}
	};

	let title = $derived(`Compare ${TYPE_META[data.type].label}`);
	let description = $derived(TYPE_META[data.type].description);

	// Projects is the only fully-implemented type today — the existing
	// `/compare-projects` page hosts the implementation. Redirect on mount
	// so the canonical `/compare/projects` URL works without duplicating
	// 500 lines into this route. The redirect is replaced (no back-button
	// trap), so users land directly on the working page.
	onMount(() => {
		if (data.type === 'projects') {
			void goto(`${base}/compare-projects`, { replaceState: true });
		}
	});
</script>

<SEO {title} {description} />

<div class="space-y-6">
	<div class="animate-slide-in-up">
		<h1 class="page-title">{title}</h1>
		<p class="page-subtitle">{description}</p>
	</div>

	<!-- Type tab bar — flex-wrap so it lays out cleanly on mobile. -->
	<div role="tablist" aria-label="Compare entity type" class="flex flex-wrap gap-2">
		{#each COMPARE_TYPES as type (type)}
			{@const meta = TYPE_META[type]}
			{@const Icon = meta.icon}
			<a
				href="{base}/compare/{type}"
				role="tab"
				aria-selected={data.type === type}
				class={cn(
					'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
					data.type === type
						? 'bg-primary text-primary-foreground border-primary'
						: 'bg-card border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground'
				)}
			>
				<Icon class="h-4 w-4" />
				{meta.label}
			</a>
		{/each}
	</div>

	{#if data.type === 'projects'}
		<!-- The redirect in onMount handles this; the placeholder below shows
			 briefly before navigation completes. -->
		<Card>
			{#snippet children()}
				<CardContent class="py-12 text-center text-muted-foreground">
					{#snippet children()}
						Loading projects comparison…
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>
	{:else}
		<Card>
			{#snippet children()}
				<CardHeader>
					{#snippet children()}
						<CardTitle class="flex items-center gap-2">
							{#snippet children()}
								<Construction class="h-5 w-5 text-muted-foreground" />
								Coming soon
							{/snippet}
						</CardTitle>
					{/snippet}
				</CardHeader>
				<CardContent class="space-y-3 text-sm text-muted-foreground">
					{#snippet children()}
						<p>
							{TYPE_META[data.type].label} comparison is part of the visualisation parity roadmap and
							is being built next. The shape will mirror the projects view: paired entity selectors at
							the top, a 6-axis profile radar, and overlap-aware charts (timelines, top-N breakdowns,
							network previews).
						</p>
						<p>
							In the meantime,
							<a href="{base}/compare/projects" class="text-primary hover:underline"
								>compare projects</a
							>
							is fully implemented, or visit individual entity pages from the directory.
						</p>
					{/snippet}
				</CardContent>
			{/snippet}
		</Card>
	{/if}
</div>
