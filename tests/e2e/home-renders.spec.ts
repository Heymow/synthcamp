import { test, expect } from '@playwright/test';

test('home page shows New Releases + Active Sound Rooms section headers', async ({ page }) => {
  await page.goto('/explore/home');

  // These headers render regardless of data (sections may show empty state)
  await expect(page.getByText(/New Releases/i)).toBeVisible();
  await expect(page.getByText(/Active Sound Rooms/i)).toBeVisible();
});
