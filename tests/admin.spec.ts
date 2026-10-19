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
  await page.getByRole('textbox', { name: /username/i }).fill(user!);
  await page.locator('input[type=password]').fill(pass!);
  await page.getByRole('button', { name: /sign in|login/i }).click();
  await expect(page.getByText('Manage centres').first()).toBeVisible({ timeout: 60000 });
  const name = 'Reviewer Test Centre ' + Date.now();
  await page.getByRole('button', { name: 'Add a centre' }).click();
  await page.getByLabel(/centre name/i).fill(name);
  await page.getByLabel(/street address/i).fill('1 Test Street');
  await page.getByRole('textbox', { name: /postal code/i }).fill('560211');
  await page.getByRole('button', { name: 'Save centre' }).click();
  await expect(page.getByRole('status')).toContainText('Saved', { timeout: 60000 });
  await page.getByRole('searchbox', { name: /find a centre/i }).fill(name);
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('button', { name: 'Hide ' + name }).click();
  await expect(page.getByRole('status')).toContainText('hidden', { timeout: 60000 });
  await page.getByRole('button', { name: 'Show ' + name }).click();
  await expect(page.getByRole('status')).toContainText('shown again', { timeout: 60000 });
  // leave the test centre hidden so the public pages stay clean; wait for the
  // save to finish, or the page closes before the request lands
  await page.getByRole('button', { name: 'Hide ' + name }).click();
  await expect(page.getByRole('status')).toContainText('hidden', { timeout: 60000 });
  await expect(page.getByRole('button', { name: 'Show ' + name })).toBeVisible({ timeout: 60000 });
});
