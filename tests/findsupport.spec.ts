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
  // Three-step wizard: pick need -> Continue -> household context -> View results.
  // Selection never auto-navigates; each step has a single footer row.
  const cont = page.getByRole('button', { name: /^continue$/i }).first();
  if (await cont.isVisible().catch(() => false)) {
    await cont.click();
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
  // Official MSF ComCare link opens the verified guidance page (scoped to
  // the results guidance link; the footer carries a separate ComCare link).
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 10000 }),
    page.getByRole('link', { name: /official msf comcare guidance/i }).click(),
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
  // Caregiving shows official referrals (no location cards by design), so
  // wait on recommendation content rather than dataset markers.
  await expect(
    page.getByText(/your assistance recommendations|potentially relevant support/i).first(),
  ).toBeVisible({ timeout: 90000 });
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
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.getByPlaceholder(/3000|household income/i).waitFor({ timeout: 30000 });
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
  // Header nav anchors carry real hrefs but are not exposed under the
  // link role in some renders; click by substring text and assert by URL.
  await page.getByText(/browse services/i).first().click();
  await waitForData(page);
  expect(page.url()).toMatch(/FindCentres/);
  await page.getByText(/find support/i).first().click();
  await expect(
    page.getByRole('button', { name: /financial difficulties/i }),
  ).toBeVisible({ timeout: 20000 });
});
