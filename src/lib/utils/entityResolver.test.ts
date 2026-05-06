import { describe, it, expect } from 'vitest';
import {
	getUniversityById,
	getUniversityName,
	resolveCollectionUniversity,
	getProjectById
} from './entityResolver';
import type { Project } from '$lib/types';

describe('getUniversityById', () => {
	it('returns the matching university record by id', () => {
		const ubt = getUniversityById('ubt');
		expect(ubt?.id).toBe('ubt');
		expect(ubt?.name).toBe('University of Bayreuth');
	});

	it('returns undefined for an unknown id', () => {
		expect(getUniversityById('unknown')).toBeUndefined();
	});

	it('returns undefined for the External pseudo-source', () => {
		// External isn't a real university record — getUniversityName is
		// the right entry point if you need a label for it.
		expect(getUniversityById('external')).toBeUndefined();
	});

	it('returns undefined for null or undefined input', () => {
		expect(getUniversityById(null)).toBeUndefined();
		expect(getUniversityById(undefined)).toBeUndefined();
	});

	it('returns undefined for empty string', () => {
		expect(getUniversityById('')).toBeUndefined();
	});
});

describe('getUniversityName', () => {
	it('returns the name for a real university id', () => {
		expect(getUniversityName('ubt')).toBe('University of Bayreuth');
	});

	it("returns 'External' for the EXTERNAL_SOURCE_ID", () => {
		expect(getUniversityName('external')).toBe('External');
	});

	it('returns null for unknown ids', () => {
		expect(getUniversityName('unknown')).toBeNull();
	});

	it('returns null for null / undefined / empty input', () => {
		expect(getUniversityName(null)).toBeNull();
		expect(getUniversityName(undefined)).toBeNull();
		expect(getUniversityName('')).toBeNull();
	});
});

describe('resolveCollectionUniversity', () => {
	it('matches a single institution name to its university id', () => {
		expect(resolveCollectionUniversity(['Rhodes University'])).toBe('rhodes');
		expect(resolveCollectionUniversity(['University of Bayreuth'])).toBe('ubt');
		expect(resolveCollectionUniversity(['University of Lagos'])).toBe('unilag');
	});

	it('matches when the institution name appears alongside other names', () => {
		expect(resolveCollectionUniversity(['BIGSAS', 'University of Bayreuth'])).toBe('ubt');
	});

	it('returns the first match when multiple universities are listed', () => {
		// `find` short-circuits on the first match; the order of `universities`
		// (UNILAG, UJKZ, UBT, UFBA, MOI, Rhodes) drives the precedence.
		expect(resolveCollectionUniversity(['University of Bayreuth', 'Rhodes University'])).toBe(
			'ubt'
		);
	});

	it('falls back to EXTERNAL_SOURCE_ID when no name matches', () => {
		expect(resolveCollectionUniversity(['Some Unknown Institution'])).toBe('external');
	});

	it('returns EXTERNAL_SOURCE_ID for an empty institutions list', () => {
		expect(resolveCollectionUniversity([])).toBe('external');
	});
});

describe('getProjectById', () => {
	const projects = [
		{ id: 'proj-1', _id: 'mongo-1', idShort: 'P1', name: 'One' } as Project,
		{ id: 'proj-2', _id: 'mongo-2', idShort: 'P2', name: 'Two' } as Project,
		{ id: 'proj-3', _id: 'mongo-3', idShort: 'P3', name: 'Three' } as Project
	];

	it('matches by `id`', () => {
		expect(getProjectById(projects, 'proj-2')?.name).toBe('Two');
	});

	it('matches by `_id`', () => {
		expect(getProjectById(projects, 'mongo-3')?.name).toBe('Three');
	});

	it('matches by `idShort`', () => {
		expect(getProjectById(projects, 'P1')?.name).toBe('One');
	});

	it('returns undefined when nothing matches', () => {
		expect(getProjectById(projects, 'nope')).toBeUndefined();
	});

	it('returns undefined for null / undefined / empty input', () => {
		expect(getProjectById(projects, null)).toBeUndefined();
		expect(getProjectById(projects, undefined)).toBeUndefined();
		expect(getProjectById(projects, '')).toBeUndefined();
	});

	it('returns undefined when the projects list is empty', () => {
		expect(getProjectById([], 'proj-1')).toBeUndefined();
	});

	it('prefers an `id` match over a `_id` match when both could apply', () => {
		// A pathological case: project A has id 'X', project B has _id 'X'.
		// `find` returns the first item that matches either — that's A.
		const a = { id: 'X', _id: 'a-mongo', idShort: 'A', name: 'A' } as Project;
		const b = { id: 'b-id', _id: 'X', idShort: 'B', name: 'B' } as Project;
		expect(getProjectById([a, b], 'X')?.name).toBe('A');
	});
});
