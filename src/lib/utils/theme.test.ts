import { describe, it, expect } from 'vitest';
import { getSectionColor, getSectionColorHsl } from './theme';

describe('getSectionColor', () => {
	it('wraps a known section in hsl()', () => {
		expect(getSectionColor('Mobilities')).toBe('hsl(var(--rs-mobilities))');
	});

	it('falls back to muted-foreground for unknown sections', () => {
		expect(getSectionColor('Nonexistent')).toBe('hsl(var(--muted-foreground))');
	});
});

describe('getSectionColorHsl', () => {
	it('returns the unwrapped CSS variable for a known section', () => {
		expect(getSectionColorHsl('Knowledges')).toBe('var(--rs-knowledges)');
	});

	it('falls back to muted-foreground for unknown sections', () => {
		expect(getSectionColorHsl('Nonexistent')).toBe('var(--muted-foreground)');
	});
});
