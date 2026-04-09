/**
 * Tree-shakable ECharts core wrapper.
 *
 * Importing `echarts` directly pulls in the entire library (~1.8 MB
 * unminified). Instead, every chart component imports the core from this
 * module and registers ONLY the series/components it needs via
 * `echarts.use([...])`. With per-chart registration, the home page bundle
 * only contains the series the home page actually renders — graph, sankey,
 * sunburst, etc. stay out unless a route that uses them is loaded.
 *
 * Always register a renderer (CanvasRenderer or SVGRenderer) somewhere in
 * each chart's `use()` call, otherwise ECharts will fail at init-time.
 */
import * as echarts from 'echarts/core';

export { echarts };
