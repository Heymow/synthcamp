import { test, expect } from '@playwright/test';

test('skip-to-content link is reachable by keyboard and targets main content', async ({ page }) => {
  await page.goto('/explore/home');

  const skip = page.getByRole('link', { name: /Skip to content/i });
  await expect(skip).toHaveAttribute('href', '#main-content');

  // First Tab focuses the skip link.
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();

  await expect(page.locator('#main-content')).toBeVisible();
});
