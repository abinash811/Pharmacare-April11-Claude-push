import { test, expect } from '@playwright/test';

// Authenticate before billing tests
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('login-email-input').fill(process.env.E2E_EMAIL || 'admin@pharmacy.com');
  await page.getByTestId('login-password-input').fill(process.env.E2E_PASSWORD || 'admin123');
  await page.getByTestId('login-submit-btn').click();
  await page.waitForURL(/dashboard/);
});

test.describe('Billing', () => {
  test('navigates to billing page', async ({ page }) => {
    await page.goto('/billing');
    await expect(page.getByTestId('billing-page')).toBeVisible();
  });

  test('can open new bill workspace', async ({ page }) => {
    await page.goto('/billing/new');
    await expect(page.getByTestId('back-btn')).toBeVisible();
    await expect(page.getByTestId('finalise-btn')).toBeVisible();
  });

  test('park bill button is visible in new bill', async ({ page }) => {
    await page.goto('/billing/new');
    await expect(page.getByTestId('park-bill-btn')).toBeVisible();
  });

  test('finalise is disabled with no items', async ({ page }) => {
    await page.goto('/billing/new');
    await expect(page.getByTestId('finalise-btn')).toBeDisabled();
  });
});
