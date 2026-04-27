<script lang="ts">
	/**
	 * Type tab bar shared by every compare page. Drives navigation between
	 * `/compare/{projects,people,institutions,subjects,languages,genres}`.
	 * Routes register their canonical type via `data.type` and pass it in
	 * as `current`.
	 */
	import { base } from '$app/paths';
	import { Briefcase, Users, Building2, Tags, Languages, BookOpen } from '@lucide/svelte';
	import { COMPARE_TYPES, type CompareType } from '$lib/components/compare/compareTypes';
	import { cn } from '$lib/utils/cn';

	interface Props {
		current: CompareType;
	}

	let { current }: Props = $props();

	const META: Record<CompareType, { label: string; icon: typeof Briefcase }> = {
		projects: { label: 'Projects', icon: Briefcase },
		people: { label: 'People', icon: Users },
		institutions: { label: 'Institutions', icon: Building2 },
		subjects: { label: 'Subjects', icon: Tags },
		languages: { label: 'Languages', icon: Languages },
		genres: { label: 'Genres', icon: BookOpen }
	};
</script>

<div role="tablist" aria-label="Compare entity type" class="flex flex-wrap gap-2">
	{#each COMPARE_TYPES as type (type)}
		{@const meta = META[type]}
		{@const Icon = meta.icon}
		<a
			href="{base}/compare/{type}"
			role="tab"
			aria-selected={current === type}
			class={cn(
				'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
				current === type
					? 'bg-primary text-primary-foreground border-primary'
					: 'bg-card border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground'
			)}
		>
			<Icon class="h-4 w-4" />
			{meta.label}
		</a>
	{/each}
</div>
