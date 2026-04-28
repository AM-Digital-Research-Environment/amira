<script lang="ts">
	/**
	 * Time-aware chord — co-occurrence chord diagram with a year slider so
	 * users can scrub through how a network of (e.g.) subjects evolves over
	 * time. Each year's payload is a fully-formed `ChordData`; the slider
	 * just picks which one to render.
	 *
	 * Data shape:
	 *   {
	 *     buckets: [{ year: 2010, names: ['A', 'B', ...], matrix: [[0, 3, ...], ...] }, ...]
	 *   }
	 *
	 * Buckets can be sparse — only years with data appear on the slider.
	 * Cumulative-window mode is left to the caller (just precompute the
	 * cumulative chord per year).
	 */
	import ChordDiagram from './ChordDiagram.svelte';
	import { Play, Pause, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import { onDestroy } from 'svelte';
	import type { ChordData } from '$lib/types';

	export interface TimeAwareChordBucket {
		year: number;
		names: string[];
		matrix: number[][];
	}

	export interface TimeAwareChordData {
		buckets: TimeAwareChordBucket[];
	}

	interface Props {
		data: TimeAwareChordData;
		class?: string;
		/** Step in milliseconds when auto-playing through years. */
		autoPlayInterval?: number;
	}

	let { data, class: className = '', autoPlayInterval = 1200 }: Props = $props();

	const uid = $props.id();

	// Sort buckets by year so slider scrubbing is monotonic.
	let sorted = $derived(data?.buckets ? [...data.buckets].sort((a, b) => a.year - b.year) : []);
	let years = $derived(sorted.map((b) => b.year));
	let minYear = $derived(years.length ? years[0] : 0);
	let maxYear = $derived(years.length ? years[years.length - 1] : 0);

	// Selected year index — defaults to the latest bucket so the user lands
	// on the most recent state, not a sparse early year.
	let yearIndex = $state(0);

	$effect(() => {
		// Clamp index when buckets change (e.g. data reloads).
		if (sorted.length === 0) {
			yearIndex = 0;
		} else if (yearIndex >= sorted.length) {
			yearIndex = sorted.length - 1;
		} else if (yearIndex < 0) {
			yearIndex = 0;
		}
	});

	// On first paint, jump to the latest year. We use a sentinel so a user
	// scrubbing the slider then watching the data update doesn't get
	// snapped back to the end on every re-render.
	let initialised = false;
	$effect(() => {
		if (!initialised && sorted.length > 0) {
			yearIndex = sorted.length - 1;
			initialised = true;
		}
	});

	let selectedBucket = $derived(sorted[yearIndex]);
	let selectedChord: ChordData = $derived(
		selectedBucket
			? { names: selectedBucket.names, matrix: selectedBucket.matrix }
			: { names: [], matrix: [] }
	);
	let selectedYear = $derived(selectedBucket?.year ?? minYear);

	// Auto-play through years. Pauses when the slider reaches the last year.
	let playing = $state(false);
	let timer: ReturnType<typeof setInterval> | null = null;

	function tick() {
		if (yearIndex >= sorted.length - 1) {
			stop();
			return;
		}
		yearIndex = yearIndex + 1;
	}

	function start() {
		if (sorted.length <= 1) return;
		if (yearIndex >= sorted.length - 1) yearIndex = 0;
		playing = true;
		timer = setInterval(tick, autoPlayInterval);
	}

	function stop() {
		playing = false;
		if (timer != null) {
			clearInterval(timer);
			timer = null;
		}
	}

	function togglePlay() {
		if (playing) stop();
		else start();
	}

	function step(delta: number) {
		stop();
		const next = yearIndex + delta;
		if (next < 0 || next >= sorted.length) return;
		yearIndex = next;
	}

	function handleSlider(e: Event) {
		const t = e.target as HTMLInputElement;
		stop();
		yearIndex = Number(t.value);
	}

	onDestroy(() => stop());

	let totalConnections = $derived.by(() => {
		if (!selectedBucket) return 0;
		// Matrix is symmetric; sum upper triangle.
		const m = selectedBucket.matrix;
		let total = 0;
		for (let i = 0; i < m.length; i++) {
			for (let j = i + 1; j < m[i].length; j++) {
				total += m[i][j];
			}
		}
		return total;
	});
</script>

<div class={cn('flex flex-col w-full h-full', className)}>
	{#if sorted.length === 0}
		<div class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
			No co-occurrence data available.
		</div>
	{:else}
		<div class="flex-1 min-h-0">
			<ChordDiagram data={selectedChord} class="h-full w-full" />
		</div>

		<!-- Slider row. shrink-0 keeps it visible regardless of flex pressure
			 from the chord canvas above. -->
		<div class="shrink-0 mt-3 flex items-center gap-3 text-xs">
			<button
				type="button"
				class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
				onclick={() => step(-1)}
				disabled={yearIndex <= 0}
				aria-label="Previous year"
				title="Previous year"
			>
				<ChevronLeft class="h-3.5 w-3.5" />
			</button>

			<button
				type="button"
				class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
				onclick={togglePlay}
				disabled={sorted.length <= 1}
				aria-label={playing ? 'Pause' : 'Play'}
				title={playing ? 'Pause' : 'Play through years'}
			>
				{#if playing}
					<Pause class="h-3.5 w-3.5" />
				{:else}
					<Play class="h-3.5 w-3.5" />
				{/if}
			</button>

			<button
				type="button"
				class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
				onclick={() => step(1)}
				disabled={yearIndex >= sorted.length - 1}
				aria-label="Next year"
				title="Next year"
			>
				<ChevronRight class="h-3.5 w-3.5" />
			</button>

			<input
				id="{uid}-year"
				name="year"
				type="range"
				min="0"
				max={sorted.length - 1}
				step="1"
				value={yearIndex}
				oninput={handleSlider}
				class="flex-1 h-1.5 appearance-none rounded-full bg-muted accent-primary cursor-pointer"
				aria-label="Year"
			/>

			<div class="shrink-0 flex items-baseline gap-2 tabular-nums">
				<span class="text-muted-foreground">{minYear}</span>
				<span class="font-semibold text-base">{selectedYear}</span>
				<span class="text-muted-foreground">{maxYear}</span>
			</div>

			<div class="hidden md:block text-muted-foreground tabular-nums">
				{selectedBucket?.names.length ?? 0} nodes ·
				{totalConnections.toLocaleString()} co-occurrences
			</div>
		</div>
	{/if}
</div>
