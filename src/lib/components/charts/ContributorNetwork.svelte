<script lang="ts">
	/**
	 * Bipartite contributor network — persons on one side, target entities
	 * (projects / institutions / sections) on the other, edges weighted by
	 * how many items the contributor authored within that target.
	 *
	 * Thin wrapper around `NetworkGraph` with sensible defaults for the
	 * bipartite case (two categories, attractive layout, IDF-ish edge
	 * weighting handled upstream).
	 *
	 * Data shape:
	 *   {
	 *     persons:     [{ id, name, itemCount }],
	 *     targets:     [{ id, name, itemCount }],
	 *     edges:       [{ personId, targetId, count }],
	 *     targetLabel: "Projects" | "Institutions" | …
	 *   }
	 */
	import NetworkGraph from './NetworkGraph.svelte';
	import { cn } from '$lib/utils/cn';
	import type { NetworkData, NetworkNode, NetworkLink } from '$lib/types';

	export interface ContributorNetworkPerson {
		id: string;
		name: string;
		itemCount: number;
	}

	export interface ContributorNetworkTarget {
		id: string;
		name: string;
		itemCount: number;
	}

	export interface ContributorNetworkEdge {
		personId: string;
		targetId: string;
		count: number;
	}

	export interface ContributorNetworkData {
		persons: ContributorNetworkPerson[];
		targets: ContributorNetworkTarget[];
		edges: ContributorNetworkEdge[];
		/** Label for the non-person category. Defaults to "Projects". */
		targetLabel?: string;
	}

	interface Props {
		data: ContributorNetworkData;
		class?: string;
		title?: string;
		onclick?: (id: string, category: number) => void;
	}

	let { data, class: className = '', title = '', onclick }: Props = $props();

	// Square-root scaling so a contributor with 100 items doesn't end up
	// 10× the symbolSize of one with 10 — the area should grow linearly,
	// not the radius.
	function sizeFor(count: number, max: number): number {
		const minR = 12;
		const maxR = 38;
		if (max <= 0) return minR;
		return minR + Math.sqrt(count / max) * (maxR - minR);
	}

	let networkData = $derived.by<NetworkData>(() => {
		const persons = data?.persons ?? [];
		const targets = data?.targets ?? [];
		const edges = data?.edges ?? [];

		const maxPerson = Math.max(1, ...persons.map((p) => p.itemCount));
		const maxTarget = Math.max(1, ...targets.map((t) => t.itemCount));

		// Disambiguate ids across the two categories so a person and a
		// project can never share an id by coincidence.
		const personId = (id: string) => `p:${id}`;
		const targetId = (id: string) => `t:${id}`;

		const nodes: NetworkNode[] = [
			...persons.map(
				(p): NetworkNode => ({
					id: personId(p.id),
					name: p.name,
					category: 0,
					symbolSize: sizeFor(p.itemCount, maxPerson)
				})
			),
			...targets.map(
				(t): NetworkNode => ({
					id: targetId(t.id),
					name: t.name,
					category: 1,
					symbolSize: sizeFor(t.itemCount, maxTarget)
				})
			)
		];

		const links: NetworkLink[] = edges.map(
			(e): NetworkLink => ({
				source: personId(e.personId),
				target: targetId(e.targetId),
				value: e.count,
				label: `${e.count} item${e.count === 1 ? '' : 's'}`,
				relation: 'direct'
			})
		);

		return {
			nodes,
			links,
			categories: [{ name: 'Contributors' }, { name: data?.targetLabel ?? 'Projects' }]
		};
	});

	// Looser repulsion so the bipartite halves visually separate; longer
	// edges so labels don't crash into each other.
	const FORCE = {
		repulsion: 200,
		gravity: 0.05,
		edgeLength: [60, 140] as [number, number],
		friction: 0.18,
		layoutAnimation: true
	};
</script>

<div class={cn('w-full h-full', className)}>
	{#if (data?.persons?.length ?? 0) === 0 || (data?.targets?.length ?? 0) === 0}
		<div class="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
			No contributor relationships available.
		</div>
	{:else}
		<NetworkGraph data={networkData} {title} forceConfig={FORCE} class="h-full w-full" {onclick} />
	{/if}
</div>
