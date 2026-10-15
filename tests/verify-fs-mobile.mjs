import { chromium } from '@playwright/test';

const URL = 'https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/FindSupport';
const browser = await chromium.launch();
const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
m.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await m.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await m.waitForTimeout(15000);
const body = await m.locator('body').innerText();
console.log(JSON.stringify({
  loadingGone: !body.includes('Loading support options'),
  warning: (body.match(/temporarily unavailable[^.]*\./g) || []),
  prompt: body.includes('Choose a support need'),
}, null, 1));
await m.getByRole('button', { name: /family or relationship/i }).click();
await m.waitForTimeout(2000);
await m.screenshot({ path: 'verify-fs-mobile.png' });
console.log('ERRORS:', JSON.stringify(errs));
await browser.close();
