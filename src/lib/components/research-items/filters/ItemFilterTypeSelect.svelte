<script lang="ts">
	interface Props {
		resourceTypes: string[];
		selectedType: string;
		onChange: (value: string) => void;
	}

	let { resourceTypes, selectedType, onChange }: Props = $props();
</script>

<select
	id="research-items-type-filter"
	name="type-filter"
	value={selectedType}
	onchange={(e) => onChange(e.currentTarget.value)}
	aria-label="Filter by resource type"
	class="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
>
	{#each resourceTypes as type (type)}
		<option value={type}>{type === 'all' ? 'All types' : type}</option>
	{/each}
</select>
