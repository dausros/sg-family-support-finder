import { test, expect } from '@playwright/test';

// F3: "Keep or share these results" card on the results step.
test('results can be shared on WhatsApp and printed', async ({ page, context }) => {
  await page.goto('FindSupport', { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('button', { name: /help with money/i }).click();
  await page.getByRole('button', { name: /^next$/i }).first().click();
  await page.getByRole('button', { name: /skip the rest/i }).click();
  await expect(page.locator('.sgsf-rec-card').first()).toBeVisible({ timeout: 120000 });
  const share = page.getByRole('button', { name: /share on whatsapp/i });
  await share.scrollIntoViewIfNeeded();
  const box = await share.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(48);
  const [popup] = await Promise.all([context.waitForEvent('page'), share.click()]);
  const url = decodeURIComponent(popup.url().replace(/\+/g, ' '));
  expect(url).toMatch(/(wa\.me|whatsapp\.com)/);
  expect(url).toContain('My family support suggestions');
  expect(url).toContain('The agency decides who qualifies');
  await popup.close();
  await expect(page.getByRole('button', { name: /print or save as pdf/i })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.sgsf-share')).toBeHidden();
  await expect(page.locator('.sgsf-rec-card').first()).toBeVisible();
});
