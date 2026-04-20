/** @type {import('tailwindcss').Config} */
export default {
	theme: {
		extend: {
			/* =================================================================
			   COLORS
			   ================================================================= */
			colors: {
				// Semantic colors mapped to CSS variables
				border: {
					DEFAULT: 'hsl(var(--border))',
					muted: 'hsl(var(--border-muted))',
					strong: 'hsl(var(--border-strong))'
				},
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',

				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					hover: 'hsl(var(--primary-hover))',
					active: 'hsl(var(--primary-active))',
					muted: 'hsl(var(--primary-muted))',
					// Dedicated hue for primary-coloured text (links) — darker for legibility
					text: 'hsl(var(--primary-text))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
					hover: 'hsl(var(--secondary-hover))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
					hover: 'hsl(var(--destructive-hover))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))',
					muted: 'hsl(var(--success-muted))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))',
					muted: 'hsl(var(--warning-muted))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
					hover: 'hsl(var(--accent-hover))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},

				// Surface colors
				surface: {
					ground: 'hsl(var(--surface-ground))',
					card: 'hsl(var(--surface-card))',
					elevated: 'hsl(var(--surface-elevated))',
					overlay: 'hsl(var(--surface-overlay))'
				},

				// Location type colors (consistent across all pages)
				location: {
					city: 'hsl(var(--location-city))',
					region: 'hsl(var(--location-region))',
					country: 'hsl(var(--location-country))',
					current: 'hsl(var(--location-current))'
				},

				chart: {
					1: 'hsl(var(--chart-1))',
					2: 'hsl(var(--chart-2))',
					3: 'hsl(var(--chart-3))',
					4: 'hsl(var(--chart-4))',
					5: 'hsl(var(--chart-5))',
					6: 'hsl(var(--chart-6))',
					7: 'hsl(var(--chart-7))',
					8: 'hsl(var(--chart-8))',
					9: 'hsl(var(--chart-9))',
					10: 'hsl(var(--chart-10))'
				}
			},

			/* =================================================================
			   BORDER RADIUS
			   ================================================================= */
			borderRadius: {
				sm: 'var(--radius-sm)',
				md: 'var(--radius-md)',
				lg: 'var(--radius-lg)',
				xl: 'var(--radius-xl)',
				'2xl': 'var(--radius-2xl)',
				'3xl': 'var(--radius-3xl)'
			},

			/* =================================================================
			   TYPOGRAPHY
			   ================================================================= */
			fontFamily: {
				sans: ['var(--font-sans)'],
				serif: ['var(--font-serif)'],
				mono: ['var(--font-mono)'],
				display: ['var(--font-display)']
			},
			fontSize: {
				'2xs': ['var(--font-size-2xs)', { lineHeight: 'var(--line-height-normal)' }]
			},
			fontWeight: {
				normal: 'var(--font-weight-normal)',
				medium: 'var(--font-weight-medium)',
				semibold: 'var(--font-weight-semibold)',
				bold: 'var(--font-weight-bold)'
			},
			letterSpacing: {
				tighter: 'var(--tracking-tighter)',
				tight: 'var(--tracking-tight)',
				normal: 'var(--tracking-normal)',
				wide: 'var(--tracking-wide)',
				widest: 'var(--tracking-widest)'
			},
			lineHeight: {
				none: 'var(--line-height-none)',
				tight: 'var(--line-height-tight)',
				snug: 'var(--line-height-snug)',
				normal: 'var(--line-height-normal)',
				relaxed: 'var(--line-height-relaxed)'
			},

			/* =================================================================
			   SPACING — mirrors tokens.css, extended for page-level gaps
			   ================================================================= */
			spacing: {
				0.5: 'var(--space-0-5)',
				2.5: 'var(--space-2-5)',
				7: 'var(--space-7)',
				8: 'var(--space-8)',
				10: 'var(--space-10)',
				12: 'var(--space-12)',
				14: 'var(--space-14)',
				16: 'var(--space-16)',
				20: 'var(--space-20)',
				24: 'var(--space-24)'
			},

			/* =================================================================
			   SHADOWS
			   ================================================================= */
			boxShadow: {
				xs: 'var(--shadow-xs)',
				sm: 'var(--shadow-sm)',
				md: 'var(--shadow-md)',
				lg: 'var(--shadow-lg)',
				xl: 'var(--shadow-xl)',
				'2xl': 'var(--shadow-2xl)',
				elevated: 'var(--shadow-elevated)',
				glow: 'var(--shadow-glow)'
			},

			/* =================================================================
			   Z-INDEX
			   ================================================================= */
			zIndex: {
				below: 'var(--z-below)',
				base: 'var(--z-base)',
				raised: 'var(--z-raised)',
				dropdown: 'var(--z-dropdown)',
				sticky: 'var(--z-sticky)',
				fixed: 'var(--z-fixed)',
				overlay: 'var(--z-overlay)',
				modal: 'var(--z-modal)',
				popover: 'var(--z-popover)',
				tooltip: 'var(--z-tooltip)',
				toast: 'var(--z-toast)',
				max: 'var(--z-max)'
			},

			/* =================================================================
			   MOTION — pruned to what tokens.css actually defines
			   ================================================================= */
			transitionDuration: {
				instant: 'var(--duration-instant)',
				fast: 'var(--duration-fast)',
				normal: 'var(--duration-normal)',
				slow: 'var(--duration-slow)',
				slower: 'var(--duration-slower)',
				chart: 'var(--duration-chart)'
			},
			transitionTimingFunction: {
				linear: 'var(--ease-linear)',
				in: 'var(--ease-in)',
				out: 'var(--ease-out)',
				'in-out': 'var(--ease-in-out)',
				'expo-out': 'var(--ease-expo-out)',
				'back-out': 'var(--ease-back-out)'
			},
			keyframes: {
				'fade-in': {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' }
				},
				'fade-out': {
					'0%': { opacity: '1' },
					'100%': { opacity: '0' }
				},
				'slide-in-up': {
					'0%': { opacity: '0', transform: 'translateY(12px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'slide-in-down': {
					'0%': { opacity: '0', transform: 'translateY(-12px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'slide-in-left': {
					'0%': { opacity: '0', transform: 'translateX(-12px)' },
					'100%': { opacity: '1', transform: 'translateX(0)' }
				},
				'slide-in-right': {
					'0%': { opacity: '0', transform: 'translateX(12px)' },
					'100%': { opacity: '1', transform: 'translateX(0)' }
				},
				'scale-in': {
					'0%': { opacity: '0', transform: 'scale(0.96)' },
					'100%': { opacity: '1', transform: 'scale(1)' }
				}
			},
			animation: {
				'fade-in': 'fade-in var(--duration-normal) var(--ease-out)',
				'fade-out': 'fade-out var(--duration-normal) var(--ease-in)',
				'slide-in-up': 'slide-in-up var(--duration-slow) var(--ease-expo-out)',
				'slide-in-down': 'slide-in-down var(--duration-slow) var(--ease-expo-out)',
				'slide-in-left': 'slide-in-left var(--duration-slow) var(--ease-expo-out)',
				'slide-in-right': 'slide-in-right var(--duration-slow) var(--ease-expo-out)',
				'scale-in': 'scale-in var(--duration-normal) var(--ease-back-out)'
			},

			/* =================================================================
			   LAYOUT
			   ================================================================= */
			width: {
				sidebar: 'var(--layout-sidebar-width)'
			},
			height: {
				header: 'var(--layout-header-height)',
				footer: 'var(--layout-footer-height)',
				'chart-sm': 'var(--chart-h-sm)',
				'chart-md': 'var(--chart-h-md)',
				'chart-lg': 'var(--chart-h-lg)',
				'chart-xl': 'var(--chart-h-xl)',
				'chart-2xl': 'var(--chart-h-2xl)'
			},
			minHeight: {
				'chart-sm': 'var(--chart-h-sm)',
				'chart-md': 'var(--chart-h-md)',
				'chart-lg': 'var(--chart-h-lg)',
				'chart-xl': 'var(--chart-h-xl)',
				'chart-2xl': 'var(--chart-h-2xl)'
			},
			maxHeight: {
				'list-scroll': 'var(--list-scroll-max-h)'
			},
			maxWidth: {
				'container-xs': 'var(--container-xs)',
				'container-sm': 'var(--container-sm)',
				'container-md': 'var(--container-md)',
				'container-lg': 'var(--container-lg)',
				'container-xl': 'var(--container-xl)',
				'container-2xl': 'var(--container-2xl)',
				'container-3xl': 'var(--container-3xl)',
				'container-4xl': 'var(--container-4xl)',
				'container-5xl': 'var(--container-5xl)',
				'container-6xl': 'var(--container-6xl)',
				'container-7xl': 'var(--container-7xl)'
			}
		}
	},
	plugins: []
};
