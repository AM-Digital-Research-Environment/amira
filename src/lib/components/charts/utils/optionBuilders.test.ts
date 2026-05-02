import { describe, it, expect } from 'vitest';
import {
	buildTitle,
	buildGrid,
	buildDataZoom,
	hideAxes,
	buildTooltip,
	buildLegend,
	buildVisualMap,
	buildAxisLabel
} from './optionBuilders';

describe('buildTitle', () => {
	it('returns undefined when no title is given', () => {
		expect(buildTitle()).toBeUndefined();
		expect(buildTitle('')).toBeUndefined();
	});

	it('defaults to centered top placement', () => {
		expect(buildTitle('Hi')).toEqual({
			text: 'Hi',
			left: 'center',
			top: 0,
			textStyle: undefined
		});
	});

	it('honours position overrides', () => {
		expect(buildTitle('Hi', { left: 'left', top: 12 })).toMatchObject({
			text: 'Hi',
			left: 'left',
			top: 12
		});
	});
});

describe('buildGrid', () => {
	it('uses sane defaults', () => {
		expect(buildGrid()).toEqual({
			left: '3%',
			right: '4%',
			top: '10%',
			bottom: '15%',
			containLabel: true
		});
	});

	it('respects each override', () => {
		const g = buildGrid({ left: 10, top: '20%', containLabel: false });
		expect(g).toMatchObject({ left: 10, top: '20%', containLabel: false });
	});
});

describe('buildDataZoom', () => {
	it('returns undefined when both slider and inside are off', () => {
		expect(buildDataZoom({ showSlider: false })).toBeUndefined();
	});

	it('emits a slider zoom by default', () => {
		const z = buildDataZoom();
		expect(Array.isArray(z)).toBe(true);
		expect(z).toEqual([{ type: 'slider', start: 0, end: 100, bottom: 10, height: 25 }]);
	});

	it('emits both slider + inside when both flags are on', () => {
		const z = buildDataZoom({ showInside: true });
		expect(Array.isArray(z)).toBe(true);
		const arr = z as { type: string }[];
		expect(arr.map((d) => d.type)).toEqual(['slider', 'inside']);
	});
});

describe('hideAxes', () => {
	it('returns x/y axes hidden', () => {
		expect(hideAxes()).toEqual({ xAxis: { show: false }, yAxis: { show: false } });
	});
});

describe('buildTooltip', () => {
	it('defaults to confine=true and no other keys', () => {
		expect(buildTooltip()).toEqual({ confine: true });
	});

	it('passes through trigger and axisPointer (wrapping into {type})', () => {
		expect(buildTooltip({ trigger: 'axis', axisPointer: 'shadow' })).toEqual({
			confine: true,
			trigger: 'axis',
			axisPointer: { type: 'shadow' }
		});
	});

	it('passes through formatter, position, and triggerOn', () => {
		const fn = () => 'x';
		const t = buildTooltip({ formatter: fn, position: 'top', triggerOn: 'mousemove' });
		expect(t).toMatchObject({
			confine: true,
			formatter: fn,
			position: 'top',
			triggerOn: 'mousemove'
		});
	});

	it('honours an explicit confine override', () => {
		expect(buildTooltip({ confine: false })).toEqual({ confine: false });
	});
});

describe('buildLegend', () => {
	it('defaults to scroll, bottom-center', () => {
		expect(buildLegend()).toEqual({
			type: 'scroll',
			orient: 'horizontal',
			left: 'center',
			bottom: 0
		});
	});

	it('honours top placement', () => {
		expect(buildLegend({ position: 'top' })).toMatchObject({
			orient: 'horizontal',
			left: 'center',
			top: 0
		});
	});

	it('honours left placement', () => {
		expect(buildLegend({ position: 'left' })).toMatchObject({
			orient: 'vertical',
			left: 'left',
			top: 'middle'
		});
	});

	it('honours right placement (anchors via right:0)', () => {
		const l = buildLegend({ position: 'right' }) as Record<string, unknown>;
		expect(l).toMatchObject({ orient: 'vertical', right: 0, top: 'middle' });
		expect(l).not.toHaveProperty('left');
	});

	it('forwards data and textStyle', () => {
		expect(buildLegend({ data: ['a', 'b'], textStyle: { color: 'red' } })).toMatchObject({
			data: ['a', 'b'],
			textStyle: { color: 'red' }
		});
	});

	it('respects scroll=false', () => {
		const l = buildLegend({ scroll: false }) as Record<string, unknown>;
		expect(l).not.toHaveProperty('type');
	});

	it('honours an explicit bottom override on bottom-positioned legend', () => {
		expect(buildLegend({ bottom: 65 })).toMatchObject({ bottom: 65 });
	});
});

describe('buildVisualMap', () => {
	it('builds the common horizontal-bottom heatmap config', () => {
		expect(buildVisualMap({ min: 0, max: 10, colors: ['#fff', '#000'] })).toEqual({
			min: 0,
			max: 10,
			calculable: true,
			orient: 'horizontal',
			inRange: { color: ['#fff', '#000'] },
			left: 'center',
			bottom: 10
		});
	});

	it('switches to right-vertical when orient=vertical', () => {
		const v = buildVisualMap({
			min: 0,
			max: 5,
			colors: ['#a', '#b'],
			orient: 'vertical'
		}) as Record<string, unknown>;
		expect(v).toMatchObject({ orient: 'vertical', right: 0, top: 'center' });
	});

	it('honours item dimensions and textStyle', () => {
		const v = buildVisualMap({
			min: 0,
			max: 1,
			colors: ['#a'],
			itemWidth: 12,
			itemHeight: 110,
			textStyle: { fontSize: 11 }
		}) as Record<string, unknown>;
		expect(v).toMatchObject({ itemWidth: 12, itemHeight: 110, textStyle: { fontSize: 11 } });
	});

	it('passes calculable=false through', () => {
		const v = buildVisualMap({
			min: 0,
			max: 1,
			colors: ['#a'],
			calculable: false
		}) as Record<string, unknown>;
		expect(v.calculable).toBe(false);
	});
});

describe('buildAxisLabel', () => {
	it('returns an empty object by default', () => {
		expect(buildAxisLabel()).toEqual({});
	});

	it('spreads baseStyle then adds overrides', () => {
		expect(buildAxisLabel({ baseStyle: { color: '#333' }, rotate: 45, fontSize: 11 })).toEqual({
			color: '#333',
			rotate: 45,
			fontSize: 11
		});
	});

	it('forwards width / overflow / interval', () => {
		expect(buildAxisLabel({ width: 140, overflow: 'truncate', interval: 0 })).toEqual({
			width: 140,
			overflow: 'truncate',
			interval: 0
		});
	});

	it('omits fields that were not supplied', () => {
		const r = buildAxisLabel({ rotate: 35 });
		expect(r).toEqual({ rotate: 35 });
		expect(r).not.toHaveProperty('fontSize');
		expect(r).not.toHaveProperty('width');
	});
});
