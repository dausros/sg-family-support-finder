import { chromium } from '@playwright/test';

const URL = process.env.APP_BASE_URL;
const browser = await chromium.launch();
const out = { searches: {}, states: {} };

// ---------- desktop pass ----------
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const opened = [];
await page.addInitScript(() => {
  window.__opened = [];
  window.open = (u) => { window.__opened.push(u); return null; };
});
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => /55 centres found/.test(document.body.innerText), null, { timeout: 60000 });
out.initial = (await page.locator('body').innerText()).match(/\d+ centres found/)?.[0];
await page.screenshot({ path: 'verify-desktop.png' });

const searchBtn = page.getByRole('button', { name: /^search$/i });
out.searchButtonVisible = await searchBtn.isVisible();
async function search(term) {
  const box = page.getByPlaceholder(/search/i);
  await box.fill(term);
  await searchBtn.click();
  await page.waitForTimeout(2000);
  return (await page.locator('body').innerText()).match(/\d+ centres found/)?.[0];
}
out.searches.lakeside = await search('lakeside');
out.searches.LAKESIDE = await search('LAKESIDE');
out.searches.jurong = await search('jurong');
out.searches.postal = await search('640516');
out.searches.tampines = await search('tampines');
out.searches.gibberish = await search('zzz-no-such-centre-999');
await page.screenshot({ path: 'verify-noresults.png' });
out.searches.cleared = await search('');
// contact links via stubbed window.open
await search('lakeside');
const telText = await page.getByText('6567 1908').first().innerText().catch(() => 'NOT-FOUND');
out.states.telText = telText;
await page.getByText('6567 1908').first().click();
await page.waitForTimeout(1500);
await page.getByText('lfsjw@lakeside.org.sg').first().click();
await page.waitForTimeout(1500);
await page.getByRole('link', { name: /get directions/i }).first().click();
await page.waitForTimeout(2000);
out.states.openedUrls = await page.evaluate(() => window.__opened);
out.states.pageErrors = errs;
await page.screenshot({ path: 'verify-card.png' });
await page.close();

// ---------- mobile pass ----------
const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
await m.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await m.waitForFunction(() => /55 centres found/.test(document.body.innerText), null, { timeout: 60000 });
await m.screenshot({ path: 'verify-mobile.png' });
const mbox = m.getByPlaceholder(/search/i);
await mbox.fill('tampines');
await m.getByRole('button', { name: /^search$/i }).click();
await m.waitForTimeout(2000);
out.mobile = (await m.locator('body').innerText()).match(/\d+ centres found/)?.[0];
await m.screenshot({ path: 'verify-mobile-search.png' });
await browser.close();
console.log(JSON.stringify(out, null, 1));
