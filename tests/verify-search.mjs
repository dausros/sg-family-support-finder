import { chromium } from '@playwright/test';

const URL = process.env.APP_BASE_URL;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
await page.addInitScript(() => {
  window.__rej = [];
  window.addEventListener('unhandledrejection', e => window.__rej.push(String(e.reason && e.reason.stack || e.reason).slice(0, 300)));
});
const consoleErrs = [];
page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 250)); });
const extCalls = [];
page.on('request', r => {
  const u = r.url();
  if (u.includes('data.gov.sg') || u.includes('amazonaws.com')) extCalls.push(u.slice(0, 80));
});
const out = {};
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => /\d+ centres found/.test(document.body.innerText), null, { timeout: 60000 });
await page.waitForTimeout(2000);
const snap = async () => {
  const text = await page.locator('body').innerText();
  return {
    count: text.match(/\d+ centres found/)?.[0],
    cards: (text.match(/Get directions/g) || []).length,
    names: [...text.matchAll(/(Lakeside Family Centre \(Jurong West\)|THK Family Service Centre @ Jurong|MWS Family Service Centre \S+ \S+|Family Service Centre \S+)/g)].slice(0, 8).map(m => m[0]),
  };
};
out.initial = await snap();
async function search(term) {
  await page.getByPlaceholder(/search/i).fill(term);
  await page.getByRole('button', { name: /^search$/i }).click();
  await page.waitForTimeout(2000);
  return snap();
}
out.lakeside = await search('lakeside');
out.LAKESIDE = await search('LAKESIDE');
out.jurong = await search('jurong');
out.postal = await search('640516');
out.tampines = await search('tampines');
out.gibberish = await search('zzzznonexistent');
const noRes = await page.getByText(/no centres match/i).isVisible();
out.gibberishEmptyState = noRes;
out.cleared = await search('');
out.extCallsOnSearch = extCalls.length;
out.extCalls = extCalls.slice(0, 4);
out.consoleErrs = consoleErrs;
out.rejections = await page.evaluate(() => window.__rej);
console.log(JSON.stringify(out, null, 1));
await browser.close();
