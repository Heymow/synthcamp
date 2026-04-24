import { test, expect } from '@playwright/test';

/**
 * Smoke test: signup form on /auth/login submits the magic-link request
 * successfully. We intercept the Supabase /auth/v1/otp call so the test
 * doesn't hit GoTrue for real.
 */
test('signup: magic link submission surfaces Check-inbox state', async ({ page }) => {
  await page.route('**/auth/v1/otp*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: null, session: null }),
    });
  });

  await page.goto('/auth/login');

  const email = page.getByPlaceholder('your@email.com');
  await expect(email).toBeVisible();
  await email.fill('smoke-test@example.com');

  await page.getByRole('button', { name: /Send magic link/i }).click();

  // Button copy flips to the "sent" state and the confirmation paragraph
  // renders beneath the form.
  await expect(page.getByRole('button', { name: /Email sent/i })).toBeVisible();
  await expect(page.getByText(/Check your inbox/i)).toBeVisible();
});
