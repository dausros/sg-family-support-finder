import { test, expect } from '@playwright/test';

// F4: Centre admin screen. Locked to the CentreAdmin role (screen role + server-side
// CheckCentreAdminRole in CS Centre_CreateOrUpdate / Centre_SetActive).
test('admin screen is not reachable without logging in', async ({ page }) => {
  await page.goto('CentreAdmin', { waitUntil: 'networkidle', timeout: 120000 });
  await expect(page).toHaveURL(/\/Login/i, { timeout: 60000 });
  await expect(page.getByText(/manage centres/i)).toHaveCount(0);
});

// Logged-in flow runs only when a CentreAdmin test user is supplied.
const user = process.env.SGFSF_ADMIN_USER;
const pass = process.env.SGFSF_ADMIN_PASS;
test('admin can add, edit, hide and show a centre', async ({ page }) => {
  test.skip(!user || !pass, 'set SGFSF_ADMIN_USER / SGFSF_ADMIN_PASS for a CentreAdmin user');
  await page.goto('CentreAdmin', { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByLabel(/username/i).fill(user!);
  await page.getByLabel(/password/i).fill(pass!);
  await page.getByRole('button', { name: /login/i }).click();
  await expect(page.getByText('Manage centres').first()).toBeVisible({ timeout: 60000 });
  const name = 'Tab Test Centre ' + Date.now();
  await page.getByRole('button', { name: 'Add a centre' }).click();
  await page.getByLabel(/centre name/i).fill(name);
  await page.getByLabel(/street address/i).fill('1 Test Street');
  await page.getByLabel(/postal code/i).fill('560211');
  await page.getByRole('button', { name: 'Save centre' }).click();
  await expect(page.getByRole('status')).toContainText('Saved', { timeout: 60000 });
  await page.getByLabel(/find a centre/i).fill(name);
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('button', { name: 'Hide ' + name }).click();
  await expect(page.getByRole('status')).toContainText('hidden', { timeout: 60000 });
  await page.getByRole('button', { name: 'Show ' + name }).click();
  await expect(page.getByRole('status')).toContainText('shown again', { timeout: 60000 });
  // leave the test centre hidden so the public pages stay clean
  await page.getByRole('button', { name: 'Hide ' + name }).click();
});
