/**
 * Create URL selection helpers for a given parameter name.
 * The caller manages the $state and $effect — this just provides the URL sync logic.
 */
export function createUrlSelection(paramName: string) {
	function getFromUrl(url: URL): string {
		return url.searchParams.get(paramName) || '';
	}

	function pushToUrl(value: string) {
		const url = new URL(window.location.href);
		url.searchParams.set(paramName, value);
		history.pushState({}, '', url.toString());
	}

	function removeFromUrl() {
		const url = new URL(window.location.href);
		url.searchParams.delete(paramName);
		history.pushState({}, '', url.toString());
	}

	return { getFromUrl, pushToUrl, removeFromUrl };
}

/**
 * Scroll to top of page smoothly
 */
export function scrollToTop() {
	window.scrollTo({ top: 0, behavior: 'smooth' });
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
