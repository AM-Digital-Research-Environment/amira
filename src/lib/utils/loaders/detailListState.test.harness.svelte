<script lang="ts">
	import { createDetailListState, type DetailListState } from './detailListState.svelte';

	interface Props {
		paramName: string;
		scroll?: boolean;
		exposed: { state: DetailListState | null };
	}

	const props: Props = $props();

	function init(p: Props) {
		const state = createDetailListState({
			paramName: p.paramName,
			...(p.scroll === undefined ? {} : { scroll: p.scroll })
		});
		p.exposed.state = state;
		return state;
	}

	// svelte-ignore state_referenced_locally
	const state = init(props);
</script>

<div data-testid="key">{state.key}</div>
