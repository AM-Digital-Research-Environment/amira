<script lang="ts">
	import EntityPageContainer from './EntityPageContainer.svelte';

	interface Props {
		title: string;
		subtitle?: string;
		isSelected?: boolean;
		onMountExtra?: () => void;
	}

	let { title, subtitle, isSelected = false, onMountExtra }: Props = $props();
</script>

<EntityPageContainer {title} {subtitle} selected={() => isSelected} {onMountExtra}>
	{#snippet detailView()}
		<div data-testid="detail-view">Detail content</div>
	{/snippet}
	{#snippet listView()}
		<div data-testid="list-view">List content</div>
	{/snippet}
</EntityPageContainer>
