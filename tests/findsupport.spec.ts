import { test, expect, Page } from '@playwright/test';
import { requireBaseURL, screenUrl, waitForSupportData } from './helpers';

// Find Support v2: step 1 = one need, step 2 = one question per screen
// (5 optional questions), step 3 = "Help for you" ranked results.
// Ranking and notes come from SGFamilySupport_CS.GetSchemeRecommendations.
// Nothing here is an eligibility decision.

const SUPPORT_URL = () => screenUrl(process.env.APP_BASE_URL as string, 'FindSupport');

async function gotoSupport(page: Page) {
  await page.goto(SUPPORT_URL(), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /help with money/i })).toBeVisible({ timeout: 60000 });
}

async function next(page: Page) {
  await page.locator('.btn-primary:visible').last().click();
}

async function pickNeed(page: Page, label: RegExp) {
  await page.getByRole('button', { name: label }).click();
  await page.locator('.sgsf-continue').click();
  await expect(page.getByText(/question 1 of 5/i)).toBeVisible({ timeout: 30000 });
}

type Household = { income?: string; size?: string; household?: RegExp; employment?: RegExp; residency?: RegExp };

async function answer(page: Page, h: Household) {
  if (h.income) await page.locator('input:visible').first().fill(h.income);
  await next(page);
  await expect(page.getByText(/question 2 of 5/i)).toBeVisible();
  if (h.size) await page.locator('input:visible').first().fill(h.size);
  await next(page);
  await expect(page.getByText(/question 3 of 5/i)).toBeVisible();
  if (h.household) await page.getByRole('button', { name: h.household }).click();
  await next(page);
  await expect(page.getByText(/question 4 of 5/i)).toBeVisible();
  if (h.employment) await page.getByRole('button', { name: h.employment }).click();
  await next(page);
  await expect(page.getByText(/question 5 of 5/i)).toBeVisible();
  if (h.residency) await page.getByRole('button', { name: h.residency }).click();
}

async function viewResults(page: Page) {
  await page.getByRole('button', { name: /view results/i }).click();
  await expect(page.locator('.sgsf-rec-card').first()).toBeVisible({ timeout: 60000 });
}

async function titles(page: Page) {
  return (await page.locator('.sgsf-rec-title').allTextContents()).map((t) => t.trim());
}

function card(page: Page, name: RegExp) {
  return page.locator('.sgsf-rec-card').filter({ has: page.locator('.sgsf-rec-title', { hasText: name }) });
}

test('step 1: four needs, no login, step 1 of 3', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  for (const n of [/help with money/i, /family or relationship/i, /parenting support/i, /caregiving/i]) {
    await expect(page.getByRole('button', { name: n })).toBeVisible();
  }
  await expect(page.getByText(/step 1 of 3/i)).toBeVisible();
});

test('selected need is marked pressed', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  const p = page.getByRole('button', { name: /parenting support/i });
  await p.click();
  await expect(p).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /help with money/i })).toHaveAttribute('aria-pressed', 'false');
});

test('step 2 asks one question per screen and Back works', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /help with money/i);
  await expect(page.locator('input:visible')).toHaveCount(1);
  await next(page);
  await expect(page.getByText(/question 2 of 5/i)).toBeVisible();
  await page.getByRole('button', { name: /^back$/i }).click();
  await expect(page.getByText(/question 1 of 5/i)).toBeVisible();
});

test('parenting: KidSTART ranked first as a good match', async ({ page }) => {
  test.setTimeout(150000);
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /parenting support/i);
  // $2,000 / 4 people = $500 per person, within KidSTART's published per-capita test.
  await answer(page, { income: '2000', size: '4', household: /family with children/i, employment: /^working$/i, residency: /singapore citizen/i });
  await viewResults(page);
  const t = await titles(page);
  expect(t[0]).toMatch(/KidSTART/);
  expect(t.join(' | ')).not.toMatch(/ComCare|Home Caregiving/);
  await expect(card(page, /KidSTART/)).toContainText(/good match\. you may be eligible/i);
  await expect(page.getByText(/the agency decides if you qualify/i)).toBeVisible();
});

test('"May not apply" only when a published rule fails', async ({ page }) => {
  test.setTimeout(150000);
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /parenting support/i);
  // $6,000 / 2 = $3,000 per person: above KidSTART's test.
  await answer(page, { income: '6000', size: '2' });
  await viewResults(page);
  const kid = card(page, /KidSTART/);
  await expect(kid).toHaveCount(1);
  await expect(kid).toContainText(/this may not fit you/i);
  // A scheme with no income test stays "You may be eligible".
  await expect(page.locator('.sgsf-rec-card').filter({ hasText: /you may be eligible/i }).first()).toBeVisible();
});

test('money need: ComCare SMTA listed with real tel: links', async ({ page }) => {
  test.setTimeout(150000);
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /help with money/i);
  await answer(page, { income: '1500', size: '4', employment: /looking for work/i, residency: /singapore citizen/i });
  await viewResults(page);
  expect((await titles(page)).join(' | ')).toMatch(/ComCare Short-to-Medium-Term Assistance/);
  await expect(page.locator('a[href^="tel:"]').first()).toBeVisible();
  expect(await page.locator('a[href="tel:18002220000"]').count()).toBeGreaterThan(0);
  await expect(card(page, /Short-to-Medium-Term/).getByRole('link', { name: /how to apply/i })).toBeVisible();
});

test('skip the rest still gives general results', async ({ page }) => {
  test.setTimeout(150000);
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /family or relationship/i);
  await page.getByRole('button', { name: /skip the rest/i }).click();
  await expect(page.locator('.sgsf-rec-card').first()).toBeVisible({ timeout: 60000 });
  await waitForSupportData(page);
});

test('language picker translates the page and back', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  await page.locator('.sgsf-hb-lang').click();
  await page.locator('.sgsf-lang-opt', { hasText: 'தமிழ்' }).click();
  await expect(page.getByText('உங்களுக்கு எதில் உதவி தேவை?')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'ta');
  await page.locator('.sgsf-hb-lang').click();
  await page.locator('.sgsf-lang-opt', { hasText: 'English' }).click();
  await expect(page.getByText('What do you need help with?')).toBeVisible({ timeout: 20000 });
});

test('Bigger text toggle and Help now call link', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  const big = page.getByRole('button', { name: /bigger text/i });
  await big.click();
  await expect(big).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveClass(/sgsf-text-lg/);
  await big.click();
  await expect(big).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('a.sgsf-ab-call')).toHaveAttribute('href', 'tel:18002220000');
});

test('landing page leads into Find Support', async ({ page }) => {
  requireBaseURL();
  await page.goto(screenUrl(process.env.APP_BASE_URL as string, 'FindCentres'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/not sure where to start\?/i).first()).toBeVisible({ timeout: 60000 });
  await page.getByRole('link', { name: /find support for my family/i }).click();
  await expect(page.getByRole('button', { name: /help with money/i })).toBeVisible({ timeout: 60000 });
  expect(page.url()).toMatch(/FindSupport/);
});
