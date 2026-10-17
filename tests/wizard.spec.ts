import { test, expect, Page } from '@playwright/test';
import { requireBaseURL, screenUrl, waitForSupportData } from './helpers';

// Wizard v2 behaviour: explicit Next, one question per screen, optional answers.
const SUPPORT_URL = () => screenUrl(process.env.APP_BASE_URL as string, 'FindSupport');

async function gotoSupport(page: Page) {
  await page.goto(SUPPORT_URL(), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /help with money/i })).toBeVisible({ timeout: 60000 });
}

test('selecting a need does not navigate automatically', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  await page.getByRole('button', { name: /family or relationship/i }).click();
  await expect(page.getByText(/step 1 of 3/i)).toBeVisible();
  await expect(page.locator('.sgsf-continue')).toBeVisible();
  await expect(page.getByText(/question 1 of 5/i)).toHaveCount(0);
});

test('Next advances, Back returns to step 1 with the selection kept', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  await page.getByRole('button', { name: /parenting support/i }).click();
  await page.locator('.sgsf-continue').click();
  await expect(page.getByText(/question 1 of 5/i)).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: /^back$/i }).first().click();
  await expect(page.getByRole('button', { name: /parenting support/i })).toHaveAttribute('aria-pressed', 'true', { timeout: 30000 });
});

test('household option selects without submitting', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  await page.getByRole('button', { name: /family or relationship/i }).click();
  await page.locator('.sgsf-continue').click();
  for (let i = 0; i < 2; i++) await page.locator('.btn-primary:visible').last().click();
  await expect(page.getByText(/question 3 of 5/i)).toBeVisible();
  const single = page.getByRole('button', { name: /^single adult$/i });
  await single.click();
  await expect(single).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/question 3 of 5/i)).toBeVisible();
});

test('optional answers can all be skipped', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  await page.getByRole('button', { name: /family or relationship/i }).click();
  await page.locator('.sgsf-continue').click();
  await page.getByRole('button', { name: /skip the rest/i }).click();
  await expect(page.locator('.sgsf-rec-card').first()).toBeVisible({ timeout: 60000 });
  await waitForSupportData(page);
});
