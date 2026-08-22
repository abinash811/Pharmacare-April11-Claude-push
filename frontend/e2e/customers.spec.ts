import { test, expect } from '@playwright/test';

// Authenticate before customers tests
test.beforeEach(async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('login-email-input').fill(process.env.E2E_EMAIL || 'admin@pharmacy.com');
  await page.getByTestId('login-password-input').fill(process.env.E2E_PASSWORD || 'admin123');
  await page.getByTestId('login-submit-btn').click();
  await page.waitForURL(/dashboard/, { waitUntil: 'domcontentloaded' });
});

test.describe('Customers', () => {
  test('navigates to customers page', async ({ page }) => {
    await page.goto('/customers', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('customers-page')).toBeVisible();
    await expect(page.getByTestId('add-customer-btn')).toBeVisible();
  });

  test('adding a customer makes it appear in the customers list', async ({ page }) => {
    const customerName = `E2E Test Customer ${Date.now()}`;

    await page.goto('/customers', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('add-customer-btn').click();

    await page.getByTestId('customer-name-input').fill(customerName);
    await page.getByTestId('customer-submit-btn').click();

    // useCustomers.saveCustomer refetches the full list on success (see
    // hooks/useCustomers.js) — no search step needed, unlike Inventory's
    // hasSearched-gated results table.
    await expect(page.getByTestId('customers-table')).toContainText(customerName, { timeout: 10000 });
  });
});
