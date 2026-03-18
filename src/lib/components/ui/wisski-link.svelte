<script lang="ts">
	import { ExternalLink } from '@lucide/svelte';
	import { getWisskiUrl } from '$lib/utils/wisskiUrl';

	interface Props {
		category: string;
		entityKey: string;
		class?: string;
	}

	let { category, entityKey, class: className = '' }: Props = $props();

	let href = $derived(getWisskiUrl(category, entityKey));
</script>

{#if href}
	<a
		{href}
		target="_blank"
		rel="noopener noreferrer"
		title="View in WissKI"
		class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors {className}"
	>
		<ExternalLink class="h-3 w-3" />
		WissKI
	</a>
{/if}
