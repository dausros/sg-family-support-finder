import { chromium } from '@playwright/test';

const URL = 'https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/FindSupport';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
await page.addInitScript(() => {
  window.__opened = [];
  window.open = (u) => { window.__opened.push(u); return null; };
});
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
const out = {};
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(15000);
let body = await page.locator('body').innerText();
out.loadingGone = !body.includes('Loading support options');
out.partialWarning = body.match(/temporarily unavailable[^.]*\./g) || [];
out.counts = {
  fsc: (body.match(/Family Service Centre/g) || []).length,
  sso: (body.match(/Social Service Office/g) || []).length,
};
await page.screenshot({ path: 'verify-fs-partial.png' });

async function pickNeed(label) {
  await page.getByRole('button', { name: new RegExp(label, 'i') }).click();
  await page.waitForTimeout(1500);
  const t = await page.locator('body').innerText();
  return { dirs: (t.match(/Get directions/g) || []).length, len: t.length };
}
out.financial = await pickNeed('Financial difficulties');
out.family = await pickNeed('Family or relationship');
out.children = await pickNeed('Children and parenting');
out.caregiving = await pickNeed('Caregiving');
// popups
await pickNeed('Financial difficulties');
const comcareVisible = await page.getByRole('link', { name: /comcare/i }).count();
out.comcareLinks = comcareVisible;
if (comcareVisible > 0) {
  await page.getByRole('link', { name: /comcare/i }).click();
  await page.waitForTimeout(1200);
}
const dirCount = await page.getByRole('link', { name: /get directions/i }).count();
out.dirLinks = dirCount;
if (dirCount > 0) {
  await page.getByRole('link', { name: /get directions/i }).first().click();
  await page.waitForTimeout(1500);
}
await pickNeed('Caregiving');
out.sgLinks = await page.getByRole('link', { name: /sg enable/i }).count();
if (out.sgLinks > 0) {
  await page.getByRole('link', { name: /sg enable/i }).click();
  await page.waitForTimeout(1200);
}
out.opened = await page.evaluate(() => window.__opened);
// nav both ways
await page.getByRole('link', { name: /browse all/i }).click();
await page.waitForTimeout(5000);
out.navToCentres = (await page.locator('body').innerText()).match(/\d+ centres found/)?.[0];
await page.getByRole('link', { name: /find support/i }).click();
await page.waitForTimeout(5000);
out.navBack = (await page.title());
out.errors = errs;
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
await browser.close();
