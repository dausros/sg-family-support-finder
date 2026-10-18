import { test, expect, Page } from '@playwright/test';
import { requireBaseURL, screenUrl } from './helpers';

/**
 * Listen (read-aloud) reads in the language the page is showing, with a
 * matching device voice, and never falls back to an English voice for
 * Malay, Chinese or Tamil. Headless Chromium has no voices, so the Web
 * Speech API is replaced by a stub that records what would be spoken.
 * Real audio on phones is not covered here.
 */
type Voice = { lang: string; name: string };
const ALL: Voice[] = [
  { lang: 'en-GB', name: 'Daniel' },
  { lang: 'ms-MY', name: 'Amira' },
  { lang: 'zh-CN', name: 'Tingting' },
  { lang: 'ta-IN', name: 'Vani' },
];
const EN_ONLY: Voice[] = [{ lang: 'en-GB', name: 'Daniel' }];

async function stubSpeech(page: Page, voices: Voice[]) {
  await page.addInitScript((V: Voice[]) => {
    let loaded = false;
    const ls: Array<() => void> = [];
    (window as any).__spoken = [];
    const ss = {
      getVoices: () => (loaded ? V : []),
      speak(u: any) {
        (window as any).__spoken.push({ lang: u.lang, voice: u.voice ? u.voice.name : '', text: u.text });
        setTimeout(() => u.onend && u.onend(), 50);
      },
      cancel() {},
      addEventListener(e: string, f: () => void) { if (e === 'voiceschanged') ls.push(f); },
      removeEventListener() {},
      speaking: false,
    };
    setTimeout(() => { loaded = true; ls.forEach((f) => f()); }, 300);
    Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true });
    (window as any).SpeechSynthesisUtterance = function (this: any, t: string) { this.text = t; this.lang = ''; this.voice = null; };
  }, voices);
}

async function chooseLanguage(page: Page, label: RegExp) {
  await page.locator('button').filter({ hasText: /🌐|Language|Bahasa|语言|மொழி/i }).first().click();
  await page.locator('button,a,[role=menuitem],[role=option],li').filter({ hasText: label }).first().click();
  await expect.poll(() => page.evaluate(() => (window as any).__sgsfI18n?.lang)).not.toBe('en');
}

const CASES: Array<[string, RegExp, string, string, RegExp]> = [
  ['ms', /Melayu/, 'ms-MY', 'Amira', /Apa yang anda perlukan/],
  ['zh', /中文/, 'zh-CN', 'Tingting', /您需要哪方面的帮助/],
  ['ta', /தமிழ்/, 'ta-IN', 'Vani', /உதவி/],
];

for (const [code, label, lang, voice, text] of CASES) {
  test(`Listen reads ${code} text with a ${lang} voice`, async ({ page }) => {
    const base = requireBaseURL();
    await stubSpeech(page, ALL);
    await page.goto(screenUrl(base, 'FindSupport'), { waitUntil: 'networkidle', timeout: 120000 });
    await chooseLanguage(page, label);
    await page.locator('button.sgsf-listen').first().click();
    await expect.poll(() => page.evaluate(() => (window as any).__spoken.length), { timeout: 10000 }).toBeGreaterThan(0);
    const spoken = await page.evaluate(() => (window as any).__spoken[0]);
    expect(spoken.lang).toBe(lang);
    expect(spoken.voice).toBe(voice);
    expect(spoken.text).toMatch(text);
  });
}

test('Listen shows a translated note instead of using an English voice', async ({ page }) => {
  const base = requireBaseURL();
  await stubSpeech(page, EN_ONLY);
  await page.goto(screenUrl(base, 'FindSupport'), { waitUntil: 'networkidle', timeout: 120000 });
  await chooseLanguage(page, /Melayu/);
  await page.locator('button.sgsf-listen').first().click();
  await expect(page.locator('.sgsf-voice-note')).toContainText('Tiada suara Bahasa Melayu', { timeout: 10000 });
  expect(await page.evaluate(() => (window as any).__spoken.length)).toBe(0);
});

test('Listen in English still reads with an English voice', async ({ page }) => {
  const base = requireBaseURL();
  await stubSpeech(page, ALL);
  await page.goto(screenUrl(base, 'FindSupport'), { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1000);
  await page.locator('button.sgsf-listen').first().click();
  await expect.poll(() => page.evaluate(() => (window as any).__spoken.length), { timeout: 10000 }).toBeGreaterThan(0);
  const spoken = await page.evaluate(() => (window as any).__spoken[0]);
  expect(spoken.lang).toBe('en-GB');
  expect(spoken.text).toMatch(/What do you need help with/);
});
