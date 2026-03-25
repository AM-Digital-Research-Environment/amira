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
 * SOURCE OF TRUTH: tokens.css defines all design tokens as CSS custom properties.
 * This file provides hex equivalents for contexts that require concrete values
 * (e.g., ECharts config). When updating, always derive values from tokens.css.
 *
 * HSL-to-hex conversion: values computed from the HSL definitions in tokens.css.
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
		// Surfaces (warm stone neutrals — "Scholarly Modernism")
		background: '#fdfdfc',       // --color-neutral-0:  hsl(40, 20%, 99%)
		foreground: '#221a16',       // --color-neutral-900: hsl(18, 22%, 11%)
		card: '#fdfdfc',             // --color-neutral-0
		cardForeground: '#221a16',   // --color-neutral-900
		popover: '#fdfdfc',          // --color-neutral-0
		popoverForeground: '#221a16',// --color-neutral-900

		// Semantic (deep viridian/teal primary, copper accent)
		primary: '#22817b',          // --color-primary-600: hsl(176, 58%, 32%)
		primaryForeground: '#f9f8f6',// --color-neutral-50:  hsl(40, 18%, 97%)
		secondary: '#f2f0ee',        // --color-neutral-100: hsl(36, 14%, 94%)
		secondaryForeground: '#302621',// --color-neutral-800: hsl(20, 18%, 16%)
		muted: '#f2f0ee',            // --color-neutral-100
		mutedForeground: '#766960',  // --color-neutral-500: hsl(25, 10%, 42%)
		accent: '#f9e8d2',           // --color-accent-100:  hsl(34, 78%, 90%)
		accentForeground: '#65230b', // --color-accent-800:  hsl(16, 80%, 22%)
		destructive: '#f43e5c',      // --color-danger-500:  hsl(350, 89%, 60%)
		destructiveForeground: '#f9f8f6',// --color-neutral-50

		// UI Elements
		border: '#e4e1dd',           // --color-neutral-200: hsl(34, 12%, 88%)
		input: '#e4e1dd',            // --color-neutral-200
		ring: '#2f9389',             // --color-primary-500: hsl(174, 52%, 38%)

		// Chart specific
		chartText: '#463b35',        // --color-neutral-700: hsl(22, 14%, 24%)
		chartTextMuted: '#766960',   // --color-neutral-500: hsl(25, 10%, 42%)
		chartAxis: '#938980',        // --color-neutral-400: hsl(28, 8%, 54%)
		chartGrid: '#e4e1dd',        // --color-neutral-200
		chartTooltipBg: 'rgba(253, 253, 252, 0.95)', // --color-neutral-0 with alpha
		chartTooltipBorder: '#e4e1dd'// --color-neutral-200
	},
	dark: {
		// Surfaces (dark warm stone)
		background: '#140d0b',       // --color-neutral-950: hsl(16, 30%, 6%)
		foreground: '#f2f0ee',       // --color-neutral-100: hsl(36, 14%, 94%)
		card: '#221a16',             // --color-neutral-900: hsl(18, 22%, 11%)
		cardForeground: '#f2f0ee',   // --color-neutral-100
		popover: '#221a16',          // --color-neutral-900
		popoverForeground: '#f2f0ee',// --color-neutral-100

		// Semantic
		primary: '#4ab5ae',          // --color-primary-400: hsl(176, 42%, 50%)
		primaryForeground: '#140d0b',// --color-neutral-950
		secondary: '#302621',        // --color-neutral-800: hsl(20, 18%, 16%)
		secondaryForeground: '#f2f0ee',// --color-neutral-100
		muted: '#302621',            // --color-neutral-800
		mutedForeground: '#938980',  // --color-neutral-400: hsl(28, 8%, 54%)
		accent: '#541a08',           // --color-accent-900:  hsl(14, 82%, 18%)
		accentForeground: '#f2cfa6', // --color-accent-200:  hsl(32, 74%, 80%)
		destructive: '#e21d48',      // --color-danger-600:  hsl(347, 77%, 50%)
		destructiveForeground: '#f9f8f6',// --color-neutral-50

		// UI Elements
		border: '#302621',           // --color-neutral-800
		input: '#302621',            // --color-neutral-800
		ring: '#2f9389',             // --color-primary-500

		// Chart specific
		chartText: '#e4e1dd',        // --color-neutral-200
		chartTextMuted: '#c8c2bc',   // --color-neutral-300: hsl(32, 10%, 76%)
		chartAxis: '#766960',        // --color-neutral-500: hsl(25, 10%, 42%)
		chartGrid: '#302621',        // --color-neutral-800
		chartTooltipBg: 'rgba(34, 26, 22, 0.95)', // --color-neutral-900 with alpha
		chartTooltipBorder: '#463b35'// --color-neutral-700
	}
} as const;

/* =============================================================================
   TYPOGRAPHY
   ============================================================================= */

export const FONT_FAMILY = {
	display: "'Fraunces', 'Playfair Display', 'Georgia', serif",
	sans: "'Plus Jakarta Sans', 'DM Sans', ui-sans-serif, system-ui, sans-serif",
	serif: "'Source Serif 4', 'Crimson Pro', 'Georgia', serif",
	mono: "'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace"
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
	xs: '0 1px 2px 0 rgb(24 16 8 / 0.04)',
	sm: '0 1px 3px 0 rgb(24 16 8 / 0.06), 0 1px 2px -1px rgb(24 16 8 / 0.06)',
	md: '0 4px 6px -1px rgb(24 16 8 / 0.08), 0 2px 4px -2px rgb(24 16 8 / 0.06)',
	lg: '0 10px 15px -3px rgb(24 16 8 / 0.1), 0 4px 6px -4px rgb(24 16 8 / 0.08)',
	xl: '0 20px 25px -5px rgb(24 16 8 / 0.12), 0 8px 10px -6px rgb(24 16 8 / 0.08)',
	'2xl': '0 25px 50px -12px rgb(24 16 8 / 0.2)',
	inner: 'inset 0 2px 4px 0 rgb(24 16 8 / 0.04)',
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
