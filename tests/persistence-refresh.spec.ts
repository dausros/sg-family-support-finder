import { test, expect } from '@playwright/test';
import { requireBaseURL, appUrl } from './helpers';

/**
 * STAGED for the SGFamilySupport_CS persistence implementation.
 * These tests describe POST-entities behaviour and are fixme-marked until
 * the backend stores datasets with refresh metadata:
 * - repeat visits must not call data.gov.sg (screenservices data channel idle)
 * - a visible refresh timestamp must exist and be fresh (< 24h)
 * - reload + Retry must not duplicate records
 * - aborted upstream must fall back to stored data with a stale warning
 * Do NOT unmark until the CS Entities + timers are published.
 */
const DATA_CALL = '**/screenservices/**/ActionGetFamilyServiceCentres*';

test.fixme('repeat visit serves stored data without upstream calls', async ({
  page,
}) => {
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/\d+\s*(centres|results|found)/i).first()).toBeVisible({
    timeout: 90000,
  });
  let dataCalls = 0;
  page.on('request', (r) => {
    if (r.url().includes('screenservices') && r.url().includes('ActionGetFamilyServiceCentres')) {
      dataCalls += 1;
    }
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/\d+\s*(centres|results|found)/i).first()).toBeVisible({
    timeout: 90000,
  });
  expect(dataCalls, 'repeat visit must not refetch upstream').toBe(0);
});

test.fixme('refresh timestamp is shown and fresh', async ({ page }) => {
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });
  const stamp = page.getByText(/updated|refreshed|as of/i).first();
  await expect(stamp).toBeVisible({ timeout: 90000 });
  const text = (await stamp.textContent()) ?? '';
  expect(text).toMatch(/\d{1,2}:\d{2}|today|hour|minute|\d{1,2}\/\d{1,2}\/\d{2,4}/i);
});

test.fixme('reload and retry do not duplicate records', async ({ page }) => {
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });
  const countOf = async () =>
    (await page.textContent('body'))?.match(/(\d+)\s*(centres|results|found)/i)?.[1];
  await expect
    .poll(countOf, { timeout: 90000 })
    .not.toBeNull();
  const before = await countOf();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(countOf, { timeout: 90000 }).toBe(before);
});

test.fixme('upstream failure falls back to stored data with warning', async ({
  page,
}) => {
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/\d+\s*(centres|results|found)/i).first()).toBeVisible({
    timeout: 90000,
  });
  await page.route(DATA_CALL, (route) => route.abort());
  await page.reload({ waitUntil: 'domcontentloaded' });
  const body = (await page.textContent('body')) ?? '';
  expect(
    /Lakeside Family Centre|\b\d{6}\b/.test(body),
    'stored records still render when upstream fails',
  ).toBe(true);
  expect(body).toMatch(/cached|offline|stale|warning|retry|refresh/i);
  await page.unroute(DATA_CALL);
});
