import { test, expect } from '@playwright/test';

test.describe('MeshMap happy path', () => {
  test('loads, shows wordmark, and presents the shape tab', async ({ page }) => {
    // Deny geolocation so the app falls back to Mumbai
    await page.context().grantPermissions([]);
    await page.goto('/');
    await expect(page.getByText('MeshMap', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Generate mesh/i })).toBeVisible();
  });
});
