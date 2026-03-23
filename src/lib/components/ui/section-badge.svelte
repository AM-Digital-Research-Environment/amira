<script lang="ts">
	import Badge from './badge.svelte';
	import { getSectionColor } from '$lib/utils/helpers';

	interface Props {
		section: string;
		class?: string;
		small?: boolean;
	}

	let { section, class: className = '', small = false }: Props = $props();
</script>

<Badge variant="outline" class="{small ? 'text-[10px]' : ''} {className}">
	{#snippet children()}
		<span
			class="inline-block w-2 h-2 rounded-full mr-1 shrink-0"
			style="background-color: {getSectionColor(section)}"
		></span>
		{section}
	{/snippet}
</Badge>
