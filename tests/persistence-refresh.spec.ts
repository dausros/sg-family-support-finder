import { test, expect, Page } from '@playwright/test';
import { requireBaseURL, appUrl, waitForData } from './helpers';

/**
 * ENABLED against the published app with the SGFamilySupport_CS
 * persistence backend (merged + published; UI binds the contracts on
 * FindCentres). spec4 stays explicitly [MOCKED]-labelled: browser-channel
 * fault only, not server-side-fallback proof.
 *
 * Locked implementation contracts asserted here:
 *  (1) Results-count label keeps matching /\d+\s*(centres|results|found)/i
 *      and appends ` · Updated dd/MM/yyyy HH:mm SGT` whenever LastSynced is
 *      known (e.g. `55 centres found · Updated 16 Oct 2026, 19:05`), plus
 *      ` · <CacheNotice>` when a stale warning exists.
 *  (2) Repeat visits with a fresh cache (<24h) perform ZERO upstream
 *      data.gov.sg refetches — observable from the browser ONLY as an
 *      UNCHANGED `Updated …` timestamp across reload (the O11 server action
 *      calls data.gov.sg server-side, so browser request interception can
 *      never observe the upstream call directly).
 *  (3) Stale-fallback warning text is exactly:
 *      `Live data is unavailable. Showing last updated records.`
 *  (4) Deterministic waits via helpers.waitForData-style polling (clicks
 *      through transient upstream 429 error states via Retry, bounded —
 *      genuine breakage still fails); serial workers only (`--workers=1`,
 *      personal environment throttles under parallel page loads).
 *
 * Prior-review findings incorporated in this rewrite:
 *  - request listener registered AFTER goto misses the initial fetch (race),
 *    and browser-side screenservices counting cannot prove "zero upstream
 *    refetches" (upstream is server-to-server) → spec1 now asserts
 *    timestamp stability + record stability across reload instead.
 *  - bare 90s expects / fixed sleeps flaked under 429 throttling →
 *    all specs use waitForData-style polling + Retry click-through.
 *  - loose timestamp regex (`\d{1,2}:\d{2}|today|…`) matched any clock time
 *    → spec2 parses `Updated dd/MM/yyyy HH:mm SGT` and asserts age < 24h.
 *  - count-only equality cannot prove "no duplicates" → spec3 asserts
 *    row-count AND rendered name-set equality across reload and after Retry.
 *  - aborting a data.gov.sg URL in the browser is a silent no-op (O11
 *    server-side fetch); faulting must target the browser→O11
 *    screenservices channel and be labelled [MOCKED] → spec4 is an
 *    explicitly [MOCKED]-labelled channel test, NOT server-side-fallback
 *    proof (see spec4 docblock).
 *
 * All 4 specs are enabled tests (spec1-3 live cache contracts, spec4
 * [MOCKED] channel test). Run serially: `npx playwright test --workers=1`.
 */

const COUNT_RE = /\d+\s*(centres|results|found)/i;
// e.g. "Showing 1–10 of 94 found · Updated 18/10/2026 21:38 SGT"
// (Singapore time since 18 Oct 2026; before that "Updated 16 Oct 2026, 19:05"
// in the browser's own timezone).
const UPDATED_RE = /Updated\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})\s+SGT/;
const STALE_WARNING =
  'Live data is unavailable. Showing last updated records.';
// Browser→O11 screen-action channels carrying this app's data (NOT the
// upstream data.gov.sg calls, which are server-side and invisible here).
// All three dataset channels must fail for the directory error state
// (single-dataset faults degrade to partial results by design).
const DATA_CALLS = [
  '**/screenservices/**/ActionGet*FamilyServiceCentres*',
  '**/screenservices/**/ActionGet*SocialServiceOffices*',
  '**/screenservices/**/ActionGet*StrengtheningFamiliesServices*',
  // Since the GetDirectory refactor the three lists arrive in one Data Action call.
  '**/screenservices/**/DataActionGetDirectory*',
];

/** Parse `dd/MM/yyyy HH:mm SGT` (Singapore, UTC+8) to an absolute Date. */
function parseUpdatedAt(text: string): Date | null {
  const m = text.replace(/\u00a0/g, ' ').match(UPDATED_RE);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi] = m;
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh) - 8, Number(mi)));
}

/** Visible results-count label text (includes `· Updated …` suffix). */
async function countLabelText(page: Page): Promise<string> {
  const label = page.getByText(COUNT_RE).first();
  await expect(label).toBeVisible({ timeout: 30000 });
  return ((await label.textContent()) ?? '').replace(/\s+/g, ' ').trim();
}

function countNumber(text: string): string | null {
  return text.match(/(\d+)\s*(centres|results|found)/i)?.[1] ?? null;
}

/**
 * Rendered service name-set: all visible card-name texts, normalised +
 * sorted. Matches FSC (`… Family Service …`), SSO (`Social Service
 * Office …`) and SFP names. Portable until real widget hooks exist
 * (e.g. `[data-testid="centre-card"]`); O11 lists render <div>s so no
 * listitem-role assumption.
 */
async function renderedNameSet(page: Page): Promise<string[]> {
  const raw = await page
    .getByText(/family service|social service|strengthening families/i)
    .allTextContents();
  return raw
    .map((t) => t.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter(Boolean)
    .sort();
}

test(
  'repeat visit with fresh cache keeps timestamp and records stable',
  async ({ page }) => {
    const baseURL = requireBaseURL();
    await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });
    await waitForData(page);
    const firstLabel = await countLabelText(page);
    const firstNames = await renderedNameSet(page);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForData(page);
    const secondLabel = await countLabelText(page);
    const secondNames = await renderedNameSet(page);

    // Contract (2): fresh cache (<24h) performs zero upstream refetches —
    // observable from the browser as an UNCHANGED `Updated …` timestamp.
    expect(
      parseUpdatedAt(firstLabel),
      'first visit should expose an `Updated dd/MM/yyyy HH:mm SGT` timestamp',
    ).not.toBeNull();
    expect(
      secondLabel,
      'repeat visit must keep the results-count timestamp UNCHANGED (no upstream refetch)',
    ).toBe(firstLabel);
    // Record stability across the reload.
    expect(countNumber(secondLabel)).toBe(countNumber(firstLabel));
    expect(secondNames, 'rendered name-set must be identical across reload').toEqual(
      firstNames,
    );
  },
);

test('refresh timestamp is shown and fresh (<24h)', async ({ page }) => {
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });
  await waitForData(page);
  const label = await countLabelText(page);
  expect(label).toMatch(COUNT_RE);
  expect(label).toMatch(
    UPDATED_RE,
  );
  const updatedAt = parseUpdatedAt(label);
  expect(updatedAt, `could not parse Updated timestamp from: ${label}`).not.toBeNull();
  const ageMs = Date.now() - (updatedAt as Date).getTime();
  expect(
    ageMs,
    `LastSynced age should be <24h (label: ${label})`,
  ).toBeLessThan(24 * 60 * 60 * 1000);
  expect(ageMs).toBeGreaterThanOrEqual(0);
});

test('reload and retry do not duplicate records', async ({ page }) => {
  const baseURL = requireBaseURL();
  await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });
  await waitForData(page);
  const beforeLabel = await countLabelText(page);
  const beforeNames = await renderedNameSet(page);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForData(page);
  const afterReloadLabel = await countLabelText(page);
  const afterReloadNames = await renderedNameSet(page);
  expect(
    countNumber(afterReloadLabel),
    'row-count must be identical after reload',
  ).toBe(countNumber(beforeLabel));
  expect(
    afterReloadNames,
    'rendered name-set must be identical after reload',
  ).toEqual(beforeNames);

  // After Retry: if a Retry button is present (transient 429 error state),
  // click through it waitForData-style and re-assert no duplication.
  const retry = page.getByRole('button', { name: /retry/i }).first();
  if (await retry.isVisible().catch(() => false)) {
    await retry.click();
    await waitForData(page);
    const afterRetryLabel = await countLabelText(page);
    const afterRetryNames = await renderedNameSet(page);
    expect(
      countNumber(afterRetryLabel),
      'row-count must be identical after Retry',
    ).toBe(countNumber(beforeLabel));
    expect(
      afterRetryNames,
      'rendered name-set must be identical after Retry',
    ).toEqual(beforeNames);
  }
});

test(
  '[MOCKED] browser-channel fault shows error state and Retry recovers (NOT server-side fallback proof)',
  async ({ page }) => {
    // Fidelity note (same as api-error-retry.mock.spec.ts): the O11 server
    // action calls data.gov.sg server-side, so intercepting data.gov.sg in
    // the browser would never fire. This faults all three browser→O11
    // screenservices channels (single-dataset faults now degrade gracefully
    // instead of erroring) to exercise the genuine app-level error path
    // (error state + Retry → recovery). It does NOT prove the server-side
    // stale-cache fallback
    // (exact text `Live data is unavailable. Showing last updated records.`
    // + stored records when upstream is down); that requires server-side
    // fault injection against the published app and is NOT verified here.
    void STALE_WARNING;
    const baseURL = requireBaseURL();
    for (const pattern of DATA_CALLS) {
      await page.route(pattern, (route) => route.abort());
    }
    await page.goto(appUrl(baseURL), { waitUntil: 'domcontentloaded' });

    const errorState = page.getByText(/unable to retrieve|failed|error/i).first();
    await expect(errorState).toBeVisible({ timeout: 30000 });
    const retry = page.getByRole('button', { name: /retry/i }).first();
    await expect(retry).toBeVisible({ timeout: 10000 });

    await page.unrouteAll({ behavior: 'wait' });
    // waitForData-style recovery loop (transient 429 may need retries).
    const deadline = Date.now() + 120000;
    let recovered = false;
    for (;;) {
      const body = (await page.textContent('body')) ?? '';
      if (/Lakeside Family Centre/.test(body) || /\b\d{6}\b/.test(body)) {
        recovered = true;
        break;
      }
      if (Date.now() > deadline) break;
      const retryAgain = page.getByRole('button', { name: /retry/i }).first();
      if (await retryAgain.isVisible().catch(() => false)) {
        await retryAgain.click();
      }
      await page.waitForTimeout(5000);
    }
    expect(recovered, 'Retry should recover to live records').toBe(true);
    await expect(page.getByText(COUNT_RE).first()).toBeVisible({
      timeout: 10000,
    });
  },
);
