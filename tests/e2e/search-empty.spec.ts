import { test, expect } from '@playwright/test';

test('search page shows an empty prompt when no query is entered', async ({ page }) => {
  await page.goto('/explore/search');

  await expect(page.getByRole('heading', { name: /Search/i })).toBeVisible();
  await expect(page.getByPlaceholder(/Search artists, releases/i)).toBeVisible();
  await expect(page.getByText(/Start typing to search/i)).toBeVisible();
});

test('search with no-result query shows the empty state', async ({ page }) => {
  await page.goto('/explore/search?q=zzznotarealquery123');

  await expect(page.getByText(/No results for/i)).toBeVisible();
});
