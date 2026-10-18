# SG Family Support Finder — Playwright tests

> **Latest full serial run (`--workers=1`): 70 passed, 0 failed, 1 skipped
> (71 tests, 18 Oct 2026, 18:48–19:04 UTC)** against the live app at
> `https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/`, Chromium,
> in batches of 5 minutes or less, without a login: the logged-in admin flow in
> `admin.spec.ts` was skipped. The 70 include one expected failure (`test.fail`)
> in `page-health.spec.ts` that tracks known defect D-CSS-01.
> Evidence: `docs/test-evidence/public-run-2026-10-18-evening.md`.
> Latest run with the `reviewer` CentreAdmin login (`SGFSF_ADMIN_USER` /
> `SGFSF_ADMIN_PASS`): 60 passed, 0 failed, 0 skipped (60 tests, 18 Oct 2026,
> 16:42–16:53 UTC), `docs/test-evidence/reviewer-run-2026-10-18.md`.
> Previous runs: 59 passed / 1 skipped (18 Oct 2026, 16:20–16:29 UTC, `scripts/check-all.sh`); 54 passed / 1 skipped (18 Oct 2026, 21:59 SGT); 47 passed / 1 skipped (17 Oct 2026); 30/30 (16 Oct 2026).

## Layout

| File | Covers |
|---|---|
| `accessibility.spec.ts` | axe-core WCAG 2.0 / 2.1 A and AA scan of Browse, the details panel, the no-results state and Find Support steps 1–3 at 390 px and 1440 px, Browse in Bahasa Melayu / 中文 / தமிழ், and the staff sign-in page; fails on any violation and prints the rule and elements |
| `page-health.spec.ts` | no uncaught script errors on the public screens; every app stylesheet and script loads (`test.fail` while known defect D-CSS-01 is open: remove the marker when it passes); Browse shows results within 5 s on a repeat visit at 390 px |
| `app-loads.spec.ts` | (1) app loads + search input visible; loading indicator resolves |
| `real-records.spec.ts` | (2) real Family Service Centre records appear (live data) + results count |
| `search.spec.ts` | (3) case-insensitive search (`lakeside` variants + independent `tampines` term) |
| `no-results.spec.ts` | (4) no-results / empty state |
| `contact-directions.spec.ts` | (5) contact details (TELEPHONE/EMAIL) + address fragment + directions link |
| `api-error-retry.mock.spec.ts` | (6) **[MOCKED]** offline/browser-channel error + retry (labelled mock, not live evidence) |
| `centre-details-panel.spec.ts` | (5) details drawer: opens from FindCentres and FindSupport, updates on reselect, Escape closes, directions/contact targets, full-screen sheet on mobile |
| `findsupport.spec.ts` | (7) FindSupport: form loads, per-category guidance + live SSO/FSC/SFP records, income/household neutrality, official-link popups, nav both ways (explicit Continue step) |
| `wizard.spec.ts` | (9) wizard behaviour: no auto-navigation on select, Continue advances, Back preserves selection, household select without submit, non-numeric income treated as unspecified, negative income blocked with message, blank optionals proceed |
| `directory.spec.ts` | (9) combined directory: all three types with badges/counts (94/24/15), search+type combination, pagination with reset, sort reversal |
| `persistence-refresh.spec.ts` | (9) persistence: repeat visit keeps `Updated …` timestamp + records stable (zero-refetch observable), timestamp parses and is <24h fresh, reload + Retry keep row-count and name-set identical, `[MOCKED]` browser-channel fault + Retry recovery (labelled mock, not server-side-fallback proof) |
| `ux-responsive.spec.ts` | (8) responsive + a11y: zero horizontal overflow on both screens at 320/375/390/768/1024/1280/1440, 390px touch targets, keyboard reach, labels/`lang`/title/skip-link presence, semantic headings + focusable skip link (former `D-A11Y-01/02` gaps, now hard assertions) |
| `listen.spec.ts` | Listen (read-aloud) uses the page language and a matching voice (ms-MY / zh-CN / ta-IN); no English-voice fallback, translated "no voice" note instead. Web Speech API is stubbed (headless Chromium has no voices); real phone audio is not covered |
> NOTE (Oct 2026): `D-A11Y-01/02` were `test.fail`-tracked while the app lacked heading roles and the layout flag; both now pass as hard assertions. If either regresses, reinstate `test.fail` rather than deleting the test.
| `admin.spec.ts` | `CentreAdmin` screen redirects to Login when logged out; logged-in add/edit/hide/show (needs `SGFSF_ADMIN_USER` / `SGFSF_ADMIN_PASS`; skipped without them) |
| `dropdowns.spec.ts` | Find Support category questions are labelled dropdowns and feed the ranking |
| `nearest.spec.ts` | postal code → 3 nearest centres sorted by distance; friendly messages for bad/unknown codes |
| `share-print.spec.ts` | WhatsApp share text, print view not clipped, no printed URLs |
| `hotline.spec.ts` | Browse "Help now" is `tel:18002220000`; Find Support money results call the ComCare Hotline 1800 222 0000; 1800 777 0000 appears nowhere (source: https://www.msf.gov.sg/contact-us-feedback) |
| `timezone.spec.ts` | "Updated dd/MM/yyyy HH:mm SGT" is identical under UTC, Asia/Singapore and America/Los_Angeles device clocks, and under 48 h old |
| `translations.spec.ts` | Browse in English, Bahasa Melayu, 中文 and தமிழ்: filter labels, dropdown options, the SGT stamp (no stray comma in 中文), and each Call link's accessible name contains its visible number |
| `ux-baseline/` | viewport screenshots (320→1920) for both screens + measured `overflowX: 0` at every width |
| `helpers.ts` | shared base-URL guard + known-record constants |
| `playwright.config.ts` | config; base URL from env only |
| `package.json` | `test`, `test:headed` scripts |
| `tsconfig.json` | type-check config |

## Dataset reference

- data.gov.sg dataset `d_add23c06f7267e799185c79ccaa2099b`.
- Field names used in assertions where possible: `NAME`,
  `ADDRESSBLOCKHOUSENUMBER`, `ADDRESSSTREETNAME`, `ADDRESSPOSTALCODE`,
  `TELEPHONE`, `EMAIL`, `geometry.coordinates` `[lon, lat]`.
- Example known record: `Lakeside Family Centre (Jurong West)`.

## Env vars

| Var | Required | Purpose |
|---|---|---|
| `APP_BASE_URL` | yes | Published app URL: the app root or a screen, e.g. `https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/` |

Do not commit secrets. No credentials are needed for the public screens.
Optional: `SGFSF_ADMIN_USER` / `SGFSF_ADMIN_PASS` (a CentreAdmin test user) enable the logged-in admin test.
Do not hardcode a live URL — pass it via `APP_BASE_URL` at runtime.

## Run

```powershell
cd tests
npm install
$env:APP_BASE_URL = "https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/FindCentres"
npx playwright test --workers=1
```

Use `--workers=1`: the personal environment throttles under parallel
page loads (a `--workers=2` run showed transient load timeouts that pass
serially). The Search button (not bare fill+Tab) triggers search
deterministically; direction links are asserted via popup URL because O11
action links render `href="#"`. Data waits (`waitForData`,
`waitForSupportData`) click through transient upstream HTTP 429 error
states via Retry and keep polling (bounded — genuine breakage still
fails). data.gov.sg poll-downloads were observed throttled (429) on
16 Oct 2026 under burst load; the app degrades to partial results with a
visible warning by design.

Linux/macOS:

```bash
cd tests
npm install
APP_BASE_URL="https://<env>.outsystemsenterprise.com/SGFamilySupportFinder/FindCentres" npm test
```

Expected artefacts: Playwright HTML report (`npx playwright show-report`),
terminal pass/fail log. Record actual outcomes — do not fabricate results.

## Selectors

Selectors are intentionally generic (`searchbox` role, `listitem` role,
text patterns) and may need tightening after the first publish to match the
real O11 screen widget names. Keep changes minimal and deterministic.

## Mock policy

`api-error-retry.mock.spec.ts` aborts the browser-to-O11 screen-action call
(`POST .../screenservices/.../ActionGetFamilyServiceCentres*`) — NOT the
upstream data.gov.sg call. Rationale:
the O11 server action calls data.gov.sg server-side, so a `page.route`
intercept on a data.gov.sg URL would never fire in the browser and would be
a silent no-op. Aborting the screen-action channel exercises the genuine
app-level error path (`OnInitialize` exception handler → error state +
Retry → recovery to live records). The spec is filename- and
title-labelled `[MOCKED]` and must
never be presented as live-data evidence.

## Locator notes (post test-reviewer audit)

- O11 lists/tables render `<div>`s, so `getByRole('listitem')` is kept only
  as a fallback alongside NAME/postal-code text locators. After first
  publish, tighten to real widget hooks (e.g. `[data-testid="centre-card"]`).
- Specs assert a results-count label (`/\d+\s*(centres|results|found)/i`),
  a resolving loading indicator, a real address fragment
  (block/street/postal), and deterministic waits (`expect.poll`,
  `waitForFunction`) instead of fixed sleeps.
