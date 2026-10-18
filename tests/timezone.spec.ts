import { test, expect, Browser } from '@playwright/test';
import { requireBaseURL, screenUrl, waitForData } from './helpers';

// "Updated …" on Browse must be Singapore time whatever the visitor's device
// timezone is. Two browsers in different timezones must show the same
// wall-clock time, labelled SGT.

const UPDATED = /Updated (\d{2})\/(\d{2})\/(\d{4})[\s\u00a0](\d{2}):(\d{2}) SGT/;

async function updatedIn(browser: Browser, timezoneId: string, base: string) {
  const ctx = await browser.newContext({ timezoneId });
  const page = await ctx.newPage();
  await page.goto(screenUrl(base, 'FindCentres'), { waitUntil: 'domcontentloaded' });
  await waitForData(page);
  const line = page.getByText(UPDATED).first();
  await expect(line).toBeVisible({ timeout: 30000 });
  const text = (await line.innerText()).replace(/\s+/g, ' ');
  await ctx.close();
  return text.match(UPDATED)![0];
}

test('"Updated" is shown in SGT and does not move with the device timezone', async ({ browser }) => {
  test.setTimeout(150000);
  const base = requireBaseURL();
  const la = await updatedIn(browser, 'America/Los_Angeles', base);
  const sg = await updatedIn(browser, 'Asia/Singapore', base);
  const utc = await updatedIn(browser, 'UTC', base);
  expect(la).toBe(sg);
  expect(utc).toBe(sg);
  // Sanity: the stamp is a real date within the last 48 hours (cache TTL is 24 h).
  const [, dd, mm, yyyy, hh, mi] = sg.match(UPDATED)!;
  const stampUtc = Date.UTC(+yyyy, +mm - 1, +dd, +hh - 8, +mi);
  expect(Date.now() - stampUtc).toBeLessThan(48 * 3600 * 1000);
  expect(Date.now() - stampUtc).toBeGreaterThan(-5 * 60 * 1000);
});
