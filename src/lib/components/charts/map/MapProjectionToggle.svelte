<script lang="ts">
	import type maplibregl from 'maplibre-gl';
	import { Globe, Map as MapIcon } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		/** Live MapLibre map instance. Pass `null` while the map is
		 *  initialising — the button is inert until a map is provided. */
		map: maplibregl.Map | null;
		/** Extra classes for positioning. Defaults to top-left with spacing
		 *  that sits just inside the map frame. */
		class?: string;
	}

	let { map, class: className = 'absolute top-2 left-2 z-10' }: Props = $props();

	let isGlobe = $state(false);

	function toggle() {
		if (!map) return;
		isGlobe = !isGlobe;
		map.setProjection({ type: isGlobe ? 'globe' : 'mercator' });
	}
</script>

<button
	type="button"
	onclick={toggle}
	disabled={!map}
	class={cn(
		'inline-flex items-center gap-1.5 bg-background/90 hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed border rounded-md px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors',
		className
	)}
	title={isGlobe ? 'Switch to flat (Mercator) view' : 'Switch to globe view'}
>
	{#if isGlobe}
		<MapIcon class="h-3.5 w-3.5" />
		Flat
	{:else}
		<Globe class="h-3.5 w-3.5" />
		Globe
	{/if}
</button>
