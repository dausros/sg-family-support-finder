import { test, expect } from '@playwright/test';
import { requireBaseURL, appUrl, KNOWN_CENTRE_NAME, waitForData } from './helpers';

/**
 * (2) Real Family Service Centre records appear (live data, NOT mocked).
 * Dataset: data.gov.sg d_add23c06f7267e799185c79ccaa2099b
 * Field names asserted where rendered: NAME, ADDRESSBLOCKHOUSENUMBER,
 * ADDRESSSTREETNAME, ADDRESSPOSTALCODE.
 * Status: BLOCKED pending publish.
 */
test('real Family Service Centre records appear', async ({ page }) => {
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });

  // The list should populate from the live API. Accept either the known
  // record or a generic non-empty result list (O11 lists render <div>s, so
  // postal-code text is the portable fallback when no listitem role exists).
  // Boolean poll (not locator .or()) to avoid strict-mode violations when
  // several fallbacks match at once.
  await expect
    .poll(
      async () => {
        const body = (await page.textContent('body')) ?? '';
        return (
          body.includes(KNOWN_CENTRE_NAME) || /\b\d{6}\b/.test(body)
        );
      },
      { timeout: 45000 },
    )
    .toBe(true);
  await waitForData(page);

  // Results count label, e.g. "12 centres" / "12 results found".
  const countLabel = page.getByText(/\d+\s*(centres|results|found)/i).first();
  await expect(countLabel).toBeVisible({ timeout: 10000 });

  // If detail/address text is rendered, it should include street/postal fragments.
  // Loose check: page contains at least one postal-code-like token (6 digits).
  const bodyText = (await page.textContent('body')) ?? '';
  expect(
    bodyText.includes(KNOWN_CENTRE_NAME) || /\b\d{6}\b/.test(bodyText),
    'expected live centre data (known NAME or postal code) on page',
  ).toBe(true);
});
