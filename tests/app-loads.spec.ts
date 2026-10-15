import { test, expect } from '@playwright/test';
import { requireBaseURL, appUrl } from './helpers';

/**
 * (1) App loads — smoke test.
 * Status: BLOCKED pending publish. Do not fabricate a pass.
 */
test('app loads and shows search input', async ({ page }) => {
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });

  // Generic, implementation-agnostic assertions — adjust selectors after first publish.
  const search = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));
  await expect(search.first()).toBeVisible({ timeout: 20000 });
  // Title is set by the O11 client after boot; assert after widgets render.
  await expect(page).toHaveTitle(/Family|Support|Finder|OutSystems/i, {
    timeout: 20000,
  });
  await expect(
    page.getByRole('button', { name: /^search$/i }),
  ).toBeVisible();
});

test('loading indicator resolves to a usable page', async ({ page }) => {
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });

  // If a loading indicator renders, it must disappear once data arrives.
  // (Fast loads may never show it — hence the conditional, no fixed sleep.)
  const loading = page.getByText(/loading|searching|please wait/i).first();
  if (await loading.isVisible().catch(() => false)) {
    await expect(loading).toBeHidden({ timeout: 20000 });
  }

  // Page must end in a usable state regardless.
  const search = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));
  await expect(search.first()).toBeVisible({ timeout: 20000 });
});
