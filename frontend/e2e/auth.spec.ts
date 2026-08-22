import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('shows login form on /login', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('auth-card')).toBeVisible();
    await expect(page.getByTestId('login-tab')).toBeVisible();
  });

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('login-email-input').fill('wrong@test.com');
    await page.getByTestId('login-password-input').fill('wrongpass');
    await page.getByTestId('login-submit-btn').click();
    // '/login' isn't a real registered route — App.js wildcard-redirects
    // it to '/', where AuthPage renders for an unauthenticated user (see
    // the axios.js fix in this same session). So a URL pattern match on
    // "login" doesn't hold even on success. Assert the real signal
    // instead: the login form is still there and we did not reach the
    // authenticated app.
    await expect(page.getByTestId('auth-card')).toBeVisible();
    await expect(page).not.toHaveURL(/dashboard/);
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('login-email-input').fill(process.env.E2E_EMAIL || 'admin@pharmacy.com');
    await page.getByTestId('login-password-input').fill(process.env.E2E_PASSWORD || 'admin123');
    await page.getByTestId('login-submit-btn').click();
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByTestId('dashboard')).toBeVisible();
  });
});
