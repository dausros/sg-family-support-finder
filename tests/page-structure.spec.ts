import { test, expect, Page } from '@playwright/test';
import { requireBaseURL, screenUrl, waitForData } from './helpers';

/**
 * Page structure checks added with the October 2026 polish round:
 * the staff sign-in page is branded and has no dead links, Browse has one
 * level 1 heading with the directory and results below it, no emoji are used
 * as icons on the public screens, the page description and Open Graph tags
 * are present once the app has loaded, and links in the map attribution are
 * underlined (not told apart by colour only).
 */

// Emoji presentation characters and pictographs; plain symbols such as the
// middle dot or the en dash used in copy are not matched.
const EMOJI = /\p{Extended_Pictographic}/u;

async function visibleEmoji(page: Page): Promise<string[]> {
  return page.evaluate((src) => {
    const re = new RegExp(src, 'u');
    const out: string[] = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = w.nextNode())) {
      const t = n.textContent ?? '';
      const el = n.parentElement;
      if (!el || !re.test(t)) continue;
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      out.push(t.trim().slice(0, 60));
    }
    return out;
  }, EMOJI.source);
}

test('staff sign-in page is branded and has no dead links', async ({ page }) => {
  const base = requireBaseURL();
  await page.goto(screenUrl(base, 'CentreAdmin'), { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/Login/i, { timeout: 60000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Staff sign-in' })).toBeVisible({ timeout: 30000 });
  await expect(page).toHaveTitle('Staff sign-in - SG Family Support Finder');
  await expect(page.getByText('SG Family Support Finder', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/forgot password/i)).toHaveCount(0);
  await expect(page.locator('img:visible')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  const back = page.getByRole('link', { name: 'Back to the public site' });
  await expect(back).toBeVisible();
  await back.click();
  await expect(page).toHaveURL(/FindCentres/i, { timeout: 60000 });
});

test('Browse has one level 1 heading, a directory heading and a heading per result', async ({ page }) => {
  const base = requireBaseURL();
  await page.goto(screenUrl(base, 'FindCentres'), { waitUntil: 'domcontentloaded' });
  await waitForData(page);
  const h1 = page.locator('h1, [role="heading"][aria-level="1"]');
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText('Find family support services');
  await expect(page.getByRole('heading', { level: 2, name: 'Browse all support places' })).toBeVisible();
  const results = page.getByRole('heading', { level: 3 });
  expect(await results.count(), 'one level 3 heading per result on the page').toBeGreaterThanOrEqual(10);
});

test('no emoji are used as icons on the public screens', async ({ page }) => {
  test.setTimeout(180000);
  const base = requireBaseURL();
  await page.goto(screenUrl(base, 'FindCentres'), { waitUntil: 'domcontentloaded' });
  await waitForData(page);
  expect(await visibleEmoji(page), 'Browse').toEqual([]);
  await page.goto(screenUrl(base, 'FindSupport'), { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /help with money/i }).waitFor({ timeout: 60000 });
  expect(await visibleEmoji(page), 'Find Support step 1').toEqual([]);
  await page.getByRole('button', { name: /help with money/i }).click();
  await page.getByRole('button', { name: /^next$/i }).first().click();
  await page.getByRole('button', { name: /skip the rest/i }).first().click();
  await expect(page.getByText(/step 3 of 3/i).first()).toBeVisible({ timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  expect(await visibleEmoji(page), 'Find Support results').toEqual([]);
});

test('page description and Open Graph tags are present after load', async ({ page }) => {
  const base = requireBaseURL();
  await page.goto(screenUrl(base, 'FindCentres'), { waitUntil: 'domcontentloaded' });
  await waitForData(page);
  const content = (sel: string) => page.locator(sel).first().getAttribute('content');
  expect(await content('meta[name="description"]')).toMatch(/family service centres/i);
  expect(await content('meta[property="og:title"]')).toBe('SG Family Support Finder');
  expect(await content('meta[property="og:description"]')).toMatch(/Singapore/);
  expect(await content('meta[property="og:url"]')).toMatch(/\/SGFamilySupportFinder\/$/);
});

test('map attribution links are underlined', async ({ page }) => {
  const base = requireBaseURL();
  await page.goto(screenUrl(base, 'FindCentres'), { waitUntil: 'domcontentloaded' });
  await waitForData(page);
  await page.getByText(/^view details$/i).first().click();
  const link = page.locator('.leaflet-control-attribution a').first();
  await expect(link).toBeVisible({ timeout: 30000 });
  const deco = await link.evaluate((a) => getComputedStyle(a).textDecorationLine);
  expect(deco).toContain('underline');
});
