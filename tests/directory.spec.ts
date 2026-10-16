import { test, expect, Page } from '@playwright/test';
import { requireBaseURL, appUrl, waitForData } from './helpers';

async function gotoDirectory(page: Page) {
  await page.goto(appUrl(requireBaseURL()), { waitUntil: 'domcontentloaded' });
  await waitForData(page);
}

async function countLabel(page: Page): Promise<string> {
  const label = page.getByText(/showing|centres found/i).first();
  await expect(label).toBeVisible({ timeout: 30000 });
  return ((await label.textContent()) ?? '').replace(/\s+/g, ' ').trim();
}

test('combined directory serves all three service types', async ({ page }) => {
  await gotoDirectory(page);
  const label = await countLabel(page);
  expect(label).toMatch(/of 94 found/);
  // Type filter narrows to each dataset with correct badges.
  await page.getByRole('button', { name: /^sso$/i }).click();
  await expect(page.getByText(/of 24 found/i).first()).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByText(/^sso$/i).first()).toBeVisible();
  await page.getByRole('button', { name: /^sfp$/i }).click();
  await expect(page.getByText(/of 15 found/i).first()).toBeVisible({
    timeout: 60000,
  });
  await page.getByRole('button', { name: /^all$/i }).click();
  await expect(page.getByText(/of 94 found/i).first()).toBeVisible({
    timeout: 60000,
  });
});

test('search combines with the type filter', async ({ page }) => {
  await gotoDirectory(page);
  await page.getByRole('button', { name: /^fsc$/i }).click();
  await expect(page.getByText(/of 55 found/i).first()).toBeVisible({
    timeout: 60000,
  });
  const search = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));
  await search.first().fill('jurong');
  await page.getByRole('button', { name: /^search$/i }).click();
  const label = await countLabel(page);
  expect(label).toMatch(/of [1-9]\d* found/);
  expect(label).not.toMatch(/of 94 found/);
});

test('pagination pages through results and resets on filter change', async ({
  page,
}) => {
  await gotoDirectory(page);
  await expect(page.getByText(/showing 1–10 of 94 found/i).first()).toBeVisible({
    timeout: 60000,
  });
  await page.getByRole('button', { name: /^next$/i }).click();
  await expect(page.getByText(/showing 11–20 of 94 found/i).first()).toBeVisible({
    timeout: 60000,
  });
  // Changing the filter resets to page 1.
  await page.getByRole('button', { name: /^sso$/i }).click();
  await expect(page.getByText(/showing 1–10 of 24 found/i).first()).toBeVisible({
    timeout: 60000,
  });
});

test('sort order reverses the listing', async ({ page }) => {
  await gotoDirectory(page);
  // Card containers carry the theme's card hook; the intro paragraph shares
  // similar words, so scope strictly to rendered cards.
  const cards = page.locator('.sgsf-card');
  await expect(cards.first()).toBeVisible({ timeout: 60000 });
  const firstAsc = await cards.first().textContent();
  await page.getByRole('button', { name: /name z-a/i }).click();
  await expect(page.getByText(/sort: name z-a/i).first()).toBeVisible({
    timeout: 60000,
  });
  const firstDesc = await cards.first().textContent();
  expect(firstDesc).not.toBe(firstAsc);
});
