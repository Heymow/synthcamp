import { test, expect } from '@playwright/test';

test('library shows SignInGate when user is not authenticated', async ({ page }) => {
  await page.goto('/explore/library');

  // URL should stay on the library page (no redirect) so the ModeToggle
  // doesn't bounce back to another section.
  await expect(page).toHaveURL(/\/explore\/library$/);
  await expect(page.getByText(/Sign in to see your library/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Send magic link/i })).toBeVisible();
});
