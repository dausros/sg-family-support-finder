import { test, expect, Page } from '@playwright/test';

// F2: postal code -> 3 nearest Family Service Centres (OneMap + stored centre coordinates).
async function toResults(page: Page) {
  await page.goto('FindSupport', { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('button', { name: /help with money/i }).click();
  await page.locator('.sgsf-continue').click();
  await page.getByRole('button', { name: /skip the rest/i }).click();
  await expect(page.locator('.sgsf-rec-card').first()).toBeVisible({ timeout: 120000 });
}

test('nearest centres: friendly messages for bad and unknown postal codes', async ({ page }) => {
  await toResults(page);
  const input = page.getByLabel('Your postal code');
  await input.fill('12');
  await page.getByRole('button', { name: /find centres/i }).click();
  await expect(page.locator('.sgsf-nearest-error')).toContainText('6-digit postal code');
  await input.fill('999999');
  await page.getByRole('button', { name: /find centres/i }).click();
  await expect(page.locator('.sgsf-nearest-error')).toContainText('could not find postal code 999999', { timeout: 60000 });
});

test('nearest centres: 3 closest, sorted by distance, with call and directions', async ({ page }) => {
  await toResults(page);
  await page.getByLabel('Your postal code').fill('560211');
  await page.getByRole('button', { name: /find centres/i }).click();
  const cards = page.locator('.sgsf-nearest-card');
  await expect(cards).toHaveCount(3, { timeout: 120000 });
  await expect(page.locator('.sgsf-nearest-to')).toContainText('560211');
  const km = (await page.locator('.sgsf-nearest-dist').allInnerTexts()).map((t) => parseFloat(t));
  expect(km[0]).toBeLessThan(2); // Ang Mo Kio has FSCs within 2 km
  expect(km).toEqual([...km].sort((a, b) => a - b));
  await expect(cards.first()).toContainText(/Ang Mo Kio/i);
  await expect(cards.first().locator('a[href^="tel:"]')).toHaveCount(1);
  await expect(cards.first().locator('a[href*="google.com/maps/dir"]')).toHaveAttribute('target', '_blank');
});
