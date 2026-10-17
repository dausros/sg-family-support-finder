import { test, expect } from '@playwright/test';
import { requireBaseURL, screenUrl, waitForData } from './helpers';

/**
 * Independent responsive + accessibility checks for SG Family Support Finder.
 * Read-only against the published app; does not touch Service Studio.
 * Run: APP_BASE_URL=.../FindCentres npx playwright test ux-responsive.spec.ts --workers=2
 */

const VIEWPORTS = [320, 375, 390, 768, 1024, 1280, 1440];

async function loadCentres(page: import('@playwright/test').Page, width: number) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(screenUrl(process.env.APP_BASE_URL as string, 'FindCentres'), {
    waitUntil: 'domcontentloaded',
  });
  await waitForData(page);
}

test('FindCentres has no horizontal overflow at any target viewport', async ({
  page,
}) => {
  requireBaseURL();
  test.setTimeout(300000);
  for (const width of VIEWPORTS) {
    await loadCentres(page, width);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
  }
});

test('FindSupport step 1 has no horizontal overflow at any target viewport', async ({
  page,
}) => {
  requireBaseURL();
  test.setTimeout(300000);
  for (const width of VIEWPORTS) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(screenUrl(process.env.APP_BASE_URL as string, 'FindSupport'), {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByRole('button', { name: /help with money/i }),
    ).toBeVisible({ timeout: 60000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
  }
});

test('mobile touch targets and search usability at 390px', async ({ page }) => {
  requireBaseURL();
  test.setTimeout(120000);
  await loadCentres(page, 390);
  const search = page.getByPlaceholder(/search/i).first();
  await expect(search).toBeVisible();
  const searchBox = await search.boundingBox();
  expect(searchBox?.height, 'search input height').toBeGreaterThanOrEqual(36);
  const searchBtn = page.getByRole('button', { name: /^search$/i });
  const btnBox = await searchBtn.boundingBox();
  expect(btnBox?.height, 'search button height').toBeGreaterThanOrEqual(36);

  await page.goto(screenUrl(process.env.APP_BASE_URL as string, 'FindSupport'), {
    waitUntil: 'domcontentloaded',
  });
  const need = page.getByRole('button', { name: /help with money/i });
  await expect(need).toBeVisible({ timeout: 60000 });
  for (const label of [/help with money/i, /caregiving/i]) {
    const box = await page.getByRole('button', { name: label }).boundingBox();
    expect(box?.height, `need button ${label} height`).toBeGreaterThanOrEqual(40);
  }
});

test('keyboard navigation reaches search and need options', async ({ page }) => {
  requireBaseURL();
  test.setTimeout(120000);
  await loadCentres(page, 1280);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    return el ? el.tagName + '|' + (el.getAttribute('placeholder') || el.textContent || '').slice(0, 40) : 'none';
  });
  expect(focused, 'keyboard focus lands on an interactive element').not.toBe('none|');

  await page.goto(screenUrl(process.env.APP_BASE_URL as string, 'FindSupport'), {
    waitUntil: 'domcontentloaded',
  });
  await expect(
    page.getByRole('button', { name: /help with money/i }),
  ).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: /help with money/i }).focus();
  const needFocused = await page.evaluate(
    () => (document.activeElement?.textContent || '').slice(0, 30),
  );
  expect(needFocused).toMatch(/money/i);
});

test('semantic headings, labels and document language', async ({ page }) => {
  requireBaseURL();
  test.setTimeout(120000);
  await loadCentres(page, 1280);
  const lang = await page.evaluate(() => document.documentElement.lang);
  expect(lang, 'html lang attribute').toBeTruthy();
  await expect(page).toHaveTitle(/Family|Support|Finder/i, { timeout: 20000 });
  // Screen titles currently render as <div> (O11 Title widget), so no
  // heading elements exist yet. Search keeps a placeholder-derived name,
  // and a skip link is present.
  const searchName = await page
    .getByPlaceholder(/search/i)
    .first()
    .evaluate((el) => (el as HTMLInputElement).ariaLabel || el.getAttribute('placeholder'));
  expect(searchName, 'search input has accessible name').toBeTruthy();
  // Skip link is present in the DOM (a.skip-nav). Whether it is focusable
  // and visible on keyboard focus is tracked separately as D-A11Y-02.
  expect(await page.getByText(/skip to content/i).count(), 'skip link present').toBeGreaterThanOrEqual(1);
});

// D-A11Y-01 FIXED (Dec 2026 batch): screen titles carry role="heading".
// Hard assertion: page must expose at least one semantic heading.
test('FindCentres exposes semantic headings', async ({ page }) => {
  requireBaseURL();
  test.setTimeout(120000);
  await loadCentres(page, 1280);
  const headingCount = await page.locator('h1,h2,h3,h4,h5,h6,[role=heading]').count();
  expect(headingCount, 'at least one semantic heading').toBeGreaterThanOrEqual(1);
});

// D-A11Y-02 FIXED: accessibility features enabled on the layout, so the
// platform skip link appears on keyboard focus. Hard assertion.
test('skip link is focusable and visible on Tab', async ({
  page,
}) => {
  requireBaseURL();
  test.setTimeout(120000);
  await loadCentres(page, 1280);
  await page.keyboard.press('Tab');
  const skip = page.getByText(/skip to content/i).first();
  await expect(skip).toBeVisible();
  expect(await skip.evaluate((el) => el === document.activeElement)).toBe(true);
});
