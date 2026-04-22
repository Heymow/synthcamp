import { test, expect } from '@playwright/test';

test('login page renders with magic link + Google buttons', async ({ page }) => {
  await page.goto('/auth/login');

  await expect(page.getByPlaceholder('ton@email.com')).toBeVisible();
  await expect(page.getByRole('button', { name: /Recevoir le lien magique/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Continuer avec Google/i })).toBeVisible();
});
