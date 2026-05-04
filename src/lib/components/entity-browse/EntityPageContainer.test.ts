import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import EntityPageContainerHarness from './EntityPageContainer.test.harness.svelte';

afterEach(() => cleanup());

describe('EntityPageContainer', () => {
	it('renders the title in an <h1>', () => {
		render(EntityPageContainerHarness, { props: { title: 'Genres' } });
		const h1 = screen.getByRole('heading', { level: 1 });
		expect(h1).toHaveTextContent('Genres');
		expect(h1).toHaveClass('page-title');
	});

	it('renders the subtitle when provided', () => {
		render(EntityPageContainerHarness, {
			props: { title: 'Genres', subtitle: 'Browse genres' }
		});
		const subtitle = screen.getByText('Browse genres');
		expect(subtitle).toBeInTheDocument();
		expect(subtitle).toHaveClass('page-subtitle');
	});

	it('omits the subtitle paragraph when not provided', () => {
		const { container } = render(EntityPageContainerHarness, { props: { title: 'X' } });
		expect(container.querySelector('.page-subtitle')).toBeNull();
	});

	it('renders the list snippet when nothing is selected', () => {
		render(EntityPageContainerHarness, { props: { title: 'X', isSelected: false } });
		expect(screen.getByTestId('list-view')).toBeInTheDocument();
		expect(screen.queryByTestId('detail-view')).toBeNull();
	});

	it('renders the detail snippet when a selection exists', () => {
		render(EntityPageContainerHarness, { props: { title: 'X', isSelected: true } });
		expect(screen.getByTestId('detail-view')).toBeInTheDocument();
		expect(screen.queryByTestId('list-view')).toBeNull();
	});

	it('wraps the page in `space-y-8` + `animate-slide-in-up`', () => {
		const { container } = render(EntityPageContainerHarness, { props: { title: 'X' } });
		const wrapper = container.querySelector('.space-y-8.animate-slide-in-up');
		expect(wrapper).not.toBeNull();
	});

	it('runs `onMountExtra` on mount', () => {
		// The container threads `onMountExtra` through `useEntityCollectionLoader`'s
		// own `onMount` so pages that need extra mount-time work
		// (people → loadWisskiUrls; locations → ensureEnrichedLocations) don't
		// have to reach into the loader internals.
		const onMountExtra = vi.fn();
		render(EntityPageContainerHarness, { props: { title: 'X', onMountExtra } });
		expect(onMountExtra).toHaveBeenCalledTimes(1);
	});
});
