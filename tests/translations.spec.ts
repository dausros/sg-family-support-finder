import { test, expect, Page } from '@playwright/test';
import { requireBaseURL, screenUrl, waitForData } from './helpers';

// The public Browse screen in all four languages: filter labels, dropdown
// options, the Singapore-time stamp and the Call links' accessible names.

async function setLanguage(page: Page, name: RegExp) {
  await page.locator('button[id$=LanguageBtn]').first().click();
  await page
    .locator('button,a,[role=menuitem],[role=option],li')
    .filter({ hasText: name })
    .first()
    .click({ timeout: 8000 });
}

const LANGS = [
  {
    name: /^English$/, htmlLang: /^en/, labels: ['Service type', 'Sort by'],
    options: ['All services', 'Name A to Z', 'Name Z to A'],
    updated: /Updated \d{2}\/\d{2}\/\d{4}[\s\u00a0]\d{2}:\d{2} SGT/, call: 'Call',
  },
  {
    name: /Bahasa Melayu/, htmlLang: /^ms/, labels: ['Jenis perkhidmatan', 'Susun ikut'],
    options: ['Semua perkhidmatan', 'Nama A hingga Z', 'Nama Z hingga A'],
    updated: /Dikemas kini \d{2}\/\d{2}\/\d{4}[\s\u00a0]\d{2}:\d{2} SGT/, call: 'Hubungi',
  },
  {
    name: /中文/, htmlLang: /^zh/, labels: ['服务类型', '排序方式'],
    options: ['所有服务', '名称 A 到 Z', '名称 Z 到 A'],
    // Chinese date: no stray comma between the date and the time.
    updated: /更新于 \d{4} 年 \d{1,2} 月 \d{1,2} 日 \d{2}:\d{2}（新加坡时间）/, call: '拨打|致电', // both are standard for "Call"; the Browse links use 致电 since 18 Oct 2026
  },
  {
    name: /தமிழ்/, htmlLang: /^ta/, labels: ['சேவை வகை', 'வரிசைப்படுத்து'],
    options: ['அனைத்து சேவைகளும்', 'பெயர் A முதல் Z வரை', 'பெயர் Z முதல் A வரை'],
    updated: /புதுப்பிக்கப்பட்டது \d{2}\/\d{2}\/\d{4}[\s\u00a0]\d{2}:\d{2} SGT/, call: 'அழைக்கவும்',
  },
];

for (const L of LANGS) {
  test(`Browse in ${L.labels[0]}: labels, options, SGT stamp, Call names`, async ({ page }) => {
    test.setTimeout(120000);
    const base = requireBaseURL();
    await page.goto(screenUrl(base, 'FindCentres'), { waitUntil: 'domcontentloaded' });
    await waitForData(page);
    await setLanguage(page, L.name);
    await expect.poll(() => page.evaluate(() => document.documentElement.lang), { timeout: 15000 }).toMatch(L.htmlLang);
    const labels = await page.locator('label:visible').allInnerTexts();
    for (const l of L.labels) {
      await expect.poll(async () => (await page.locator('label:visible').allInnerTexts()).map((t) => t.trim())).toContain(l);
    }
    const options = (await page.locator('select option').allInnerTexts()).map((t) => t.trim());
    for (const o of L.options) expect(options, `options: ${options.join(' | ')}; labels: ${labels.join(' | ')}`).toContain(o);
    const body = await page.locator('body').innerText();
    expect(body).toMatch(L.updated);
    expect(body).not.toMatch(/日[,，]/);
    // Call links: the accessible name contains the visible number and the
    // localised "Call" word (axe label-content-name-mismatch).
    const tels = page.locator('a.sgsf-tel-link');
    expect(await tels.count()).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(3, await tels.count()); i++) {
      const visible = (await tels.nth(i).innerText()).trim();
      const aria = (await tels.nth(i).getAttribute('aria-label')) ?? '';
      expect(aria).toContain(visible);
      expect(aria).toMatch(new RegExp('^(' + L.call + ')'));
    }
  });
}
