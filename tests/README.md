# SG Family Support Finder — Playwright tests

> Status at last serial run (`--workers=1`): **30 passed, 0 failed**
> against the published apps
> (`APP_BASE_URL` = FindCentres URL; FindSupport/panel specs derive their URLs),
> including a visibly rendering embedded map and the four enabled persistence
> specs. Run with `--workers=1` — the personal environment
> throttles under parallel page loads. Eight FindCentres specs (seven live +
> one labelled `[MOCKED]` screenservices-abort error/retry) plus six
> FindSupport specs (form, per-category live records, input neutrality,
> referral popups, nav both ways). HTML report in `playwright-report/` (generated, gitignored).

## Layout

| File | Covers |
|---|---|
| `app-loads.spec.ts` | (1) app loads + search input visible; loading indicator resolves |
| `real-records.spec.ts` | (2) real Family Service Centre records appear (live data) + results count |
| `search.spec.ts` | (3) case-insensitive search (`lakeside` variants + independent `tampines` term) |
| `no-results.spec.ts` | (4) no-results / empty state |
| `contact-directions.spec.ts` | (5) contact details (TELEPHONE/EMAIL) + address fragment + directions link |
| `api-error-retry.mock.spec.ts` | (6) **[MOCKED]** offline/browser-channel error + retry (labelled mock, not live evidence) |
| `findsupport.spec.ts` | (7) FindSupport: form loads, per-category guidance + live SSO/FSC/SFP records, income/household neutrality, official-link popups, nav both ways |
| `persistence-refresh.spec.ts` | (9) persistence: repeat visit keeps `Updated …` timestamp + records stable (zero-refetch observable), timestamp parses and is <24h fresh, reload + Retry keep row-count and name-set identical, `[MOCKED]` browser-channel fault + Retry recovery (labelled mock, not server-side-fallback proof) |
| `ux-responsive.spec.ts` | (8) responsive + a11y: zero horizontal overflow on both screens at 320/375/390/768/1024/1280/1440, 390px touch targets, keyboard reach, labels/`lang`/title/skip-link presence, semantic headings + focusable skip link (former `D-A11Y-01/02` gaps, now hard assertions) |
> NOTE (Oct 2026): `D-A11Y-01/02` were `test.fail`-tracked while the app lacked heading roles and the layout flag; both now pass as hard assertions. If either regresses, reinstate `test.fail` rather than deleting the test.
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
| `APP_BASE_URL` | yes | Published app URL, e.g. `https://<env>.outsystemsenterprise.com/SGFamilySupportFinder/FindCentres` |

Do not commit secrets. No credentials are needed (public screen, no auth).
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
