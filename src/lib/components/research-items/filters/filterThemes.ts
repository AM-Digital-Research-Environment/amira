/**
 * Color themes for `ItemFilterGroup`.
 *
 * The filter sidebar uses one theme per facet (subjects, tags, countries,
 * etc.) so each pill and active-row reads as belonging to its facet at a
 * glance. Themes are full Tailwind class strings (rather than colour
 * tokens) because the active class also varies in `text-foreground` /
 * `text-{name}` and `font-medium` boldness — easier to bake in than to
 * compose at the call site.
 */

export interface ItemFilterTheme {
	/** Class applied to the selected-value pill button (closes the chip). */
	pillClass: string;
	/** Class applied to the option-list row when it is currently selected. */
	optionActiveClass: string;
}

export const FILTER_THEMES = {
	primary: {
		pillClass: 'bg-primary/15 text-primary hover:bg-primary/25',
		optionActiveClass: 'bg-primary/10 text-primary'
	},
	accent: {
		pillClass: 'bg-accent/30 text-accent-foreground hover:bg-accent/50',
		optionActiveClass: 'bg-accent/20 text-accent-foreground'
	},
	'chart-1': {
		pillClass: 'bg-chart-1/15 text-foreground hover:bg-chart-1/25',
		optionActiveClass: 'bg-chart-1/10 text-foreground font-medium'
	},
	'chart-2': {
		pillClass: 'bg-chart-2/15 text-foreground hover:bg-chart-2/25',
		optionActiveClass: 'bg-chart-2/10 text-foreground font-medium'
	},
	'chart-3': {
		pillClass: 'bg-chart-3/15 text-foreground hover:bg-chart-3/25',
		optionActiveClass: 'bg-chart-3/10 text-foreground font-medium'
	},
	'chart-4': {
		pillClass: 'bg-chart-4/15 text-foreground hover:bg-chart-4/25',
		optionActiveClass: 'bg-chart-4/10 text-foreground font-medium'
	},
	'chart-5': {
		pillClass: 'bg-chart-5/15 text-foreground hover:bg-chart-5/25',
		optionActiveClass: 'bg-chart-5/10 text-foreground font-medium'
	}
} as const satisfies Record<string, ItemFilterTheme>;

export type FilterThemeName = keyof typeof FILTER_THEMES;
