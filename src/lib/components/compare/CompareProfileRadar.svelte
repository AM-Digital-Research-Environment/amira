<script lang="ts">
	/** 6-axis profile radar shared by every compare type. Wraps `RadarChart`
	 * inside a `ChartCard` so callers don't repeat the same boilerplate. */
	import { ChartCard } from '$lib/components/ui';
	import { RadarChart } from '$lib/components/charts';
	import { buildRadarIndicator, buildRadarSeries, type Profile } from './compareProfile';

	interface Props {
		title: string;
		leftName: string;
		leftProfile: Profile;
		rightName: string;
		rightProfile: Profile;
	}

	let { title, leftName, leftProfile, rightName, rightProfile }: Props = $props();

	const indicator = $derived(buildRadarIndicator(leftProfile, rightProfile));
	const series = $derived(buildRadarSeries(leftName, leftProfile, rightName, rightProfile));
</script>

<ChartCard
	{title}
	subtitle="Six-axis comparison: items, subjects, languages, types, year span, contributors"
	contentHeight="h-chart-xl"
>
	<RadarChart {indicator} {series} class="h-full w-full" />
</ChartCard>
