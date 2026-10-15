import { test, expect, Page } from '@playwright/test';
/**
 * Shared helpers. No live URL is hardcoded here.
 * Set APP_BASE_URL at runtime, e.g.
 *   APP_BASE_URL=https://<env>.outsystemsenterprise.com/SGFamilySupportFinder/FindCentres
 */

export function requireBaseURL(): string {
  const baseURL = process.env.APP_BASE_URL;
  test.skip(!baseURL, 'BLOCKED: APP_BASE_URL is not set (no published app yet).');
  return baseURL as string;
}

export function appUrl(baseURL: string): string {
  return baseURL;
}

/**
 * Known real record from data.gov.sg dataset d_add23c06f7267e799185c79ccaa2099b.
 * Field names: NAME, ADDRESSBLOCKHOUSENUMBER, ADDRESSSTREETNAME,
 * ADDRESSPOSTALCODE, TELEPHONE, EMAIL, geometry.coordinates [lon, lat].
 */
export const KNOWN_CENTRE_NAME = 'Lakeside Family Centre (Jurong West)';

/** Case variants used to prove case-insensitive search. */
export const CASE_VARIANTS = ['lakeside', 'LAKESIDE', 'LaKeSiDe'];

/**
 * Wait until live centre data has rendered (initial OnInitialize fetch
 * complete). Guards every interaction spec against the load-then-search
 * race: searching before AllCentres is populated would filter an empty
 * list. Accepts the known record or any postal-code text (dataset may
 * evolve; no fixed count asserted here).
 */
export async function waitForData(page: Page) {
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
}
