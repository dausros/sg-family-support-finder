import { test, expect, Page } from '@playwright/test';
import { requireBaseURL, appUrl } from './helpers';

/**
 * (6) [MOCKED] API-error + retry test.
 * This test MOCKS a network failure — it is NOT evidence of live data.
 *
 * Fidelity note: the O11 server action calls data.gov.sg from the OutSystems
 * server, NOT from the browser, so intercepting data.gov.sg in the browser
 * would never fire. Instead this faults the browser-to-O11 screen-action
 * channel that carries THIS app's data
 * (POST .../screenservices/.../ActionGetCached* — all three dataset
 * channels are faulted, since per-dataset failures now degrade gracefully
 * instead of erroring the page), which
 * exercises the genuine app-level error path: OnInitialize fails ->
 * LoadError state + Retry button -> un-fault -> Retry recovers to live
 * records. Filename- and title-labelled [MOCKED]; never live-data evidence.
 */
 // The screenservices endpoint carries the consuming module's reference
 // alias; match by wildcard so the fault survives alias renames. All three
 // dataset channels must fail for the directory error state to appear
 // (single-dataset failures degrade to partial results by design).
const DATA_CALLS = [
  '**/screenservices/**/ActionGet*FamilyServiceCentres*',
  '**/screenservices/**/ActionGet*SocialServiceOffices*',
  '**/screenservices/**/ActionGet*StrengtheningFamiliesServices*',
  // Since the GetDirectory refactor the three lists arrive in one Data Action call.
  '**/screenservices/**/DataActionGetDirectory*',
];

test('[MOCKED] api error shows labelled error state with retry', async ({
  page,
}) => {
  const baseURL = requireBaseURL();

  // Fault all data calls, then load: the app shell renders but OnInitialize
  // fails on every dataset, so the API-error state with Retry must appear.
  for (const pattern of DATA_CALLS) {
    await page.route(pattern, (route) => route.abort());
  }
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });

  const errorState = page.getByText(/unable to retrieve|failed|error/i).first();
  await expect(errorState).toBeVisible({ timeout: 30000 });

  const retry = page.getByRole('button', { name: /retry/i }).first();
  await expect(retry).toBeVisible({ timeout: 10000 });

  // Remove the fault and retry: the page must recover to real records
  // (dataset may evolve — assert live-data signals, not fixed counts).
  // Recovery can take a while under upstream throttling: re-locate Retry
  // (the button may re-render) and keep polling, mirroring waitForData.
  await page.unrouteAll({ behavior: 'wait' });
  const deadline = Date.now() + 120000;
  let recovered = false;
  for (;;) {
    const body = (await page.textContent('body')) ?? '';
    if (/Lakeside Family Centre/.test(body) || /\b\d{6}\b/.test(body)) {
      recovered = true;
      break;
    }
    if (Date.now() > deadline) break;
    const retryAgain = page.getByRole('button', { name: /retry/i }).first();
    if (await retryAgain.isVisible().catch(() => false)) {
      await retryAgain.click();
    }
    await page.waitForTimeout(5000);
  }
  expect(recovered).toBe(true);
  await expect(page.getByText(/showing|of \d+ found/i).first()).toBeVisible({
    timeout: 10000,
  });
});
