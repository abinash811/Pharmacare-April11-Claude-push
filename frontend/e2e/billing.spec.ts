import { test, expect } from '@playwright/test';

// Authenticate before billing tests
test.beforeEach(async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('login-email-input').fill(process.env.E2E_EMAIL || 'admin@pharmacy.com');
  await page.getByTestId('login-password-input').fill(process.env.E2E_PASSWORD || 'admin123');
  await page.getByTestId('login-submit-btn').click();
  await page.waitForURL(/dashboard/, { waitUntil: 'domcontentloaded' });
});

test.describe('Billing', () => {
  test('navigates to billing page', async ({ page }) => {
    await page.goto('/billing', { waitUntil: 'domcontentloaded' });
    // Real testid on the page is 'billing-operations-page'
    // (pages/BillingOperations.js) — 'billing-page' never existed.
    await expect(page.getByTestId('billing-operations-page')).toBeVisible();
  });

  test('can open new bill workspace', async ({ page }) => {
    await page.goto('/billing/new', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('back-btn')).toBeVisible();
    await expect(page.getByTestId('finalise-btn')).toBeVisible();
  });

  test('park bill button is visible in new bill', async ({ page }) => {
    await page.goto('/billing/new', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('park-bill-btn')).toBeVisible();
  });

  test('finalising with no items shows an error and does not proceed', async ({ page }) => {
    // The Finalise button itself isn't disabled for an empty bill (verified
    // in BillingWorkspace/index.jsx: it's only disabled while isSaving) —
    // clicking it with zero items is guarded client-side instead, with a
    // toast explaining why (matches CLAUDE.md's "every error must say why"
    // rule). This test asserts that real behavior, not a `disabled` state
    // that was never actually implemented.
    await page.goto('/billing/new', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('finalise-btn')).toBeEnabled();
    await page.getByTestId('finalise-btn').click();
    await expect(page.getByText('Add items to bill first')).toBeVisible();
    // Still on the same page — the click didn't finalise or navigate away.
    await expect(page).toHaveURL(/billing\/new/);
  });
});
