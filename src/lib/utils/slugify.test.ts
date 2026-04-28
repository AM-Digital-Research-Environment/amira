import { describe, it, expect } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
	it('lowercases the input', () => {
		expect(slugify('Hello')).toBe('hello');
	});

	it('replaces forward and back slashes with a hyphen', () => {
		expect(slugify('HIV/AIDS')).toBe('hiv-aids');
		expect(slugify('foo\\bar')).toBe('foo-bar');
	});

	it('collapses runs of non-alphanumerics into a single hyphen', () => {
		expect(slugify('foo   bar!!!baz')).toBe('foo-bar-baz');
	});

	it('strips leading and trailing hyphens', () => {
		expect(slugify('  -hello-  ')).toBe('hello');
	});

	it('truncates to 120 characters', () => {
		const long = 'a'.repeat(200);
		expect(slugify(long)).toHaveLength(120);
	});

	it('handles diacritics by collapsing them', () => {
		// Non-ASCII characters fall into the non-alphanumeric class and collapse.
		expect(slugify('Côte d’Ivoire')).toBe('c-te-d-ivoire');
	});

	it('returns an empty string for input that is all separators', () => {
		expect(slugify('---///   ')).toBe('');
	});
});
