import { test, expect } from '@playwright/test';
import { requireBaseURL, appUrl, CASE_VARIANTS, waitForData } from './helpers';

/**
 * (3) Case-insensitive search by name/address filters the list.
 * Uses real dataset terms (e.g. NAME fragment "lakeside").
 * Status: BLOCKED pending publish.
 */
test('case-insensitive search filters by name/address', async ({ page }) => {
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });

  const search = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));
  const searchBox = search.first();
  await expect(searchBox).toBeVisible({ timeout: 20000 });
  await waitForData(page);

  const counts: number[] = [];
  const searchBtn = page.getByRole('button', { name: /^search$/i });
  for (const variant of CASE_VARIANTS) {
    await searchBox.fill('');
    await searchBox.fill(variant);
    // Explicit Search-button trigger: deterministic across browsers and
    // assistive tech (verified live: button click always runs OnSearch with
    // the committed input value; implicit change-on-blur proved flaky).
    await searchBtn.click();
    // Deterministic wait: list must reflect the query (O11 renders rows as
    // <div>s, so fall back to NAME-text hits when no listitem role exists).
    const visibleRows = page.getByRole('listitem');
    const textHits = page.getByText(/lakeside/i);
    await expect
      .poll(
        async () => (await visibleRows.count()) + (await textHits.count()),
        { timeout: 10000 },
      )
      .toBeGreaterThan(0);
    const n =
      (await visibleRows.count()) > 0
        ? await visibleRows.count()
        : await textHits.count();
    counts.push(n);
    expect(n, `search variant "${variant}" should yield results`).toBeGreaterThan(0);
  }

  // All case variants should return the same non-zero count.
  expect(new Set(counts).size).toBe(1);
});

test('search works for a second independent term', async ({ page }) => {
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });

  const search = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));
  const searchBox = search.first();
  await expect(searchBox).toBeVisible({ timeout: 20000 });
  await waitForData(page);

  // Independent term so coverage does not hinge solely on "lakeside".
  const searchBtn = page.getByRole('button', { name: /^search$/i });
  for (const term of ['tampines', 'TAMPINES']) {
    await searchBox.fill('');
    await searchBox.fill(term);
    await searchBtn.click();
    await expect
      .poll(async () => page.getByText(/tampines/i).count(), { timeout: 10000 })
      .toBeGreaterThan(0);
  }
});
