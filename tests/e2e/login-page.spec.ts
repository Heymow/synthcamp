import { test, expect } from '@playwright/test';

test('login page renders with magic link + Google buttons', async ({ page }) => {
  await page.goto('/auth/login');

  await expect(page.getByPlaceholder('your@email.com')).toBeVisible();
  await expect(page.getByRole('button', { name: /Send magic link/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
});
