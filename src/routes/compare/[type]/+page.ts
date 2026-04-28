import { error } from '@sveltejs/kit';
import { COMPARE_TYPES, type CompareType } from '$lib/components/compare/compareTypes';

export const prerender = true;

export function entries() {
	return COMPARE_TYPES.map((type) => ({ type }));
}

export function load({ params }: { params: { type: string } }) {
	const type = params.type as CompareType;
	if (!(COMPARE_TYPES as readonly string[]).includes(type)) {
		throw error(404, `Unknown comparison type: ${params.type}`);
	}
	return { type };
}
