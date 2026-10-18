import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { requireBaseURL, screenUrl, waitForData } from './helpers';

/**
 * Automated WCAG 2.1 A/AA scan (axe-core) of every public screen state,
 * on a phone (390 px) and on desktop (1440 px), and of Browse in all four
 * languages. Each test fails on any axe violation and prints the rule,
 * the impact and the first offending elements.
 *
 * axe-core finds roughly a third to a half of WCAG issues (contrast,
 * names, labels, ARIA, landmarks, lang). It does not replace a manual
 * screen reader and keyboard review; see the README "Accessibility" notes.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: Page, where: string) {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = result.violations.map(
    (v) =>
      `${v.id} (${v.impact}, ${v.nodes.length}): ${v.help} -> ` +
      v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | '),
  );
  test.info().annotations.push({
    type: 'axe',
    description: `${where}: ${result.passes.length} rules passed, ${result.violations.length} violated, ${result.incomplete.length} need manual review`,
  });
  expect(summary, `axe WCAG 2.1 A/AA violations on ${where}`).toEqual([]);
}

async function setLanguage(page: Page, name: RegExp) {
  await page.locator('button[id$=LanguageBtn]').first().click();
  await page
    .locator('button,a,[role=menuitem],[role=option],li')
    .filter({ hasText: name })
    .first()
    .click({ timeout: 8000 });
}

for (const width of [390, 1440]) {
  test(`Browse, details panel and no-results state pass axe at ${width}px`, async ({ page }) => {
    test.setTimeout(150000);
    const base = requireBaseURL();
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto(screenUrl(base, 'FindCentres'), { waitUntil: 'domcontentloaded' });
    await waitForData(page);
    await scan(page, `Browse ${width}px`);

    await page.getByText(/^view details$/i).first().click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 15000 });
    // Scan once the map has settled: Leaflet fades its popup in, and a scan
    // taken mid-fade measures blended (lower) contrast for the popup text.
    await page.locator('.leaflet-popup-content').first().waitFor({ timeout: 20000 }).catch(() => {});
    await page
      .waitForFunction(
        () => {
          const p = document.querySelector('.leaflet-popup');
          return !p || getComputedStyle(p).opacity === '1';
        },
        null,
        { timeout: 10000 },
      )
      .catch(() => {});
    await page.waitForTimeout(500);
    await scan(page, `Browse details panel ${width}px`);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 10000 });

    const search = page.getByPlaceholder(/search/i).first();
    await search.fill('zzz-no-such-centre-999');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(
      page.getByText(/no results|no centres|no services match|nothing found|not found/i).first(),
    ).toBeVisible({ timeout: 10000 });
    await scan(page, `Browse no results ${width}px`);
  });

  test(`Find Support steps 1 to 3 pass axe at ${width}px`, async ({ page }) => {
    test.setTimeout(150000);
    const base = requireBaseURL();
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto(screenUrl(base, 'FindSupport'), { waitUntil: 'domcontentloaded' });
    const need = page.getByRole('button', { name: /help with money/i });
    await expect(need).toBeVisible({ timeout: 60000 });
    await scan(page, `Find Support step 1 ${width}px`);

    await need.click();
    await page.getByRole('button', { name: /^next$/i }).first().click();
    await expect(page.getByText(/step 2 of 3/i).first()).toBeVisible({ timeout: 15000 });
    await scan(page, `Find Support step 2 ${width}px`);

    await page.getByRole('button', { name: /skip the rest/i }).first().click();
    await expect(page.getByText(/step 3 of 3/i).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('heading', { name: /help for you/i }).first()).toBeVisible({ timeout: 30000 });
    await scan(page, `Find Support results ${width}px`);
  });
}

for (const lang of [/Bahasa Melayu/, /中文/, /தமிழ்/]) {
  test(`Browse in ${lang.source} passes axe at 390px`, async ({ page }) => {
    test.setTimeout(120000);
    const base = requireBaseURL();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(screenUrl(base, 'FindCentres'), { waitUntil: 'domcontentloaded' });
    await waitForData(page);
    await setLanguage(page, lang);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.lang), { timeout: 15000 })
      .not.toMatch(/^en/);
    await scan(page, `Browse ${lang.source} 390px`);
  });
}

test('staff sign-in screen passes axe at 390px', async ({ page }) => {
  test.setTimeout(90000);
  const base = requireBaseURL();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(screenUrl(base, 'CentreAdmin'), { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/Login/i, { timeout: 30000 });
  await expect(page.locator('input[type=password]').first()).toBeVisible({ timeout: 30000 });
  await scan(page, 'Login 390px');
});
