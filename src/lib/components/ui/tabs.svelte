<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';

	interface Tab {
		id: string;
		label: string;
	}

	interface Props {
		tabs: Tab[];
		activeTab?: string;
		class?: string;
		onTabChange?: (tabId: string) => void;
		children: Snippet<[string]>;
	}

	let {
		tabs,
		activeTab = $bindable(tabs[0]?.id || ''),
		class: className = '',
		onTabChange,
		children
	}: Props = $props();

	function selectTab(tabId: string) {
		activeTab = tabId;
		onTabChange?.(tabId);
	}
</script>

<div class={cn('w-full', className)}>
	<div
		class="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground"
	>
		{#each tabs as tab}
			<button
				type="button"
				onclick={() => selectTab(tab.id)}
				class={cn(
					'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
					activeTab === tab.id
						? 'bg-background text-foreground shadow-sm'
						: 'hover:bg-background/50'
				)}
			>
				{tab.label}
			</button>
		{/each}
	</div>
	<div class="mt-4">
		{@render children(activeTab)}
	</div>
</div>
