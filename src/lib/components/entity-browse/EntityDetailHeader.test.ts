import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import EntityDetailHeader from './EntityDetailHeader.svelte';
import EntityDetailHeaderHarness from './EntityDetailHeader.test.harness.svelte';

afterEach(() => cleanup());

describe('EntityDetailHeader', () => {
	it('renders the title', () => {
		render(EntityDetailHeader, { props: { title: 'My entity' } });
		expect(screen.getByText('My entity')).toBeInTheDocument();
	});

	it('renders the subtitle when provided', () => {
		render(EntityDetailHeader, { props: { title: 'X', subtitle: 'sub line' } });
		expect(screen.getByText('sub line')).toBeInTheDocument();
	});

	it('renders the count badge with proper pluralization', () => {
		render(EntityDetailHeader, { props: { title: 'X', count: 5, countLabel: 'item' } });
		expect(screen.getByText('5 items')).toBeInTheDocument();
	});

	it('renders the count badge without an `s` for count=1', () => {
		render(EntityDetailHeader, { props: { title: 'X', count: 1, countLabel: 'item' } });
		expect(screen.getByText('1 item')).toBeInTheDocument();
	});

	it('renders the percentOfTotal badge with one decimal', () => {
		render(EntityDetailHeader, { props: { title: 'X', percentOfTotal: 12.345 } });
		expect(screen.getByText('12.3% of total')).toBeInTheDocument();
	});

	it('renders nothing in the badge row when no badges/count/percent/wisski are set', () => {
		const { container } = render(EntityDetailHeader, { props: { title: 'X' } });
		// No badge row should be rendered.
		expect(container.querySelectorAll('[data-slot="badge"]').length).toBe(0);
	});

	it('renders a content snippet inside a CardContent block', () => {
		render(EntityDetailHeaderHarness, { props: { title: 'X', useContent: true } });
		expect(screen.getByTestId('extra-content')).toBeInTheDocument();
	});

	it('skips the content block when no content snippet is supplied', () => {
		render(EntityDetailHeaderHarness, { props: { title: 'X', useContent: false } });
		expect(screen.queryByTestId('extra-content')).toBeNull();
	});

	it('renders a badges snippet between count and WissKI', () => {
		render(EntityDetailHeaderHarness, { props: { title: 'X', count: 3, useBadges: true } });
		expect(screen.getByTestId('extra-badge')).toBeInTheDocument();
	});

	it('hides the auto WissKILink when hideWisskiLink is set', () => {
		const { container } = render(EntityDetailHeader, {
			props: {
				title: 'X',
				wisskiCategory: 'projects',
				wisskiKey: 'p1',
				hideWisskiLink: true
			}
		});
		// WissKILink renders as an <a> with the wisski host. Since the WissKI URL
		// may resolve to null in unit tests, instead check that the only anchor
		// (if any) is not the WissKILink — easiest: assert no <a> with the
		// "Open in WissKI"-style accessible name.
		expect(container.querySelector('a[aria-label*="WissKI" i], a[title*="WissKI" i]')).toBeNull();
	});
});
