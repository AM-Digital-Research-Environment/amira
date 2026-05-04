import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import EntityDetailViewShellHarness from './EntityDetailViewShell.test.harness.svelte';

afterEach(() => cleanup());

describe('EntityDetailViewShell', () => {
	it('renders the BackToList button with the provided label', () => {
		render(EntityDetailViewShellHarness, {
			props: { backLabel: 'Back to genres' }
		});
		expect(screen.getByRole('button', { name: /back to genres/i })).toBeInTheDocument();
	});

	it('fires onBack when the BackToList button is clicked', async () => {
		const onBack = vi.fn();
		render(EntityDetailViewShellHarness, { props: { onBack, backLabel: 'Back' } });
		await fireEvent.click(screen.getByRole('button', { name: /back/i }));
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('renders the body when `resolved` is truthy', () => {
		render(EntityDetailViewShellHarness, { props: { resolved: { name: 'X' } } });
		expect(screen.getByTestId('body')).toBeInTheDocument();
		expect(screen.queryByText('Loading dashboard…')).toBeNull();
	});

	it('renders the loading state when `resolved` is falsy and `loading` is true', () => {
		render(EntityDetailViewShellHarness, {
			props: { resolved: null, loading: true }
		});
		expect(screen.getByText('Loading dashboard…')).toBeInTheDocument();
		expect(screen.queryByTestId('body')).toBeNull();
	});

	it('renders the default empty state when `resolved` is falsy and `loading` is false', () => {
		render(EntityDetailViewShellHarness, {
			props: { resolved: null, loading: false }
		});
		expect(screen.getByText('No data available.')).toBeInTheDocument();
		expect(screen.queryByTestId('body')).toBeNull();
	});

	it('renders a custom empty message via `emptyMessage`', () => {
		render(EntityDetailViewShellHarness, {
			props: {
				resolved: null,
				loading: false,
				emptyMessage: 'No data available for this genre.'
			}
		});
		expect(screen.getByText('No data available for this genre.')).toBeInTheDocument();
	});

	it('wraps content in `space-y-6`', () => {
		const { container } = render(EntityDetailViewShellHarness, {
			props: { resolved: { name: 'X' } }
		});
		expect(container.querySelector('.space-y-6')).not.toBeNull();
	});

	it('treats falsy values (0, "", null, undefined, false) as not-resolved', () => {
		const cases: unknown[] = [0, '', null, undefined, false];
		for (const value of cases) {
			cleanup();
			render(EntityDetailViewShellHarness, { props: { resolved: value, loading: false } });
			expect(screen.queryByTestId('body')).toBeNull();
			expect(screen.getByText('No data available.')).toBeInTheDocument();
		}
	});
});
