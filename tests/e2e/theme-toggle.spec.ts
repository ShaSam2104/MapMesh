import { test, expect } from '@playwright/test';

test('theme toggle flips the html class', async ({ page }) => {
  await page.goto('/');
  const htmlDarkInitial = await page.evaluate(() =>
    document.documentElement.classList.contains('dark'),
  );
  await page.getByRole('button', { name: /Switch to (light|dark) theme/i }).click();
  const htmlDarkAfter = await page.evaluate(() =>
    document.documentElement.classList.contains('dark'),
  );
  expect(htmlDarkAfter).not.toBe(htmlDarkInitial);
});
