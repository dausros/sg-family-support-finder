import { test, expect } from '@playwright/test';
import { requireBaseURL, screenUrl, waitForData, waitForSupportData } from './helpers';

const SUPPORT_URL = () =>
  screenUrl(process.env.APP_BASE_URL as string, 'FindSupport');

async function gotoSupport(page: import('@playwright/test').Page) {
  await page.goto(SUPPORT_URL(), { waitUntil: 'domcontentloaded' });
  // Guided form renders (static widgets, then live lists resolve).
  // Generous timeout: three sequential dataset fetches on first load.
  await expect(
    page.getByRole('button', { name: /financial difficulties/i }),
  ).toBeVisible({ timeout: 60000 });
}

async function pickNeed(
  page: import('@playwright/test').Page,
  label: RegExp,
) {
  await page.getByRole('button', { name: label }).click();
}

async function advanceToResults(page: import('@playwright/test').Page) {
  // Three-step wizard: need -> household context -> results.
  const next = page.getByRole('button', { name: /^next$/i }).first();
  if (await next.isVisible().catch(() => false)) {
    await next.click();
  }
  const viewResults = page.getByRole('button', { name: /view results/i }).first();
  if (await viewResults.isVisible().catch(() => false)) {
    await viewResults.click();
  }
}

test('FindSupport loads guided form without login', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  for (const label of [
    /financial difficulties/i,
    /family or relationship/i,
    /children and parenting/i,
    /caregiving/i,
  ]) {
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  }
  // Step 1 shows need buttons only; household/income inputs appear on step 2.
  await expect(
    page.getByText(/no login needed|nothing is stored/i).first(),
  ).toBeVisible();
});

test('financial need shows ComCare guidance and live SSO records', async ({
  page,
}) => {
  test.setTimeout(120000);
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /financial difficulties/i);
  await advanceToResults(page);
  await waitForSupportData(page);
  // Results screen must be reached before asserting cards (Next/View-results
  // timing varies under load; a mid-run redeploy can also delay rendering).
  await expect(
    page.getByText(/potentially relevant support|your assistance recommendations/i).first(),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.getByText(/comcare/i).first()).toBeVisible({
    timeout: 60000,
  });
  // Live SSO data: office names + postal codes from data.gov.sg.
  await expect
    .poll(
      async () =>
        /Social Service Office/i.test(
          (await page.textContent('body')) ?? '',
        ),
      { timeout: 30000 },
    )
    .toBe(true);
  // Official MSF ComCare link opens the verified guidance page.
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 10000 }),
    page.getByRole('link', { name: /comcare/i }).click(),
  ]);
  expect(popup.url()).toMatch(/msf\.gov\.sg\/what-we-do\/comcare/i);
  await popup.close();
});

test('family need shows live FSC and SFP records', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /family or relationship/i);
  await advanceToResults(page);
  await waitForSupportData(page);
});

test('caregiving need shows official referrals, no invented matches', async ({
  page,
}) => {
  test.setTimeout(120000);
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /caregiving/i);
  await advanceToResults(page);
  await waitForSupportData(page);
  // Recommendation cards render after GetSchemeRecommendations completes,
  // which can lag the dataset lists that waitForSupportData keys on.
  await expect(page.getByRole('link', { name: /sg enable/i })).toBeVisible({
    timeout: 60000,
  });
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 10000 }),
    page.getByRole('link', { name: /sg enable/i }).click(),
  ]);
  expect(popup.url()).toMatch(/sgenable\.sg/i);
  await popup.close();
});

test('income and household inputs do not gate results', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /children and parenting/i);
  // Step 2 inputs: recorded only, never used for eligibility.
  await page.getByPlaceholder(/3000|household income/i).fill('Prefer not to say');
  await page
    .getByRole('button', { name: /single adult/i })
    .click();
  await advanceToResults(page);
  // Results still render: inputs are recorded, never used for eligibility.
  await waitForSupportData(page);
  await expect(page.getByText(/does not determine eligibility/i)).toBeVisible();
});

test('navigation between FindSupport and FindCentres', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  await page.getByRole('link', { name: /browse all/i }).click();
  await waitForData(page);
  await page.getByRole('link', { name: /find support/i }).click();
  await expect(
    page.getByRole('button', { name: /financial difficulties/i }),
  ).toBeVisible({ timeout: 20000 });
});
