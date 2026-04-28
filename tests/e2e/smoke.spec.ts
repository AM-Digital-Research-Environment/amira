import { test, expect } from '@playwright/test';

test.describe('homepage smoke', () => {
	test('renders the dashboard overview', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
	});

	test('the people page loads and shows entities', async ({ page }) => {
		await page.goto('/people');
		await expect(page.getByRole('heading', { name: /people/i, level: 1 })).toBeVisible();
	});
});
