/**
 * @deprecated Re-export shim for the legacy `$lib/utils/helpers` import path.
 *
 * Import from `$lib/utils/formatters` (data → display) or `$lib/utils/theme`
 * (section colours) directly instead. This shim will be removed in a future
 * refactoring phase.
 */

export { formatDate, getItemTitle, getProjectTitle } from './formatters';
export { getSectionColor, getSectionColorHsl, getSectionColorResolved } from './theme';
