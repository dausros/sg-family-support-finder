import { test, expect, Page } from '@playwright/test';
import { requireBaseURL, screenUrl, waitForData } from './helpers';

// ComCare Hotline is 1800 222 0000 (MSF, https://www.msf.gov.sg/contact-us-feedback).
// The app showed 1800 777 0000 for SSO help before 18 Oct 2026. These tests
// pin the correct number on both public screens.

const OLD = /1800[\s\u00a0-]?777[\s\u00a0-]?0000/;

test('Browse: "Help now" calls 1800 222 0000 and the old number is gone', async ({ page }) => {
  const base = requireBaseURL();
  await page.goto(screenUrl(base, 'FindCentres'), { waitUntil: 'domcontentloaded' });
  await waitForData(page);
  const help = page.locator('a[href^="tel:"]').filter({ hasText: /help now/i }).first();
  await expect(help).toHaveAttribute('href', 'tel:18002220000');
  await expect(help).toContainText(/1800[\s\u00a0]222[\s\u00a0]0000/);
  expect(await page.locator('body').innerText()).not.toMatch(OLD);
});

async function moneyResults(page: Page, base: string) {
  await page.goto(screenUrl(base, 'FindSupport'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /help with money/i })).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: /help with money/i }).click();
  await page.locator('.sgsf-continue').click();
  await expect(page.getByText(/question 1 of 7/i)).toBeVisible({ timeout: 30000 });
  // All household questions are optional: go straight through to the results.
  for (let n = 1; n < 7; n++) {
    await page.locator('.btn-primary:visible').last().click();
    await expect(page.getByText(new RegExp(`question ${n + 1} of 7`, 'i'))).toBeVisible();
  }
  await page.getByRole('button', { name: /view results/i }).click();
  await expect(page.locator('.sgsf-rec-card').first()).toBeVisible({ timeout: 60000 });
}

test('Find Support (money): ComCare cards call 1800 222 0000, never 1800 777 0000', async ({ page }) => {
  test.setTimeout(150000);
  const base = requireBaseURL();
  await moneyResults(page, base);
  await expect(page.getByText(/call comcare 1800[\s\u00a0]222[\s\u00a0]0000/i).first()).toBeVisible();
  const comcare = page.locator('a[href="tel:18002220000"]');
  expect(await comcare.count()).toBeGreaterThanOrEqual(3);
  const hrefs = await page.locator('a[href^="tel:"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
  expect(hrefs.join(' ')).not.toMatch(/18007770000/);
  expect(await page.locator('body').innerText()).not.toMatch(OLD);
});
