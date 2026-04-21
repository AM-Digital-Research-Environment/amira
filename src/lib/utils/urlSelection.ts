import { goto } from '$app/navigation';

/**
 * Create URL selection helpers for a given parameter name.
 * The caller manages the $state and $effect — this just provides the URL sync logic.
 * Uses SvelteKit's goto() so that $page reactivity works with browser back/forward.
 */
export function createUrlSelection(paramName: string) {
	function getFromUrl(url: URL): string {
		return url.searchParams.get(paramName) || '';
	}

	function pushToUrl(value: string) {
		const url = new URL(window.location.href);
		url.searchParams.set(paramName, value);
		goto(`?${url.searchParams.toString()}`, { noScroll: true });
	}

	function removeFromUrl() {
		const url = new URL(window.location.href);
		url.searchParams.delete(paramName);
		const qs = url.searchParams.toString();
		goto(qs ? `?${qs}` : '?', { noScroll: true });
	}

	return { getFromUrl, pushToUrl, removeFromUrl };
}

/**
 * Scroll to top of page. Uses instant behavior and re-applies after the
 * next frame so the scroll survives the DOM swap when an overview view
 * is replaced by a taller detail view (the original smooth-scroll got
 * cut short when the document height changed, landing you mid-page).
 */
export function scrollToTop() {
	window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
	requestAnimationFrame(() => {
		window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
	});
}

/**
 * Scroll to an element smoothly after a brief delay
 */
export function scrollToElement(el: HTMLElement | null | undefined) {
	if (!el) return;
	setTimeout(() => {
		el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}, 50);
}
