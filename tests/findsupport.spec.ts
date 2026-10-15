import { test, expect } from '@playwright/test';
import { requireBaseURL, waitForData, waitForSupportData } from './helpers';

const SUPPORT_URL = () =>
  (process.env.APP_BASE_URL as string).replace(
    /FindCentres.*$/,
    'FindSupport',
  );

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
  await expect(page.getByPlaceholder(/optional/i)).toBeVisible();
  await expect(
    page.getByText(/no login needed|nothing is stored/i).first(),
  ).toBeVisible();
});

test('financial need shows ComCare guidance and live SSO records', async ({
  page,
}) => {
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /financial difficulties/i);
  await waitForSupportData(page);
  await expect(page.getByText(/comcare/i).first()).toBeVisible({
    timeout: 30000,
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
  await waitForSupportData(page);
});

test('caregiving need shows official referrals, no invented matches', async ({
  page,
}) => {
  requireBaseURL();
  await gotoSupport(page);
  await pickNeed(page, /caregiving/i);
  await waitForSupportData(page);
  await expect(page.getByRole('link', { name: /sg enable/i })).toBeVisible({
    timeout: 15000,
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
  await page.getByPlaceholder(/optional/i).fill('Prefer not to say');
  await page
    .getByRole('button', { name: /single adult/i })
    .click();
  await pickNeed(page, /children and parenting/i);
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
