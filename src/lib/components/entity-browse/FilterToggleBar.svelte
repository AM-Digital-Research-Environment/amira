<script lang="ts">
	import { cn } from '$lib/utils/cn';

	export interface FilterToggleOption {
		value: string;
		label: string;
		/** Optional count rendered as `Label (N)` on `md` size. */
		count?: number;
	}

	interface Props {
		options: FilterToggleOption[];
		/** Currently selected value — one of the option values. */
		value: string;
		/** Called with the new value when the user clicks an option. */
		onChange: (value: string) => void;
		/**
		 * `sm` — compact (text-xs, py-1.5) for sidebar filter groups.
		 * `md` — full (text-sm font-medium, py-2 px-4) for page toolbars.
		 */
		size?: 'sm' | 'md';
		/** Spread each option to fill the row evenly (`flex-1`). */
		fullWidth?: boolean;
		/** Capitalize the rendered label (e.g. for raw lowercase view-mode keys). */
		capitalize?: boolean;
		/** Container classes, merged onto the outer `<div>`. */
		class?: string;
		/** ID of an external element labelling this group. Wraps the bar in a `role="group"`. */
		'aria-labelledby'?: string;
		/** Plain-text label when no labelling element is available. */
		'aria-label'?: string;
	}

	let {
		options,
		value,
		onChange,
		size = 'md',
		fullWidth = false,
		capitalize = false,
		class: className = '',
		'aria-labelledby': ariaLabelledBy,
		'aria-label': ariaLabel
	}: Props = $props();

	const sizeClasses = {
		sm: 'text-xs',
		md: 'text-sm font-medium'
	} as const;

	const buttonPadding = {
		sm: 'px-2 py-1.5',
		md: 'px-4 py-2'
	} as const;
</script>

<div
	role="group"
	aria-labelledby={ariaLabelledBy}
	aria-label={ariaLabelledBy ? undefined : ariaLabel}
	class={cn(
		'flex rounded-lg border border-input overflow-hidden',
		sizeClasses[size],
		!fullWidth && 'w-fit',
		className
	)}
>
	{#each options as opt (opt.value)}
		<button
			type="button"
			onclick={() => onChange(opt.value)}
			aria-pressed={value === opt.value}
			class={cn(
				'transition-colors',
				buttonPadding[size],
				fullWidth && 'flex-1',
				capitalize && 'capitalize',
				value === opt.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
			)}
		>
			{opt.label}{#if opt.count !== undefined && size === 'md'}
				&nbsp;({opt.count}){/if}
		</button>
	{/each}
</div>
