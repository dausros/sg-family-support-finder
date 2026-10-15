import { test, expect } from '@playwright/test';
import { requireBaseURL, appUrl, KNOWN_CENTRE_NAME, waitForData } from './helpers';

/**
 * (5) Contact details + directions link displayed.
 * Field names: TELEPHONE, EMAIL, ADDRESSBLOCKHOUSENUMBER,
 * ADDRESSSTREETNAME, ADDRESSPOSTALCODE, geometry.coordinates [lon, lat].
 * Status: BLOCKED pending publish.
 */
test('contact details and directions link displayed', async ({ page }) => {
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });

  // Prefer the known record, but fall back to any rendered card (O11 lists
  // render <div>s, so postal-code text is the portable fallback) in case the
  // single known NAME is renamed or removed from the live dataset.
  // Boolean poll (not locator .or()) to avoid strict-mode violations.
  await expect
    .poll(
      async () => {
        const body = (await page.textContent('body')) ?? '';
        return body.includes(KNOWN_CENTRE_NAME) || /\b\d{6}\b/.test(body);
      },
      { timeout: 45000 },
    )
    .toBe(true);
  await waitForData(page);
  const clickable = page
    .getByRole('link', { name: new RegExp('Lakeside', 'i') })
    .or(page.getByRole('button', { name: new RegExp('Lakeside', 'i') }));
  if ((await clickable.count()) > 0) {
    await clickable.first().click();
    // Deterministic wait for contact details instead of a fixed sleep.
    await page
      .waitForFunction(
        () =>
          /(\+?65[\s-]?\d{4}[\s-]?\d{4}|\b\d{4}\s?\d{4}\b)|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(
            document.body.innerText,
          ),
        { timeout: 10000 },
      )
      .catch(() => {});
  }

  const bodyText = ((await page.textContent('body')) ?? '').toLowerCase();

  // Telephone or email should be present (TELEPHONE / EMAIL fields).
  const hasPhone = /(\+?65[\s-]?\d{4}[\s-]?\d{4}|\b\d{4}\s?\d{4}\b)/.test(bodyText);
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(bodyText);
  expect(hasPhone || hasEmail, 'expected TELEPHONE and/or EMAIL on page').toBe(true);

  // Address fragment (ADDRESSBLOCKHOUSENUMBER / ADDRESSSTREETNAME /
  // ADDRESSPOSTALCODE): require a real address signal, not just non-empty text.
  expect(
    bodyText,
    'expected address fragment (block/street/road/postal code) on page',
  ).toMatch(/\b\d{6}\b|block \d+|street|road|avenue|jurong|tampines/i);

  // Directions link: O11 renders action links with href="#" and performs
  // navigation via a screen action (window.open), so assert the REAL
  // behavior — click and capture the popup URL (verified live).
  const directions = page
    .getByRole('link', { name: /direction|map|route|navigate/i })
    .first();
  await expect(directions).toBeVisible({ timeout: 10000 });
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 10000 }),
    directions.click(),
  ]);
  const popupUrl = popup.url();
  expect(
    popupUrl,
    'directions link should open a maps/directions URL',
  ).toMatch(/google|onemap|geo:|maps|lat|lon|daddr|destination/i);
  await popup.close();
});
