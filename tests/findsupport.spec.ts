import { test, expect, Page } from '@playwright/test';
import { requireBaseURL, screenUrl, waitForData, waitForSupportData } from './helpers';

// Find Support: 3-step wizard with personalised, indicative scheme ranking.
// Ranking and notes come from SGFamilySupport_CS.GetSchemeRecommendations over
// the static SchemeCatalogue (verified against official pages 2026-10-17).
// Nothing here is an eligibility decision; the disclaimer must stay visible.

const SUPPORT_URL = () =>
  screenUrl(process.env.APP_BASE_URL as string, 'FindSupport');

async function gotoSupport(page: Page) {
  await page.goto(SUPPORT_URL(), { waitUntil: 'domcontentloaded' });
  // Generous timeout: three sequential dataset fetches on first load.
  await expect(
    page.getByRole('button', { name: /financial difficulties/i }),
  ).toBeVisible({ timeout: 60000 });
}

async function pickNeed(page: Page, label: RegExp) {
  await page.getByRole('button', { name: label }).click();
  await page.getByRole('button', { name: /^continue$/i }).click();
  await expect(page.getByPlaceholder(/3000|household income/i)).toBeVisible({
    timeout: 30000,
  });
}

async function fillHousehold(
  page: Page,
  opts: {
    income?: string;
    size?: string;
    household?: RegExp;
    employment?: RegExp;
    residency?: RegExp;
  },
) {
  if (opts.income !== undefined) {
    await page.getByPlaceholder(/3000|household income/i).fill(opts.income);
  }
  if (opts.size !== undefined) {
    await page.getByPlaceholder(/number of members/i).fill(opts.size);
  }
  for (const choice of [opts.household, opts.employment, opts.residency]) {
    if (choice) {
      const btn = page.getByRole('button', { name: choice });
      await btn.click();
      await expect(btn).toHaveAttribute('aria-pressed', 'true');
    }
  }
}

async function viewResults(page: Page) {
  await page.getByRole('button', { name: /view results/i }).click();
  await expect(
    page.getByText(/your assistance recommendations/i).first(),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.sgsf-rec-card').first()).toBeVisible({
    timeout: 60000,
  });
}

async function recTitles(page: Page): Promise<string[]> {
  return (await page.locator('.sgsf-rec-title').allTextContents()).map((t) =>
    t.trim(),
  );
}

async function cardFor(page: Page, name: RegExp) {
  return page.locator('.sgsf-rec-card').filter({
    has: page.locator('.sgsf-rec-title', { hasText: name }),
  });
}

test('FindSupport loads guided form without login, parenting is its own need', async ({
  page,
}) => {
  requireBaseURL();
  await gotoSupport(page);
  for (const label of [
    /financial difficulties/i,
    /family or relationship/i,
    /^parenting support$/i,
    /caregiving/i,
  ]) {
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  }
  // The old combined category is gone.
  await expect(
    page.getByRole('button', { name: /children and parenting/i }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/no login needed|nothing is stored/i).first(),
  ).toBeVisible();
  // Progress indicator shows step 1 of 3.
  await expect(page.getByText(/step 1 of 3/i)).toBeVisible();
});

test('selected need is marked pressed', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  const parenting = page.getByRole('button', { name: /^parenting support$/i });
  await parenting.click();
  await expect(parenting).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: /financial difficulties/i }),
  ).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText(/selected: parenting support/i)).toBeVisible();
});

test('parenting need ranks parenting schemes with indicative income notes', async ({
  page,
}) => {
  test.setTimeout(120000);
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /^parenting support$/i);
  await expect(page.getByText(/step 2 of 3/i)).toBeVisible();
  // $2,000 / 4 people = $500 per person: within KidSTART's published tests
  // ($2,500 household or $650 per capita), Singapore Citizen.
  await fillHousehold(page, {
    income: '2000',
    size: '4',
    household: /^family with children$/i,
    employment: /^working$/i,
    residency: /^singapore citizen$/i,
  });
  await viewResults(page);
  // Disclaimer stays prominent on results.
  await expect(
    page.getByText(/not an official eligibility decision/i).first(),
  ).toBeVisible();
  await expect(page.getByText(/does not determine eligibility/i)).toBeVisible();
  const titles = await recTitles(page);
  // Parenting catalogue entries only (no ComCare / caregiving grants).
  expect(titles.join(' | ')).toMatch(/KidSTART/);
  expect(titles.join(' | ')).toMatch(/Baby Bonus/);
  expect(titles.join(' | ')).toMatch(/Families for Life Parenting/);
  expect(titles.join(' | ')).not.toMatch(/ComCare|Home Caregiving/);
  // Ranked: KidSTART (income within published threshold) comes first.
  expect(titles[0]).toMatch(/KidSTART/);
  const kid = await cardFor(page, /KidSTART/);
  await expect(kid.locator('.sgsf-pill')).toHaveText(/likely relevant/i);
  await expect(kid.locator('.sgsf-rec-why')).toContainText(
    /per-capita income appears to be about \$500, within the typical threshold of \$650/i,
  );
  await expect(kid.locator('.sgsf-rec-why')).toContainText(/indicative only/i);
  // Family-support locations shown for parenting (FSC + FAM/SFP lists).
  await waitForSupportData(page);
  await expect(
    page.getByText(/where to go: family service centres/i),
  ).toBeVisible();
});

test('household income above a published threshold is flagged, not hidden', async ({
  page,
}) => {
  test.setTimeout(120000);
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /^parenting support$/i);
  // $6,000 / 2 = $3,000 per person: above KidSTART's tests.
  await fillHousehold(page, { income: '6000', size: '2' });
  await viewResults(page);
  const kid = await cardFor(page, /KidSTART/);
  await expect(kid).toHaveCount(1);
  await expect(kid.locator('.sgsf-rec-why')).toContainText(
    /appears to be about \$3,000, above the typical threshold of \$650/i,
  );
  await expect(kid.locator('.sgsf-pill')).toHaveText(/may not apply/i);
  // Still listed with its official link (indicative, never a decision).
  await expect(
    kid.getByRole('link', { name: /official information: kidstart/i }),
  ).toBeVisible();
});

test('financial need ranks on employment and residency; official link opens', async ({
  page,
}) => {
  test.setTimeout(120000);
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /financial difficulties/i);
  await fillHousehold(page, {
    employment: /^looking for work$/i,
    residency: /^permanent resident$/i,
  });
  await viewResults(page);
  const titles = await recTitles(page);
  expect(titles.join(' | ')).toMatch(/ComCare Short-to-Medium-Term Assistance/);
  // Jobseeker Support is for the unemployed (SC/PR): ranked first here.
  expect(titles[0]).toMatch(/Jobseeker Support/i);
  // Workfare is for Singapore Citizens who are working: flagged.
  const wis = await cardFor(page, /Workfare/);
  await expect(wis.locator('.sgsf-pill')).toHaveText(/may not apply/i);
  await expect(wis.locator('.sgsf-rec-why')).toContainText(
    /stated for Singapore Citizens/i,
  );
  // Live SSO data is listed for financial needs.
  await waitForSupportData(page);
  await expect
    .poll(
      async () =>
        /Social Service Office/i.test((await page.textContent('body')) ?? ''),
      { timeout: 30000 },
    )
    .toBe(true);
  // Official SMTA page opens in a new tab.
  const smta = await cardFor(page, /Short-to-Medium-Term/);
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 15000 }),
    smta.getByRole('link', { name: /official information/i }).click(),
  ]);
  expect(popup.url()).toMatch(/supportgowhere\.life\.gov\.sg/i);
  await popup.close();
});

test('missing household inputs show general results', async ({ page }) => {
  test.setTimeout(120000);
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /financial difficulties/i);
  await viewResults(page);
  const why = await page.locator('.sgsf-rec-why').first().textContent();
  expect(why ?? '').toMatch(/add household details in step 2/i);
  await expect(page.locator('.sgsf-pill', { hasText: /may not apply/i })).toHaveCount(0);
});

test('"Find a nearby" opens the directory pre-filtered to the matching service type', async ({
  page,
}) => {
  test.setTimeout(120000);
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /financial difficulties/i);
  await viewResults(page);
  await page
    .getByRole('link', { name: /find a nearby social service office/i })
    .first()
    .click();
  await page.waitForURL(/FindCentres/, { timeout: 30000 });
  expect(page.url()).toMatch(/ServiceType=SSO/);
  // Directory loads with the SSO type pre-selected from the deep link.
  await expect(page.getByText(/type: sso/i).first()).toBeVisible({
    timeout: 90000,
  });
  await expect(page.locator('.sgsf-card').first()).toContainText(
    /social service office/i,
    { timeout: 60000 },
  );
});

test('family need shows live FSC and SFP records', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /family or relationship/i);
  await viewResults(page);
  await waitForSupportData(page);
});

test('caregiving need shows official referrals, no invented matches', async ({
  page,
}) => {
  test.setTimeout(120000);
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /caregiving/i);
  await viewResults(page);
  const titles = await recTitles(page);
  expect(titles.join(' | ')).toMatch(/Home Caregiving Grant/);
  expect(titles.join(' | ')).toMatch(/Caregivers Training Grant/);
  const sgEnable = page.getByRole('link', { name: /^sg enable/i }).first();
  await expect(sgEnable).toBeVisible({ timeout: 60000 });
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 10000 }),
    sgEnable.click(),
  ]);
  expect(popup.url()).toMatch(/sgenable\.sg/i);
  await popup.close();
});

test('navigation between FindSupport and FindCentres', async ({ page }) => {
  requireBaseURL();
  await gotoSupport(page);
  await page.getByText(/browse services/i).first().click();
  await waitForData(page);
  expect(page.url()).toMatch(/FindCentres/);
  await page.getByText(/find support/i).first().click();
  await expect(
    page.getByRole('button', { name: /financial difficulties/i }),
  ).toBeVisible({ timeout: 20000 });
});

test('results show what to do next, scheme helplines and the urgent ComCare hotline', async ({
  page,
}) => {
  test.setTimeout(120000);
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /financial difficulties/i);
  await viewResults(page);
  // Urgent-help strip (ComCare Hotline, from the verified scheme data).
  await expect(page.getByText(/need help urgently\?/i)).toBeVisible();
  await expect(
    page.getByRole('link', { name: /call the comcare hotline at 1800 222 0000/i }),
  ).toBeVisible();
  const smta = await cardFor(page, /Short-to-Medium-Term/);
  await expect(smta).toContainText(/what to do next:/i);
  await expect(
    smta.getByRole('link', { name: /call comcare hotline at 1800 222 0000/i }),
  ).toBeVisible();
});

test('landing page states the problem and leads into Find Support', async ({
  page,
}) => {
  requireBaseURL();
  await page.goto(
    screenUrl(process.env.APP_BASE_URL as string, 'FindCentres'),
    { waitUntil: 'domcontentloaded' },
  );
  await expect(page.getByText(/not sure where to start\?/i).first()).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByText(/spread across MSF, AIC, CPF/i)).toBeVisible();
  await page.getByRole('link', { name: /find support for my family/i }).click();
  await expect(
    page.getByRole('button', { name: /financial difficulties/i }),
  ).toBeVisible({ timeout: 60000 });
  expect(page.url()).toMatch(/FindSupport/);
});
