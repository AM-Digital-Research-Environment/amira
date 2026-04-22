<script lang="ts">
	import { base } from '$app/paths';

	let year = new Date().getFullYear();
</script>

<footer class="app-footer">
	<a
		href="https://www.africamultiple.uni-bayreuth.de/"
		target="_blank"
		rel="noopener noreferrer"
		class="app-footer-logo"
		aria-label="Africa Multiple Cluster of Excellence"
	>
		<img src="{base}/logos/africamultiple.jpg" alt="Africa Multiple" />
	</a>

	<div class="app-footer-text">
		<span class="app-footer-version">v{__APP_VERSION__}</span>
		<span aria-hidden="true" class="app-footer-sep">·</span>
		<span>
			&copy; {year}
			<a
				href="https://www.frederickmadore.com/"
				target="_blank"
				rel="noopener noreferrer"
				class="app-footer-link"
			>
				Frédérick Madore
			</a>
		</span>
		<span aria-hidden="true" class="app-footer-sep">·</span>
		<a
			href="https://www.africamultiple.uni-bayreuth.de/en/1_5-Digital-Solutions1/index.html"
			target="_blank"
			rel="noopener noreferrer"
			class="app-footer-link"
		>
			Digital Research Environment (DRE)
		</a>
	</div>
</footer>

<style>
	.app-footer {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid hsl(var(--border));
		background: hsl(var(--background) / 0.6);
		color: hsl(var(--muted-foreground));
		font-size: var(--font-size-2xs);
		/* Sits below the scroll-to-top button: the button is `position: fixed`
		   at bottom-right, so when the user scrolls to the end of the page it
		   overlaps the footer instead of the pagination controls above it. */
	}

	@media (min-width: 1024px) {
		.app-footer {
			padding: var(--space-3) var(--space-6);
		}
	}

	.app-footer-logo {
		display: inline-flex;
		flex-shrink: 0;
		opacity: 0.85;
		transition: opacity 160ms ease;
	}
	.app-footer-logo:hover {
		opacity: 1;
	}
	.app-footer-logo img {
		height: 28px;
		width: auto;
		display: block;
		border-radius: calc(var(--radius) - 4px);
	}

	.app-footer-text {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 var(--space-2);
		line-height: var(--line-height-snug);
	}

	.app-footer-sep {
		opacity: 0.5;
	}

	.app-footer-version {
		font-weight: 500;
	}

	.app-footer-link {
		color: inherit;
		text-decoration: none;
		transition: color 160ms ease;
	}
	.app-footer-link:hover {
		color: hsl(var(--primary));
	}

	/* On very narrow phones the separator dots and text wrap — keep the
	   visual cadence tidy by hiding separators when wrapping happens. */
	@media (max-width: 480px) {
		.app-footer {
			gap: var(--space-3);
		}
		.app-footer-sep {
			display: none;
		}
		.app-footer-text {
			flex-direction: column;
			align-items: flex-start;
			gap: 2px;
		}
	}
</style>
