import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import FilterToggleBar from './FilterToggleBar.svelte';

afterEach(() => cleanup());

const optionsBasic = [
	{ value: 'all', label: 'All' },
	{ value: 'with', label: 'With' },
	{ value: 'without', label: 'Without' }
];

const optionsWithCounts = [
	{ value: 'all', label: 'All', count: 12 },
	{ value: 'partner', label: 'Partners', count: 4 },
	{ value: 'contributor', label: 'Contributors', count: 8 }
];

describe('FilterToggleBar', () => {
	it('renders all options as buttons', () => {
		render(FilterToggleBar, {
			props: { options: optionsBasic, value: 'all', onChange: () => {} }
		});
		for (const opt of optionsBasic) {
			expect(screen.getByRole('button', { name: opt.label })).toBeInTheDocument();
		}
	});

	it('marks the active option with aria-pressed=true', () => {
		render(FilterToggleBar, {
			props: { options: optionsBasic, value: 'with', onChange: () => {} }
		});
		expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
		expect(screen.getByRole('button', { name: 'With' })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByRole('button', { name: 'Without' })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});

	it('calls onChange with the clicked value', async () => {
		const onChange = vi.fn();
		render(FilterToggleBar, {
			props: { options: optionsBasic, value: 'all', onChange }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Without' }));
		expect(onChange).toHaveBeenCalledExactlyOnceWith('without');
	});

	it('renders counts on md size', () => {
		render(FilterToggleBar, {
			props: { options: optionsWithCounts, value: 'all', size: 'md', onChange: () => {} }
		});
		expect(screen.getByRole('button', { name: /All\s*\(12\)/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Partners\s*\(4\)/ })).toBeInTheDocument();
	});

	it('hides counts on sm size', () => {
		render(FilterToggleBar, {
			props: { options: optionsWithCounts, value: 'all', size: 'sm', onChange: () => {} }
		});
		// Just the label, no parens.
		const allBtn = screen.getByRole('button', { name: 'All' });
		expect(allBtn).toBeInTheDocument();
		expect(allBtn.textContent?.trim()).toBe('All');
	});

	it('applies sm classes when size="sm"', () => {
		render(FilterToggleBar, {
			props: { options: optionsBasic, value: 'all', size: 'sm', onChange: () => {} }
		});
		const group = screen.getByRole('group');
		expect(group.className).toMatch(/text-xs/);
	});

	it('applies md classes by default', () => {
		render(FilterToggleBar, {
			props: { options: optionsBasic, value: 'all', onChange: () => {} }
		});
		const group = screen.getByRole('group');
		expect(group.className).toMatch(/text-sm/);
		expect(group.className).toMatch(/font-medium/);
	});

	it('adds w-fit when fullWidth is false (default)', () => {
		render(FilterToggleBar, {
			props: { options: optionsBasic, value: 'all', onChange: () => {} }
		});
		expect(screen.getByRole('group').className).toMatch(/w-fit/);
	});

	it('omits w-fit and adds flex-1 to buttons when fullWidth=true', () => {
		render(FilterToggleBar, {
			props: { options: optionsBasic, value: 'all', fullWidth: true, onChange: () => {} }
		});
		const group = screen.getByRole('group');
		expect(group.className).not.toMatch(/w-fit/);
		for (const opt of optionsBasic) {
			expect(screen.getByRole('button', { name: opt.label }).className).toMatch(/flex-1/);
		}
	});

	it('passes aria-labelledby through and drops aria-label when both supplied', () => {
		render(FilterToggleBar, {
			props: {
				options: optionsBasic,
				value: 'all',
				onChange: () => {},
				'aria-labelledby': 'my-label',
				'aria-label': 'fallback'
			}
		});
		const group = screen.getByRole('group');
		expect(group).toHaveAttribute('aria-labelledby', 'my-label');
		expect(group).not.toHaveAttribute('aria-label');
	});

	it('falls back to aria-label when no labelledby is provided', () => {
		render(FilterToggleBar, {
			props: {
				options: optionsBasic,
				value: 'all',
				onChange: () => {},
				'aria-label': 'View mode'
			}
		});
		expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'View mode');
	});

	it('capitalizes labels when capitalize=true', () => {
		render(FilterToggleBar, {
			props: {
				options: [
					{ value: 'a', label: 'countries' },
					{ value: 'b', label: 'cities' }
				],
				value: 'a',
				capitalize: true,
				onChange: () => {}
			}
		});
		for (const btn of screen.getAllByRole('button')) {
			expect(btn.className).toMatch(/capitalize/);
		}
	});
});
