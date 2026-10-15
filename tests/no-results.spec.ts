import { test, expect } from '@playwright/test';
import { requireBaseURL, appUrl, waitForData } from './helpers';

/**
 * (4) No-results (empty) state.
 * Status: BLOCKED pending publish.
 */
test('no-results state for gibberish query', async ({ page }) => {
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });

  const search = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));
  const searchBox = search.first();
  await expect(searchBox).toBeVisible({ timeout: 20000 });
  await waitForData(page);

  await searchBox.fill('');
  await searchBox.fill('zzz-no-such-centre-999');
  await page.getByRole('button', { name: /^search$/i }).click();

  // The empty-state assertion below carries its own timeout, which covers
  // debounce / server round-trip — no fixed sleep needed.
  const emptyState = page
    .getByText(/no results|no centres|nothing found|not found/i)
    .first();
  await expect(emptyState).toBeVisible({ timeout: 10000 });
});
