import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/svelte';

// Mock $app/state — `page.url` is a plain mutable URL the tests
// reach into to seed the initial location. We only depend on
// `page.url.searchParams.get(...)`, so a plain URL works.
const mockPage = {
	url: new URL('http://localhost/?')
};

vi.mock('$app/state', () => ({
	get page() {
		return mockPage;
	}
}));

// Mock $app/navigation — `goto` is what `urlSelection.pushToUrl` /
// `removeFromUrl` call. The mock just records the target so we can
// assert what the factory tried to navigate to.
const goto = vi.fn(async (_target: string) => {});

vi.mock('$app/navigation', () => ({
	get goto() {
		return goto;
	}
}));

// scrollToTop reads `window.scrollTo`; jsdom's stub is a no-op, so
// we replace it with a spy to assert the scroll branch.
const scrollSpy = vi.fn();

function seedUrl(href: string) {
	mockPage.url = new URL(href);
	// `urlSelection.{pushToUrl,removeFromUrl}` read from
	// `window.location.href` directly. Keep both in sync.
	window.history.replaceState(null, '', href);
}

beforeEach(() => {
	seedUrl('http://localhost/?');
	goto.mockClear();
	scrollSpy.mockClear();
	Object.defineProperty(window, 'scrollTo', { value: scrollSpy, writable: true });
});

afterEach(() => cleanup());

const { default: Harness } = await import('./detailListState.test.harness.svelte');

interface ExposedState {
	state: {
		readonly key: string;
		select: (k: string) => void;
		clear: () => void;
	};
}

function makeExposed(): ExposedState {
	return { state: null as unknown as ExposedState['state'] };
}

describe('createDetailListState', () => {
	it('starts with an empty key when the URL has no matching param', () => {
		const exposed = makeExposed();
		render(Harness, { props: { paramName: 'id', exposed } });
		expect(screen.getByTestId('key').textContent).toBe('');
	});

	it('reads the initial key from the URL', () => {
		seedUrl('http://localhost/?id=abc-123');
		const exposed = makeExposed();
		render(Harness, { props: { paramName: 'id', exposed } });
		expect(screen.getByTestId('key').textContent).toBe('abc-123');
	});

	it('reads the initial key under a different param name', () => {
		seedUrl('http://localhost/?section=Knowledges');
		const exposed = makeExposed();
		render(Harness, { props: { paramName: 'section', exposed } });
		expect(screen.getByTestId('key').textContent).toBe('Knowledges');
	});

	it('ignores unrelated query params', () => {
		seedUrl('http://localhost/?audience=youth&method=ocr');
		const exposed = makeExposed();
		render(Harness, { props: { paramName: 'id', exposed } });
		expect(screen.getByTestId('key').textContent).toBe('');
	});

	it('select() pushes the value to the URL via goto', async () => {
		const exposed = makeExposed();
		render(Harness, { props: { paramName: 'id', exposed } });

		await act(() => {
			exposed.state.select('xyz');
		});

		expect(goto).toHaveBeenCalledTimes(1);
		const target = goto.mock.calls[0][0] as string;
		expect(target).toContain('id=xyz');
	});

	it('select() URL-encodes the value', async () => {
		const exposed = makeExposed();
		render(Harness, { props: { paramName: 'id', exposed } });

		await act(() => {
			exposed.state.select('a b/c');
		});

		const target = goto.mock.calls[0][0] as string;
		// URLSearchParams encodes space as `+` and slash as `%2F`.
		expect(target).toContain('id=a+b%2Fc');
	});

	it('select() scrolls to top by default', async () => {
		const exposed = makeExposed();
		render(Harness, { props: { paramName: 'id', exposed } });

		await act(() => {
			exposed.state.select('xyz');
		});

		expect(scrollSpy).toHaveBeenCalled();
	});

	it('select() does not scroll when scroll: false', async () => {
		const exposed = makeExposed();
		render(Harness, { props: { paramName: 'id', scroll: false, exposed } });

		await act(() => {
			exposed.state.select('xyz');
		});

		expect(scrollSpy).not.toHaveBeenCalled();
	});

	it('clear() removes the param via goto', async () => {
		seedUrl('http://localhost/?id=abc');
		const exposed = makeExposed();
		render(Harness, { props: { paramName: 'id', exposed } });

		await act(() => {
			exposed.state.clear();
		});

		expect(goto).toHaveBeenCalledTimes(1);
		const target = goto.mock.calls[0][0] as string;
		expect(target).not.toContain('id=');
	});

	it('clear() preserves other params', async () => {
		seedUrl('http://localhost/?id=abc&other=keep');
		const exposed = makeExposed();
		render(Harness, { props: { paramName: 'id', exposed } });

		await act(() => {
			exposed.state.clear();
		});

		const target = goto.mock.calls[0][0] as string;
		expect(target).toContain('other=keep');
		expect(target).not.toContain('id=');
	});

	it('clear() with no surviving params goes to bare ?', async () => {
		seedUrl('http://localhost/?id=abc');
		const exposed = makeExposed();
		render(Harness, { props: { paramName: 'id', exposed } });

		await act(() => {
			exposed.state.clear();
		});

		const target = goto.mock.calls[0][0] as string;
		// `removeFromUrl` falls back to `'?'` when the search string is
		// empty so the location.search stays predictable.
		expect(target).toBe('?');
	});

	it('clear() scrolls to top by default', async () => {
		seedUrl('http://localhost/?id=abc');
		const exposed = makeExposed();
		render(Harness, { props: { paramName: 'id', exposed } });

		await act(() => {
			exposed.state.clear();
		});

		expect(scrollSpy).toHaveBeenCalled();
	});

	it('clear() does not scroll when scroll: false', async () => {
		seedUrl('http://localhost/?id=abc');
		const exposed = makeExposed();
		render(Harness, { props: { paramName: 'id', scroll: false, exposed } });

		await act(() => {
			exposed.state.clear();
		});

		expect(scrollSpy).not.toHaveBeenCalled();
	});
});
