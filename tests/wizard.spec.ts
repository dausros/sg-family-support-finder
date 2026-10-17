import { test, expect, Page } from '@playwright/test';
import { requireBaseURL, screenUrl, waitForSupportData } from './helpers';

const SUPPORT_URL = () =>
  screenUrl(process.env.APP_BASE_URL as string, 'FindSupport');

async function gotoSupport(page: Page) {
  await page.goto(SUPPORT_URL(), { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('button', { name: /financial difficulties/i }),
  ).toBeVisible({ timeout: 60000 });
}

async function toStep2(page: Page, need: RegExp = /family or relationship/i) {
  await page.getByRole('button', { name: need }).click();
  await page.getByRole('button', { name: /^continue$/i }).click();
  await expect(
    page.getByText(/household situation|monthly household income/i).first(),
  ).toBeVisible({ timeout: 30000 });
}

test('selecting a need does not navigate automatically', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  await page.getByRole('button', { name: /family or relationship/i }).click();
  // Still on step 1: Continue is visible, household inputs are not.
  await expect(page.getByRole('button', { name: /^continue$/i })).toBeVisible();
  await expect(page.getByText(/selected: family/i)).toBeVisible();
  await expect(page.getByText(/monthly household income/i)).toHaveCount(0);
});

test('Continue advances, Back preserves the selection', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  await page.getByRole('button', { name: /^parenting support$/i }).click();
  await page.getByRole('button', { name: /^continue$/i }).click();
  await expect(
    page.getByText(/household situation|monthly household income/i).first(),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: /^back$/i }).first().click();
  // Back on step 1: need options visible again, selection retained.
  await expect(
    page.getByRole('button', { name: /financial difficulties/i }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/selected: parenting support/i)).toBeVisible();
});

test('household option selects without submitting', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  await toStep2(page);
  const single = page.getByRole('button', { name: /^single adult$/i });
  await single.click();
  // No navigation: still on step 2, choice marked pressed, View results available.
  await expect(single).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: /view results/i }),
  ).toBeVisible();
});

test('non-numeric income is treated as unspecified', async ({ page }) => {
  // Free text is treated as "not stated" (general results, no income notes);
  // only negative numbers block.
  requireBaseURL();
  await gotoSupport(page);
  await toStep2(page);
  await page.getByPlaceholder(/3000|household income/i).fill('abc');
  await page.getByRole('button', { name: /view results/i }).click();
  await waitForSupportData(page);
  await expect(
    page.getByText(/potentially relevant support|your assistance recommendations/i).first(),
  ).toBeVisible({ timeout: 60000 });
});

test('negative income blocks progress with a message', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  await toStep2(page);
  await page.getByPlaceholder(/3000|household income/i).fill('-500');
  await page.getByRole('button', { name: /view results/i }).click();
  await expect(page.getByText(/cannot be negative/i).first()).toBeVisible({
    timeout: 15000,
  });
  // Still on step 2, not on results.
  await expect(page.getByRole('button', { name: /view results/i })).toBeVisible();
});

test('optional inputs can be left blank', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  await toStep2(page);
  await page.getByRole('button', { name: /view results/i }).click();
  await waitForSupportData(page);
  await expect(
    page.getByText(/potentially relevant support|your assistance recommendations/i).first(),
  ).toBeVisible({ timeout: 60000 });
});
