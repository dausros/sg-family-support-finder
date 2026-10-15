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
 * (POST .../screenservices/.../ActionGetFamilyServiceCentres), which
 * exercises the genuine app-level error path: OnInitialize fails ->
 * LoadError state + Retry button -> un-fault -> Retry recovers to 55
 * records. Filename- and title-labelled [MOCKED]; never live-data evidence.
 */
const DATA_CALL = '**/screenservices/**/ActionGetFamilyServiceCentres';

test('[MOCKED] api error shows labelled error state with retry', async ({
  page,
}) => {
  const baseURL = requireBaseURL();

  // Fault the data call, then load: the app shell renders but OnInitialize
  // fails, so the API-error state with Retry must appear.
  await page.route(DATA_CALL, (route) => route.abort());
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });

  const errorState = page.getByText(/unable to retrieve|failed|error/i).first();
  await expect(errorState).toBeVisible({ timeout: 30000 });

  const retry = page.getByRole('button', { name: /retry/i }).first();
  await expect(retry).toBeVisible({ timeout: 10000 });

  // Remove the fault and retry: the page must recover to real records
  // (dataset may evolve — assert live-data signals, not fixed counts).
  await page.unroute(DATA_CALL);
  await retry.click();
  await expect
    .poll(
      async () => {
        const body = (await page.textContent('body')) ?? '';
        return (
          /Lakeside Family Centre/.test(body) || /\b\d{6}\b/.test(body)
        );
      },
      { timeout: 30000 },
    )
    .toBe(true);
  await expect(page.getByText(/\d+ centres found/i)).toBeVisible({
    timeout: 10000,
  });
});
