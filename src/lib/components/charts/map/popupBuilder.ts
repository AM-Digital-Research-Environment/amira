/**
 * Popup HTML generation for map markers.
 *
 * MapLibre GL requires raw HTML strings for popups, so these remain
 * as pure functions returning HTML rather than Svelte components.
 */

import { researchItemUrl } from '$lib/utils/urls';
import type { MarkerData } from './markerBuilder';
import { getMarkerColor, ITEMS_PER_PAGE } from './mapHelpers';

/**
 * Build the full popup HTML for a marker at a given pagination page.
 */
export function buildPopupHtml(
	markerData: MarkerData,
	page: number,
	itemsPerPage: number = ITEMS_PER_PAGE
): string {
	const color = getMarkerColor(markerData.type);
	const totalItems = markerData.items.length;
	const totalPages = Math.ceil(totalItems / itemsPerPage);
	const startIdx = page * itemsPerPage;
	const endIdx = Math.min(startIdx + itemsPerPage, totalItems);
	const pageItems = markerData.items.slice(startIdx, endIdx);

	const itemsHtml = pageItems.length > 0
		? `<ul class="popup-items-list">
			${pageItems.map(item =>
				`<li class="popup-item">
					<a href="${researchItemUrl(item.id)}" class="popup-item-link">${item.title.length > 45 ? item.title.substring(0, 45) + '...' : item.title}</a>
					<span class="popup-item-type">(${item.type})</span>
				</li>`
			).join('')}
		</ul>`
		: '<p class="popup-no-items">No documents found</p>';

	const paginationHtml = totalPages > 1
		? `<div class="popup-pagination">
			<button class="popup-page-btn" data-marker-id="${markerData.id}" data-page="${page - 1}" ${page === 0 ? 'disabled' : ''}>
				&larr; Prev
			</button>
			<span class="popup-page-info">${page + 1} / ${totalPages}</span>
			<button class="popup-page-btn" data-marker-id="${markerData.id}" data-page="${page + 1}" ${page >= totalPages - 1 ? 'disabled' : ''}>
				Next &rarr;
			</button>
		</div>`
		: '';

	return `
		<div class="popup-container" data-marker-id="${markerData.id}">
			<div class="popup-header">
				<h3 class="popup-title">${markerData.name}</h3>
				<div class="popup-meta">
					<span class="popup-type-badge" style="background-color: ${color};">
						${markerData.type}
					</span>
					<span class="popup-count">
						<strong>${markerData.count}</strong> item${markerData.count !== 1 ? 's' : ''}
					</span>
				</div>
			</div>
			<div class="popup-content" id="popup-content-${markerData.id}">
				${itemsHtml}
			</div>
			${paginationHtml}
		</div>
		${popupStyles()}
	`;
}

/**
 * Return the popup HTML for a specific page (used by pagination handlers).
 * This is an alias that delegates to buildPopupHtml for clarity at call sites.
 */
export function getPopupPage(
	markerData: MarkerData,
	page: number,
	itemsPerPage: number = ITEMS_PER_PAGE
): string {
	return buildPopupHtml(markerData, page, itemsPerPage);
}

// ---------------------------------------------------------------------------
// Scoped popup styles (injected as inline <style> inside the popup)
// ---------------------------------------------------------------------------

function popupStyles(): string {
	return `<style>
		.popup-container {
			padding: 4px;
			min-width: 260px;
			max-width: 320px;
		}
		.popup-header {
			margin-bottom: 12px;
		}
		.popup-title {
			font-size: 16px;
			font-weight: 600;
			margin: 0 0 8px 0;
			color: hsl(var(--popover-foreground));
		}
		.popup-meta {
			display: flex;
			align-items: center;
			gap: 12px;
		}
		.popup-type-badge {
			color: hsl(var(--background));
			padding: 2px 8px;
			border-radius: 4px;
			font-size: 11px;
			font-weight: 500;
			text-transform: capitalize;
		}
		.popup-count {
			font-size: 13px;
			color: hsl(var(--muted-foreground));
		}
		.popup-content {
			border-top: 1px solid hsl(var(--border));
			padding-top: 8px;
		}
		.popup-items-list {
			margin: 0;
			padding: 0 0 0 16px;
			max-height: 180px;
			overflow-y: auto;
		}
		.popup-item {
			margin-bottom: 6px;
			line-height: 1.4;
		}
		.popup-item-link {
			font-size: 12px;
			color: hsl(var(--popover-foreground));
			text-decoration: none;
			transition: color 0.15s;
		}
		.popup-item-link:hover {
			color: hsl(var(--primary));
		}
		.popup-item-type {
			font-size: 10px;
			color: hsl(var(--muted-foreground));
			margin-left: 4px;
		}
		.popup-no-items {
			font-size: 12px;
			color: hsl(var(--muted-foreground));
			margin: 8px 0;
		}
		.popup-pagination {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-top: 12px;
			padding-top: 8px;
			border-top: 1px solid hsl(var(--border));
		}
		.popup-page-btn {
			background: hsl(var(--secondary));
			color: hsl(var(--secondary-foreground));
			border: none;
			padding: 4px 10px;
			border-radius: 4px;
			font-size: 11px;
			cursor: pointer;
			transition: background 0.2s;
		}
		.popup-page-btn:hover:not(:disabled) {
			background: hsl(var(--accent));
		}
		.popup-page-btn:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
		.popup-page-info {
			font-size: 11px;
			color: hsl(var(--muted-foreground));
		}
	</style>`;
}
