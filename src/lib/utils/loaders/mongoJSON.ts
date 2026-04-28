import type { MongoOid, MongoDate, MongoNaN } from '$lib/types';
import { fetchJSON } from './fetchHelpers';

/**
 * Check if a value is a MongoDB NaN representation
 */
function isMongoNaN(value: unknown): value is MongoNaN {
	return (
		typeof value === 'object' &&
		value !== null &&
		'$numberDouble' in value &&
		(value as MongoNaN).$numberDouble === 'NaN'
	);
}

/**
 * Check if a value is a MongoDB ObjectId
 */
function isMongoOid(value: unknown): value is MongoOid {
	return typeof value === 'object' && value !== null && '$oid' in value;
}

/**
 * Check if a value is a MongoDB Date
 */
function isMongoDate(value: unknown): value is MongoDate {
	return typeof value === 'object' && value !== null && '$date' in value;
}

/**
 * Recursively transform MongoDB extended JSON to native JS types
 */
export function transformMongoJSON<T>(data: unknown): T {
	if (data === null || data === undefined) {
		return null as T;
	}

	if (isMongoNaN(data)) {
		return null as T;
	}

	if (isMongoOid(data)) {
		return data.$oid as T;
	}

	if (isMongoDate(data)) {
		return new Date(data.$date) as T;
	}

	if (Array.isArray(data)) {
		return data.map((item) => transformMongoJSON(item)) as T;
	}

	if (typeof data === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(data)) {
			result[key] = transformMongoJSON(value);
		}
		return result as T;
	}

	return data as T;
}

/**
 * Load and parse a JSON file from the static data directory.
 * Throws on missing or unparseable files — use for required data.
 */
export async function loadJSON<T>(path: string): Promise<T> {
	const response = await fetch(path);
	if (!response.ok) {
		throw new Error(`Failed to load ${path}: ${response.statusText}`);
	}
	const rawData = await response.json();
	return transformMongoJSON<T>(rawData);
}

/**
 * Try to load a JSON array, return [] when missing or unparseable.
 * Use for optional dump files (e.g. dev.collections.json may not exist
 * outside development).
 */
export async function tryLoadJSON<T>(path: string): Promise<T[]> {
	const result = await fetchJSON<T[]>(path, {
		transform: (raw) => transformMongoJSON<T[]>(raw),
		warnLevel: 'always'
	});
	return result ?? [];
}
