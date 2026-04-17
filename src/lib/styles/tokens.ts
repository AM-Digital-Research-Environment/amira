/**
 * =============================================================================
 * WISSKI DASHBOARD — DESIGN TOKENS (TypeScript)
 * =============================================================================
 *
 * Typed access to design tokens for ECharts and runtime styling.
 *
 * SOURCE OF TRUTH: tokens.css defines every design token as a CSS custom
 * property. This file mirrors the chart palette and theme colors as hex, which
 * ECharts requires as concrete strings. When editing a color, update the HSL
 * in tokens.css AND the hex here together.
 * =============================================================================
 */

/* =============================================================================
   CHART COLOR PALETTE — "Scholarly Modernism"
   Categorical palette aligned to the brand identity (teal + copper roots).
   Hex values derived from the HSL definitions of --chart-1..--chart-10 in tokens.css.
   ============================================================================= */

export const CHART_COLORS = [
	'#2f9389', // 1  Teal       — brand
	'#c15b1f', // 2  Copper     — accent
	'#d3840d', // 3  Honey
	'#764fba', // 4  Iris
	'#d9264a', // 5  Garnet
	'#297dae', // 6  Slate blue
	'#3f8d66', // 7  Moss
	'#b84792', // 8  Plum
	'#c15533', // 9  Brick
	'#826e40' // 10 Ochre
] as const;

/**
 * Extended palette (16 colors) for visualizations with many categories.
 * Extends the core palette with complementary desaturated/muted variants.
 */
export const CHART_COLORS_EXTENDED = [
	...CHART_COLORS,
	'#52a8a1', // Teal light
	'#d98559', // Copper light
	'#e0a544', // Honey light
	'#9a82cf', // Iris light
	'#e36079', // Garnet light
	'#5a9cc5' // Slate blue light
] as const;

/**
 * Reduced palette (5 colors) for simple visualizations
 */
export const CHART_COLORS_SIMPLE = [
	'#2f9389', // Teal
	'#c15b1f', // Copper
	'#d3840d', // Honey
	'#764fba', // Iris
	'#d9264a' // Garnet
] as const;

/* =============================================================================
   LOCATION TYPE COLORS
   Consistent color mapping for geographic location types across all pages.
   Maps to CSS variables --location-city / --location-region / --location-country / --location-current.
   ============================================================================= */

export const LOCATION_COLORS = {
	city: CHART_COLORS[0], // Teal    — matches --location-city / --chart-1
	region: CHART_COLORS[2], // Honey   — matches --location-region / --chart-3
	country: CHART_COLORS[6], // Moss    — matches --location-country / --chart-7
	current: CHART_COLORS[3] // Iris    — matches --location-current / --chart-4
} as const;

/**
 * Get location type color by type string
 */
export function getLocationColor(type: string): string {
	switch (type) {
		case 'city':
			return LOCATION_COLORS.city;
		case 'region':
			return LOCATION_COLORS.region;
		case 'country':
			return LOCATION_COLORS.country;
		case 'current':
			return LOCATION_COLORS.current;
		default:
			return LOCATION_COLORS.current;
	}
}

/* =============================================================================
   THEME COLORS (Light/Dark aware hex values)
   ============================================================================= */

export const THEME_COLORS = {
	light: {
		// Surfaces (warm stone neutrals)
		background: '#fdfdfc', // --color-neutral-0
		foreground: '#221a16', // --color-neutral-900
		card: '#fdfdfc',
		cardForeground: '#221a16',
		popover: '#fdfdfc',
		popoverForeground: '#221a16',

		// Semantic (deep viridian primary — darkened for AA, copper accent)
		primary: '#196b69', // --color-primary-700
		primaryForeground: '#f9f8f6', // --color-neutral-50
		secondary: '#f2f0ee', // --color-neutral-100
		secondaryForeground: '#302621', // --color-neutral-800
		muted: '#f2f0ee',
		mutedForeground: '#766960', // --color-neutral-500
		accent: '#f9e8d2', // --color-accent-100
		accentForeground: '#65230b', // --color-accent-800
		destructive: '#a91936', // --color-danger-600 — AA-safe
		destructiveForeground: '#f9f8f6',

		// UI elements
		border: '#e4e1dd', // --color-neutral-200
		input: '#e4e1dd',
		ring: '#2f9389', // --color-primary-500

		// Chart specific
		chartText: '#463b35', // --color-neutral-700
		chartTextMuted: '#766960', // --color-neutral-500
		chartAxis: '#938980', // --color-neutral-400
		chartGrid: '#e4e1dd', // --color-neutral-200
		chartTooltipBg: 'rgba(253, 253, 252, 0.96)',
		chartTooltipBorder: '#e4e1dd'
	},
	dark: {
		// Surfaces
		background: '#140d0b', // --color-neutral-950
		foreground: '#f2f0ee', // --color-neutral-100
		card: '#221a16', // --color-neutral-900
		cardForeground: '#f2f0ee',
		popover: '#221a16',
		popoverForeground: '#f2f0ee',

		// Semantic
		primary: '#4ab5ae', // --color-primary-400
		primaryForeground: '#140d0b',
		secondary: '#302621', // --color-neutral-800
		secondaryForeground: '#f2f0ee',
		muted: '#302621',
		mutedForeground: '#c8c2bc', // --color-neutral-300 — AA on neutral-900
		accent: '#541a08', // --color-accent-900
		accentForeground: '#f2cfa6', // --color-accent-200
		destructive: '#c7233f', // --color-danger-500
		destructiveForeground: '#f9f8f6',

		// UI elements
		border: '#302621',
		input: '#302621',
		ring: '#4ab5ae',

		// Chart specific
		chartText: '#e4e1dd', // --color-neutral-200
		chartTextMuted: '#c8c2bc', // --color-neutral-300
		chartAxis: '#766960', // --color-neutral-500
		chartGrid: '#302621', // --color-neutral-800
		chartTooltipBg: 'rgba(34, 26, 22, 0.96)',
		chartTooltipBorder: '#463b35'
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
	normal: 400,
	medium: 500,
	semibold: 600,
	bold: 700
} as const;

/* =============================================================================
   BORDER RADIUS
   ============================================================================= */

const BORDER_RADIUS = {
	none: '0',
	sm: '0.25rem',
	md: '0.375rem',
	lg: '0.5rem',
	xl: '0.75rem',
	'2xl': '1rem',
	'3xl': '1.5rem',
	full: '9999px'
} as const;

/* =============================================================================
   SHADOWS (mirrors tokens.css, kept lightweight for ECharts extraCssText)
   ============================================================================= */

const SHADOW = {
	sm: '0 1px 2px 0 rgb(24 16 8 / 0.04), 0 1px 3px 0 rgb(24 16 8 / 0.06)',
	md: '0 2px 4px -1px rgb(24 16 8 / 0.06), 0 4px 8px -2px rgb(24 16 8 / 0.08)',
	lg: '0 4px 6px -2px rgb(24 16 8 / 0.05), 0 12px 20px -4px rgb(24 16 8 / 0.1)'
} as const;

/* =============================================================================
   ECHARTS THEME CONFIGURATIONS
   ============================================================================= */

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

export function getEChartsTheme(isDark: boolean) {
	return isDark ? ECHARTS_THEME_DARK : ECHARTS_THEME_LIGHT;
}

export function getChartColor(index: number): string {
	return CHART_COLORS[index % CHART_COLORS.length];
}

export function getThemeColors(isDark: boolean) {
	return isDark ? THEME_COLORS.dark : THEME_COLORS.light;
}

// Shadow constants for cases outside ECharts
export { SHADOW, BORDER_RADIUS };

/* =============================================================================
   ECHARTS PERFORMANCE SETTINGS
   ============================================================================= */

export const ECHARTS_PERFORMANCE = {
	LARGE_DATASET_THRESHOLD: 1000,
	PROGRESSIVE_THRESHOLD: 5000,
	PROGRESSIVE_CHUNK_SIZE: 500,
	RESIZE_THROTTLE_MS: 100
} as const;
