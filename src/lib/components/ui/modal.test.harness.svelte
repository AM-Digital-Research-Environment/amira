<script lang="ts">
	import Modal from './modal.svelte';

	interface Props {
		open: boolean;
		onClose?: () => void;
		ariaLabel?: string;
		ariaLabelledBy?: string;
		align?: 'center' | 'start';
		showClose?: boolean;
	}

	let {
		open,
		onClose = () => {},
		ariaLabel = 'Test dialog',
		ariaLabelledBy,
		align = 'center',
		showClose = true
	}: Props = $props();
</script>

<Modal {open} {onClose} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} {align} {showClose}>
	<div data-testid="inner" class="frame">
		<h2 id="lbl">Inner heading</h2>
		<button type="button">Inner button</button>
	</div>
</Modal>
