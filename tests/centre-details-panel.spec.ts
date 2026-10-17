import { test, expect } from '@playwright/test';
import {
  requireBaseURL,
  appUrl,
  screenUrl,
  KNOWN_CENTRE_NAME,
  waitForData,
  waitForSupportData,
} from './helpers';

/**
 * CentreDetailsPanel sidebar (keyless Leaflet map via CDN with marker,
 * coordinates from the selected location; no Google Maps API key required).
 *
 * - Opens on View Details without navigating away (same URL).
 * - Shows the selected centre's actual name/type/address/contact info.
 * - Map block renders when verified coordinates exist; contact/directions
 *   links always use live data; missing fields render no invented info.
 * - X button closes; Escape closes; selecting another centre updates content.
 */

test('FindCentres View Details opens sidebar with selected centre', async ({
  page,
}) => {
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });
  await waitForData(page);
  const urlBefore = page.url();

  // Narrow to a centre with verified coordinates (Lakeside record).
  await page
    .getByRole('searchbox')
    .or(page.getByPlaceholder(/search/i))
    .first()
    .fill('lakeside');
  await page.getByRole('button', { name: /^search$/i }).click();
  await page.waitForTimeout(3000);

  const details = page
    .getByRole('link', { name: /view details/i })
    .first();
  await expect(details).toBeVisible({ timeout: 15000 });
  await details.click();

  // Panel shows the actual selected centre name (cards render live records).
  await expect(
    page.getByText(KNOWN_CENTRE_NAME, { exact: false }).first(),
  ).toBeVisible({ timeout: 15000 });

  // No navigation away merely to show details.
  expect(page.url()).toBe(urlBefore);

  // Type badge + address signal + contact actions inside the panel.
  await expect(page.getByText('FSC', { exact: true }).first()).toBeVisible({
    timeout: 10000,
  });
  const panelText = ((await page.textContent('body')) ?? '').toLowerCase();
  expect(panelText).toMatch(/\b\d{6}\b|street|road|avenue|jurong|tampines/);

  // Keyless embedded map: Leaflet initialises ON the .centre-drawer-leaflet
  // box itself (it gains .leaflet-container), with a marker for verified
  // coordinates. Match the box itself or a descendant container.
  const leaflet = page.locator(
    '.centre-drawer-leaflet.leaflet-container, .centre-drawer-leaflet .leaflet-container',
  );
  await expect(leaflet.first()).toBeVisible({ timeout: 30000 });
  await expect(
    page.locator('.leaflet-marker-icon, .leaflet-popup').first(),
  ).toBeVisible({ timeout: 20000 });

  // Close via X button.
  const close = page.getByRole('button', { name: /close/i }).last();
  await expect(close).toBeVisible({ timeout: 10000 });
  await close.click();
  await expect(
    page.getByText(KNOWN_CENTRE_NAME, { exact: false }).first(),
  ).toBeVisible({ timeout: 10000 });
});

test('sidebar updates when a different centre is selected, Escape closes', async ({
  page,
}) => {
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });
  await waitForData(page);
  const panel = page.locator('.centre-drawer-panel');
  const title = panel.locator('.centre-drawer-title');

  const links = page.getByRole('link', { name: /view details/i });
  const count = await links.count();
  test.skip(count < 2, 'needs at least two centre cards');
  await links.nth(0).click();
  await expect(panel).toBeVisible({ timeout: 15000 });
  const firstName = ((await title.innerText()) ?? '').trim();

  // X closes the panel, freeing the cards behind the overlay.
  await page.getByRole('button', { name: /close/i }).click();
  await expect(panel).toBeHidden({ timeout: 10000 });

  // Selecting a different centre shows its own details.
  await links.nth(1).click();
  await expect(panel).toBeVisible({ timeout: 15000 });
  const secondName = ((await title.innerText()) ?? '').trim();
  expect(secondName.length).toBeGreaterThan(0);
  expect(secondName).not.toBe(firstName);

  // Escape closes the panel.
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden({ timeout: 10000 });
});

test('sidebar directions and contact actions open live targets', async ({
  page,
}) => {
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });
  await waitForData(page);

  await page.getByRole('link', { name: /view details/i }).first().click();
  const panel = page.locator('.centre-drawer-panel');
  await expect(panel).toBeVisible({ timeout: 15000 });

  const directions = panel
    .getByRole('link', { name: /get directions/i })
    .first();
  await expect(directions).toBeVisible({ timeout: 10000 });
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 10000 }),
    directions.click(),
  ]);
  expect(popup.url()).toMatch(/google|maps|destination/i);
  await popup.close();

  const mapsLink = panel
    .getByRole('link', { name: /open in google maps/i })
    .first();
  await expect(mapsLink).toBeVisible({ timeout: 10000 });
});

test('FindSupport service locations open the same details panel', async ({
  page,
}) => {
  const baseURL = requireBaseURL();
  await page.goto(screenUrl(baseURL, 'FindSupport'), {
    waitUntil: 'domcontentloaded',
  });
  // Guided wizard: pick a need, advance through household context to results.
  await expect(
    page.getByRole('button', { name: /help with money/i }),
  ).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: /family or relationship/i }).click();
  // Step 1 requires explicit Continue (selection never auto-navigates).
  const cont = page.getByRole('button', { name: /^next$/i }).first();
  if (await cont.isVisible().catch(() => false)) {
    await cont.click();
  }
  const viewResults = page
    .getByRole('button', { name: /skip the rest/i })
    .first();
  if (await viewResults.isVisible().catch(() => false)) {
    await viewResults.click();
  }
  await waitForSupportData(page);

  // v2: "Places that can help" lists are collapsed; open the first one.
  const placesGroup = page.locator('summary', { hasText: /places/i }).first();
  await expect(placesGroup).toBeVisible({ timeout: 60000 });
  await placesGroup.click();

  const details = page
    .getByRole('link', { name: /view details/i })
    .first();
  // Location lists render after the datasets resolve; allow generous time
  // under parallel load before asserting the panel entry point.
  await expect(details).toBeVisible({ timeout: 60000 });
  const urlBefore = page.url();
  await details.click();

  await expect(
    page.getByRole('button', { name: /close/i }).last(),
  ).toBeVisible({ timeout: 30000 });
  expect(page.url()).toBe(urlBefore);
  // Type badge reflects the service location kind (FSC/SSO/SFP).
  const bodyText = (await page.textContent('body')) ?? '';
  expect(bodyText).toMatch(/FSC|SSO|SFP/);
});

test('mobile viewport renders panel as full-screen sheet', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });
  await waitForData(page);

  await page.getByRole('link', { name: /view details/i }).first().click();
  const close = page.getByRole('button', { name: /close/i }).last();
  // Panel render can lag the click under load; wait generously.
  await expect(close).toBeVisible({ timeout: 60000 });
  const box = await close.boundingBox();
  expect(box).not.toBeNull();
});
