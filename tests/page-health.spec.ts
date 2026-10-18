import { test, expect, Page } from '@playwright/test';
import { requireBaseURL, screenUrl, waitForData } from './helpers';

/**
 * Page health on the public screens: no uncaught script errors, every
 * stylesheet and script the app asks for actually loads, and Browse shows
 * results within a time budget on a phone-sized viewport.
 */

const SCREENS = ['FindCentres', 'FindSupport'];

function watch(page: Page, appRoot: string) {
  const pageErrors: string[] = [];
  const failed: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 200)));
  page.on('response', (r) => {
    if (r.url().startsWith(appRoot) && r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    if (r.url().startsWith(appRoot)) failed.push(`${r.failure()?.errorText} ${r.url()}`);
  });
  return { pageErrors, failed };
}

function appRootOf(base: string) {
  const u = new URL(base);
  return `${u.origin}/${u.pathname.split('/').filter(Boolean)[0]}/`;
}

test('public screens raise no uncaught script errors', async ({ page }) => {
  test.setTimeout(150000);
  const base = requireBaseURL();
  const seen = watch(page, appRootOf(base));
  await page.goto(screenUrl(base, 'FindCentres'), { waitUntil: 'domcontentloaded' });
  await waitForData(page);
  await page.getByText(/^view details$/i).first().click();
  await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 15000 });
  await page.keyboard.press('Escape');
  await page.goto(screenUrl(base, 'FindSupport'), { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /help with money/i }).click({ timeout: 60000 });
  await page.getByRole('button', { name: /^next$/i }).first().click();
  await page.getByRole('button', { name: /skip the rest/i }).first().click();
  await expect(page.getByText(/step 3 of 3/i).first()).toBeVisible({ timeout: 30000 });
  expect(seen.pageErrors, 'uncaught script errors').toEqual([]);
});

// Known defect D-CSS-01 (found 18 Oct 2026): every screen lists
// css/SGFamilySupportFinder.SGFamilySupportTheme.extra.css as a dependency,
// and the server answers it with a 404 HTML page, so the browser logs a
// "Refused to apply style" error on every screen. The visible theme comes
// from SGFamilySupportTheme.css, which loads. Tracked with test.fail until
// the UI module is republished with the fix (docs/UX_REVIEW.md); when this
// test starts passing, remove test.fail.
test('every app stylesheet and script on the public screens loads', async ({ page }) => {
  test.fail(true, 'D-CSS-01: SGFamilySupportTheme.extra.css returns 404 on every screen');
  test.setTimeout(150000);
  const base = requireBaseURL();
  const seen = watch(page, appRootOf(base));
  for (const screen of SCREENS) {
    await page.goto(screenUrl(base, screen), { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  }
  const assets = seen.failed.filter((f) => /\.(css|js)(\?|$)/.test(f));
  expect(assets, 'app stylesheets or scripts that failed to load').toEqual([]);
});

test('Browse shows results within 5 s on a repeat visit at 390px', async ({ page }) => {
  test.setTimeout(150000);
  const base = requireBaseURL();
  await page.setViewportSize({ width: 390, height: 844 });
  const url = screenUrl(base, 'FindCentres');
  // First visit warms the environment (personal environments idle down).
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForData(page);
  const timings: number[] = [];
  for (let i = 0; i < 2; i++) {
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /Showing \d/.test(document.body.innerText), null, {
      timeout: 60000,
    });
    timings.push(Date.now() - t0);
  }
  test.info().annotations.push({ type: 'timing', description: `repeat visits to results: ${timings.join(' ms, ')} ms` });
  for (const ms of timings) expect(ms, 'time to first results on a repeat visit (ms)').toBeLessThan(5000);
});
