/**
 * Svelte action that fades/slides an element in as it enters the viewport.
 *
 * Usage:
 *   <div use:revealOnScroll>...</div>
 *   <div use:revealOnScroll={{ delay: 80 }}>...</div>
 *
 * The element gets `data-reveal="hidden"` immediately and flips to
 * `data-reveal="shown"` once it crosses the observation threshold. Styling
 * is handled globally via the matching CSS rule (see app.css); consumers
 * should not inline the transition.
 *
 * A shared observer instance is used across all targets to keep cost low
 * even with 1000+ items on screen. Elements unobserve themselves the first
 * time they are revealed — a reveal is one-shot, not a parallax effect.
 */

type RevealOptions = {
	/** Extra ms to wait before flipping to "shown" — lets cards in a row
	 *  stagger slightly. Kept small so scroll never feels janky. */
	delay?: number;
	/** IntersectionObserver rootMargin. Defaults to 10% below the fold so
	 *  the reveal kicks in just before the element is fully visible. */
	rootMargin?: string;
};

let sharedObserver: IntersectionObserver | null = null;
const pending = new WeakMap<Element, number>();

function ensureObserver(rootMargin: string): IntersectionObserver {
	if (sharedObserver) return sharedObserver;
	if (typeof IntersectionObserver === 'undefined') {
		return {
			observe: () => {},
			unobserve: () => {},
			disconnect: () => {},
			takeRecords: () => []
		} as unknown as IntersectionObserver;
	}
	sharedObserver = new IntersectionObserver(
		(entries, observer) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const el = entry.target as HTMLElement;
				const delay = pending.get(el) ?? 0;
				window.setTimeout(() => {
					el.dataset.reveal = 'shown';
				}, delay);
				observer.unobserve(el);
				pending.delete(el);
			}
		},
		{ rootMargin }
	);
	return sharedObserver;
}

export function revealOnScroll(node: HTMLElement, options: RevealOptions = {}) {
	const rootMargin = options.rootMargin ?? '0px 0px -10% 0px';
	const observer = ensureObserver(rootMargin);
	node.dataset.reveal = 'hidden';
	pending.set(node, options.delay ?? 0);
	observer.observe(node);

	return {
		update(next: RevealOptions = {}) {
			pending.set(node, next.delay ?? 0);
		},
		destroy() {
			observer.unobserve(node);
			pending.delete(node);
		}
	};
}
