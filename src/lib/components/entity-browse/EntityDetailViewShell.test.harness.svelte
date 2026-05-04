<script lang="ts">
	import EntityDetailViewShell from './EntityDetailViewShell.svelte';

	interface Props {
		backLabel?: string;
		onBack?: () => void;
		resolved?: unknown;
		loading?: boolean;
		emptyMessage?: string;
	}

	let {
		backLabel = 'Back to list',
		onBack = () => {},
		resolved = false,
		loading = false,
		emptyMessage
	}: Props = $props();
</script>

<EntityDetailViewShell {backLabel} {onBack} {resolved} {loading} {emptyMessage}>
	{#snippet body(data)}
		<div data-testid="body">Body content; resolved type: {typeof data}</div>
	{/snippet}
</EntityDetailViewShell>
