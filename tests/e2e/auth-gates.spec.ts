import { test, expect } from '@playwright/test';

/**
 * Smoke test: unauthenticated visitors hitting protected artist/settings
 * pages see the SignInGate (rendered inline) instead of the real page.
 * Each gated page uses a distinct subheading which lets us assert the
 * right gate appears on each route.
 */

test('unauthenticated /artist/upload shows the upload sign-in gate', async ({ page }) => {
  await page.goto('/artist/upload');
  await expect(page.getByText('Sign in to upload a release')).toBeVisible();
  await expect(page.getByPlaceholder('your@email.com')).toBeVisible();
});

test('unauthenticated /settings/profile shows the profile sign-in gate', async ({ page }) => {
  await page.goto('/settings/profile');
  await expect(page.getByText('Sign in to edit your profile')).toBeVisible();
  await expect(page.getByPlaceholder('your@email.com')).toBeVisible();
});
