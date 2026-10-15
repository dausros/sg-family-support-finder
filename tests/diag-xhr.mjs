import { chromium } from '@playwright/test';

const URL = process.env.APP_BASE_URL;
const browser = await chromium.launch();
const page = await browser.newPage();
const urls = [];
page.on('request', r => {
  const u = r.url();
  if (u.includes('screenservice') || (r.method() === 'POST' && u.includes('SGFamilySupportFinder'))) urls.push(r.method() + ' ' + u.slice(0, 170));
});
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(10000);
console.log([...new Set(urls)].join('\n'));
await browser.close();
