import { test, expect } from '@playwright/test';

// F1: category questions are dropdowns backed by static entities; marital status and housing type are new.
test('category questions are labelled dropdowns and feed the ranking', async ({ page }) => {
  await page.goto('FindSupport', { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('button', { name: /help with money/i }).click();
  await page.locator('.sgsf-continue').click();
  for (let i = 0; i < 2; i++) await page.locator('.btn-primary:visible').last().click();
  const expected: [RegExp, string[]][] = [
    [/who lives in your home/i, ['Family with children', 'Single adult', 'Senior household', 'Other / prefer not to say']],
    [/marital status/i, ['Single', 'Married', 'Divorced or separated', 'Widowed', 'Prefer not to say']],
    [/kind of home/i, ['HDB rental flat', 'HDB 1- to 3-room flat', 'HDB 4-room or bigger', 'Condo or private house', 'Other / prefer not to say']],
    [/are you working/i, ['Working', 'Looking for work', 'Unable to work', 'Retired', 'Prefer not to say']],
    [/singapore citizen or permanent resident/i, ['Singapore Citizen', 'Permanent Resident', 'Other', 'Prefer not to say']],
  ];
  const picks = ['Family with children', 'Divorced or separated', 'HDB rental flat', 'Looking for work', 'Singapore Citizen'];
  for (let q = 0; q < expected.length; q++) {
    await expect(page.getByText(new RegExp(`question ${q + 3} of 7`, 'i'))).toBeVisible();
    const sel = page.locator('select:visible');
    await expect(sel).toHaveCount(1);
    await expect(sel.locator('option')).toHaveCount(expected[q][1].length + 1, { timeout: 30000 });
    const opts = (await sel.locator('option').allTextContents()).map((t) => t.trim());
    expect(opts.slice(1)).toEqual(expected[q][1]);
    expect((await sel.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await sel.selectOption({ label: picks[q] });
    if (q < expected.length - 1) await page.locator('.btn-primary:visible').last().click();
  }
  await page.getByRole('button', { name: /view results/i }).click();
  await expect(page.locator('.sgsf-rec-card').first()).toBeVisible({ timeout: 90000 });
  await expect(page.locator('.sgsf-rec-title', { hasText: /ComLink\+/ })).toBeVisible();
});
