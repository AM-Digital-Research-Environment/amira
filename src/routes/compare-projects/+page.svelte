<script lang="ts">
	/**
	 * Legacy redirect — `/compare-projects` is the URL the dashboard shipped
	 * before Phase 5 generalised the compare UI to `/compare/[type]`. We
	 * keep it here as a redirect so old bookmarks, sitemap entries, and
	 * external links don't 404. The actual UI lives in
	 * `src/lib/components/compare/ProjectsCompare.svelte`, rendered by
	 * `/compare/projects`.
	 */
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { SEO, Card, CardContent } from '$lib/components/ui';

	onMount(() => {
		void goto(`${base}/compare/projects`, { replaceState: true });
	});
</script>

<SEO
	title="Compare Projects"
	description="Side-by-side comparison of research metadata across universities and projects"
/>

<div class="space-y-6">
	<Card>
		{#snippet children()}
			<CardContent class="py-12 text-center text-muted-foreground">
				{#snippet children()}
					Redirecting to <a href="{base}/compare/projects" class="text-primary hover:underline">
						/compare/projects
					</a>…
				{/snippet}
			</CardContent>
		{/snippet}
	</Card>
</div>
