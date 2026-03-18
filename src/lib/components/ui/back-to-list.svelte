<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';

	let {
		show = true,
		onclick,
		label = 'Back to list'
	}: {
		show?: boolean;
		onclick: () => void;
		label?: string;
	} = $props();
</script>

{#if show}
	<button
		{onclick}
		class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
	>
		<ArrowLeft class="h-4 w-4" />
		{label}
	</button>
{/if}
