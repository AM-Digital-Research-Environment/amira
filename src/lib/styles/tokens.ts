/**
 * =============================================================================
 * WISSKI DASHBOARD — DESIGN TOKENS (TypeScript)
 * =============================================================================
 *
 * This file provides typed access to design tokens for use in JavaScript/TypeScript.
 * Primary use cases:
 * - ECharts theme configuration
 * - Dynamic styling calculations
 * - Runtime color manipulations
 *
 * All values here should match the CSS custom properties in tokens.css
 * =============================================================================
 */

/* =============================================================================
   CHART COLOR PALETTE
   ============================================================================= */

/**
 * Primary categorical color palette for data visualization.
 * Designed for accessibility and visual distinction.
 * Use in order for consistent visual hierarchy.
 */
export const CHART_COLORS = [
	'#3b82f6', // Blue
	'#10b981', // Emerald
	'#f59e0b', // Amber
	'#ef4444', // Red
	'#8b5cf6', // Purple
	'#ec4899', // Pink
	'#06b6d4', // Cyan
	'#84cc16', // Lime
	'#f97316', // Orange
	'#6366f1'  // Indigo
] as const;

/**
 * Extended palette (20 colors) for visualizations with many categories
 */
export const CHART_COLORS_EXTENDED = [
	...CHART_COLORS,
	'#14b8a6', // Teal
	'#a855f7', // Violet
	'#f43f5e', // Rose
	'#0ea5e9', // Sky
	'#22c55e', // Green
	'#eab308', // Yellow
	'#64748b', // Slate
	'#78716c', // Stone
	'#0d9488', // Teal dark
	'#7c3aed'  // Violet dark
] as const;

/**
 * Reduced palette (5 colors) for simple visualizations
 */
export const CHART_COLORS_SIMPLE = [
	'#3b82f6', // Blue
	'#10b981', // Emerald
	'#f59e0b', // Amber
	'#ef4444', // Red
	'#8b5cf6'  // Purple
] as const;

/* =============================================================================
   THEME COLORS (Light/Dark aware hex values)
   ============================================================================= */

export const THEME_COLORS = {
	light: {
		// Surfaces
		background: '#ffffff',
		foreground: '#020617',
		card: '#ffffff',
		cardForeground: '#020617',
		popover: '#ffffff',
		popoverForeground: '#020617',

		// Semantic
		primary: '#2563eb',
		primaryForeground: '#f8fafc',
		secondary: '#f1f5f9',
		secondaryForeground: '#0f172a',
		muted: '#f1f5f9',
		mutedForeground: '#64748b',
		accent: '#f1f5f9',
		accentForeground: '#0f172a',
		destructive: '#ef4444',
		destructiveForeground: '#f8fafc',

		// UI Elements
		border: '#e2e8f0',
		input: '#e2e8f0',
		ring: '#3b82f6',

		// Chart specific
		chartText: '#374151',
		chartTextMuted: '#6b7280',
		chartAxis: '#9ca3af',
		chartGrid: '#e5e7eb',
		chartTooltipBg: 'rgba(255, 255, 255, 0.95)',
		chartTooltipBorder: '#e5e7eb'
	},
	dark: {
		// Surfaces
		background: '#020617',
		foreground: '#f8fafc',
		card: '#0f172a',
		cardForeground: '#f8fafc',
		popover: '#0f172a',
		popoverForeground: '#f8fafc',

		// Semantic
		primary: '#3b82f6',
		primaryForeground: '#020617',
		secondary: '#1e293b',
		secondaryForeground: '#f8fafc',
		muted: '#1e293b',
		mutedForeground: '#94a3b8',
		accent: '#1e293b',
		accentForeground: '#f8fafc',
		destructive: '#dc2626',
		destructiveForeground: '#f8fafc',

		// UI Elements
		border: '#1e293b',
		input: '#1e293b',
		ring: '#3b82f6',

		// Chart specific
		chartText: '#e5e7eb',
		chartTextMuted: '#9ca3af',
		chartAxis: '#4b5563',
		chartGrid: '#1f2937',
		chartTooltipBg: 'rgba(17, 24, 39, 0.95)',
		chartTooltipBorder: '#374151'
	}
} as const;

/* =============================================================================
   TYPOGRAPHY
   ============================================================================= */

export const FONT_FAMILY = {
	sans: "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
	serif: "'Crimson Pro', 'Georgia', 'Cambria', 'Times New Roman', serif",
	mono: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace"
} as const;

const FONT_WEIGHT = {
	thin: 100,
	extralight: 200,
	light: 300,
	normal: 400,
	medium: 500,
	semibold: 600,
	bold: 700,
	extrabold: 800,
	black: 900
} as const;

/* =============================================================================
   BORDER RADIUS
   ============================================================================= */

const BORDER_RADIUS = {
	none: '0',
	sm: '0.125rem',
	default: '0.25rem',
	md: '0.375rem',
	lg: '0.5rem',
	xl: '0.75rem',
	'2xl': '1rem',
	'3xl': '1.5rem',
	full: '9999px'
} as const;

/* =============================================================================
   SHADOWS
   ============================================================================= */

const SHADOW = {
	xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
	sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
	md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
	lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
	xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
	'2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
	inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
	none: '0 0 #0000'
} as const;

/* =============================================================================
   ECHARTS THEME CONFIGURATIONS
   ============================================================================= */

/**
 * ECharts theme configuration for light mode
 */
export const ECHARTS_THEME_LIGHT = {
	backgroundColor: 'transparent',
	textStyle: {
		color: THEME_COLORS.light.chartText,
		fontFamily: FONT_FAMILY.sans
	},
	title: {
		textStyle: {
			color: THEME_COLORS.light.foreground,
			fontWeight: FONT_WEIGHT.semibold
		}
	},
	legend: {
		textStyle: {
			color: THEME_COLORS.light.chartTextMuted
		}
	},
	tooltip: {
		backgroundColor: THEME_COLORS.light.chartTooltipBg,
		borderColor: THEME_COLORS.light.chartTooltipBorder,
		borderWidth: 1,
		textStyle: {
			color: THEME_COLORS.light.chartText
		},
		extraCssText: `border-radius: ${BORDER_RADIUS.lg}; box-shadow: ${SHADOW.lg};`
	},
	xAxis: {
		axisLine: {
			lineStyle: { color: THEME_COLORS.light.chartAxis }
		},
		axisLabel: {
			color: THEME_COLORS.light.chartTextMuted
		},
		splitLine: {
			lineStyle: { color: THEME_COLORS.light.chartGrid }
		}
	},
	yAxis: {
		axisLine: {
			lineStyle: { color: THEME_COLORS.light.chartAxis }
		},
		axisLabel: {
			color: THEME_COLORS.light.chartTextMuted
		},
		splitLine: {
			lineStyle: { color: THEME_COLORS.light.chartGrid }
		}
	},
	color: CHART_COLORS
} as const;

/**
 * ECharts theme configuration for dark mode
 */
export const ECHARTS_THEME_DARK = {
	backgroundColor: 'transparent',
	textStyle: {
		color: THEME_COLORS.dark.chartText,
		fontFamily: FONT_FAMILY.sans
	},
	title: {
		textStyle: {
			color: THEME_COLORS.dark.foreground,
			fontWeight: FONT_WEIGHT.semibold
		}
	},
	legend: {
		textStyle: {
			color: THEME_COLORS.dark.chartTextMuted
		}
	},
	tooltip: {
		backgroundColor: THEME_COLORS.dark.chartTooltipBg,
		borderColor: THEME_COLORS.dark.chartTooltipBorder,
		borderWidth: 1,
		textStyle: {
			color: THEME_COLORS.dark.chartText
		},
		extraCssText: `border-radius: ${BORDER_RADIUS.lg}; box-shadow: ${SHADOW.lg};`
	},
	xAxis: {
		axisLine: {
			lineStyle: { color: THEME_COLORS.dark.chartAxis }
		},
		axisLabel: {
			color: THEME_COLORS.dark.chartTextMuted
		},
		splitLine: {
			lineStyle: { color: THEME_COLORS.dark.chartGrid }
		}
	},
	yAxis: {
		axisLine: {
			lineStyle: { color: THEME_COLORS.dark.chartAxis }
		},
		axisLabel: {
			color: THEME_COLORS.dark.chartTextMuted
		},
		splitLine: {
			lineStyle: { color: THEME_COLORS.dark.chartGrid }
		}
	},
	color: CHART_COLORS
} as const;

/**
 * Helper to get ECharts theme based on current theme mode
 */
export function getEChartsTheme(isDark: boolean) {
	return isDark ? ECHARTS_THEME_DARK : ECHARTS_THEME_LIGHT;
}

/**
 * Helper to get a color from the chart palette by index (with wrapping)
 */
export function getChartColor(index: number): string {
	return CHART_COLORS[index % CHART_COLORS.length];
}

/**
 * Helper to get theme colors based on mode
 */
export function getThemeColors(isDark: boolean) {
	return isDark ? THEME_COLORS.dark : THEME_COLORS.light;
}

/* =============================================================================
   ECHARTS PERFORMANCE SETTINGS
   ============================================================================= */

/**
 * Performance thresholds and settings for ECharts
 * Used to automatically optimize large dataset rendering
 */
export const ECHARTS_PERFORMANCE = {
	/** Dataset size threshold for enabling large mode optimizations */
	LARGE_DATASET_THRESHOLD: 1000,
	/** Dataset size threshold for enabling progressive rendering */
	PROGRESSIVE_THRESHOLD: 5000,
	/** Number of data points to render per frame in progressive mode */
	PROGRESSIVE_CHUNK_SIZE: 500,
	/** Milliseconds to throttle resize event handlers */
	RESIZE_THROTTLE_MS: 100
} as const;
