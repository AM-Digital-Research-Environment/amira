import '@testing-library/jest-dom/vitest';

// jsdom does not implement the Web Animations API. Svelte transitions
// (fade, scale, fly, ...) call `element.animate()` and crash the test
// when it's missing. Stub a no-op Animation so transitions are a no-op
// in jsdom — components still mount and unmount; we just skip the
// keyframe animation we wouldn't observe in a virtual DOM anyway.
if (typeof Element !== 'undefined' && !Element.prototype.animate) {
	Element.prototype.animate = function () {
		const animation = {
			cancel() {},
			finish() {},
			pause() {},
			play() {},
			reverse() {},
			addEventListener() {},
			removeEventListener() {},
			dispatchEvent() {
				return true;
			},
			finished: Promise.resolve({} as Animation),
			ready: Promise.resolve({} as Animation),
			currentTime: 0,
			playbackRate: 1,
			startTime: 0,
			playState: 'finished',
			pending: false,
			id: '',
			effect: null,
			timeline: null,
			oncancel: null,
			onfinish: null,
			onremove: null,
			replaceState: 'active',
			commitStyles() {},
			persist() {},
			updatePlaybackRate() {}
		} as unknown as Animation;
		return animation;
	};
}
