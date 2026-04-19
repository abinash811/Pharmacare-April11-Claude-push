import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('shows login form on /login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('auth-card')).toBeVisible();
    await expect(page.getByTestId('login-tab')).toBeVisible();
  });

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill('wrong@test.com');
    await page.getByTestId('login-password-input').fill('wrongpass');
    await page.getByTestId('login-submit-btn').click();
    // Should stay on login page — not redirect
    await expect(page).toHaveURL(/login/);
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill(process.env.E2E_EMAIL || 'admin@pharmacy.com');
    await page.getByTestId('login-password-input').fill(process.env.E2E_PASSWORD || 'admin123');
    await page.getByTestId('login-submit-btn').click();
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByTestId('dashboard')).toBeVisible();
  });
});
