# Live test run, public specs, 18 Oct 2026 (evening)

- **When:** 18 Oct 2026, 18:48–19:04 UTC (02:48–03:04 SGT on 19 Oct)
- **Against:** the live app, `APP_BASE_URL=https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/`
- **Login:** none. `SGFSF_ADMIN_USER` / `SGFSF_ADMIN_PASS` were not set, so the
  logged-in admin flow (`admin.spec.ts`, "admin can add, edit, hide and show a
  centre") was skipped and not re-run in this round. Its last pass is in
  `reviewer-run-2026-10-18.md`. The logged-out redirect test in the same file ran
  and passed.
- **Browser:** Chromium (Playwright 1.64.1), one worker
- **Command (per batch):** `cd tests && npx playwright test <spec files> --workers=1 --project=chromium --reporter=list`
- **Result: 70 passed, 0 failed, 1 skipped (71 tests, 22 spec files).** The 70
  include one expected failure: `page-health.spec.ts` "every app stylesheet and
  script on the public screens loads" is marked `test.fail` because it tracks
  the known defect D-CSS-01 (see `docs/UX_REVIEW.md`). Playwright prints it
  with a cross and counts it as passed, because it failed as expected. If it
  ever passes, Playwright reports it as a failure so that the marker is removed.

## Batches

| Batch | Specs | Tests | Passed | Failed | Skipped | Summary line |
|---|---|---|---|---|---|---|
| 1 (18:48–18:50) | admin, api-error-retry (mocked), app-loads, centre-details-panel, contact-directions, directory | 15 | 14 | 0 | 1 | 1 skipped, 14 passed (1.8m) |
| 2 (18:50–18:52) | dropdowns, findsupport, hotline, listen, nearest, no-results | 21 | 21 | 0 | 0 | 21 passed (2.1m) |
| 3 (18:53–18:55) | persistence-refresh, real-records, search, share-print, timezone, translations | 13 | 13 | 0 | 0 | 13 passed (2.1m) |
| 4 (18:55–18:57) | ux-responsive, wizard | 11 | 11 | 0 | 0 | 11 passed (1.8m) |
| 5 (19:01–19:03) | accessibility (new) | 8 | 8 | 0 | 0 | 8 passed (1.2m) |
| 6 (19:03–19:04) | page-health (new) | 3 | 3 | 0 | 0 | 3 passed (31.5s), one of them the expected failure for D-CSS-01 |
| **Total** | 22 spec files | **71** | **70** | **0** | **1** | |

Batches 1 to 4 are the 20 existing spec files, unchanged; they also gave the same
result (59 passed, 1 skipped) in a run earlier the same evening, 18:37–18:45 UTC.

### A red run found and fixed during this round

The first combined run of the two new specs (18:57–18:59 UTC) failed one test:
`accessibility.spec.ts` "Browse, details panel and no-results state pass axe at
390px" reported `color-contrast` on `.leaflet-popup-content` and
`link-in-text-block` on the map's Leaflet attribution link. Re-checking the same
panel after the map had finished loading gave 0 violations at 390 px and
1440 px (computed popup text `rgb(51, 51, 51)` on `rgb(255, 255, 255)`). The scan
had run while Leaflet was still fading the popup in, when the measured
colours are blended. The test now waits for the popup to reach full opacity
before it scans. After the change the spec passed 8 of 8 in two consecutive
runs (19:00–19:01 and 19:01–19:03 UTC); batch 5 above is the second one.

### The axe check catches real problems

To prove the scan is not vacuous, the same axe configuration was run on the
live Browse screen with three faults injected into the page (an image with no
`alt`, an input with no label, light grey text on white). It reported
`color-contrast`, `image-alt` and `label`. On the unmodified page it reported
25 rules passed, 0 violations, and 1 item for manual review (`color-contrast`,
1 element).

### Type check

`cd tests && npx tsc --noEmit -p tsconfig.json` reported one error before this
round, in `nearest.spec.ts` (`TS7006: Parameter 'page' implicitly has an 'any'
type`). The helper now declares `page: Page`; the type check exits 0, and
`nearest.spec.ts` was re-run on its own at 19:12:15 UTC: 2 passed.

## Output (as printed by Playwright)

### Batch 1

```
Running 15 tests using 1 worker
  ✓   1 [chromium] › admin.spec.ts:5:5 › admin screen is not reachable without logging in (8.6s)
  -   2 [chromium] › admin.spec.ts:14:5 › admin can add, edit, hide and show a centre
  ✓   3 [chromium] › api-error-retry.mock.spec.ts:31:5 › [MOCKED] api error shows labelled error state with retry (10.4s)
  ✓   4 [chromium] › app-loads.spec.ts:8:5 › app loads and shows search input (5.4s)
  ✓   5 [chromium] › app-loads.spec.ts:24:5 › loading indicator resolves to a usable page (5.2s)
  ✓   6 [chromium] › centre-details-panel.spec.ts:22:5 › FindCentres View Details opens sidebar with selected centre (11.0s)
  ✓   7 [chromium] › centre-details-panel.spec.ts:80:5 › sidebar updates when a different centre is selected, Escape closes (7.2s)
  ✓   8 [chromium] › centre-details-panel.spec.ts:112:5 › sidebar directions and contact actions open live targets (7.4s)
  ✓   9 [chromium] › centre-details-panel.spec.ts:140:5 › FindSupport service locations open the same details panel (8.1s)
  ✓  10 [chromium] › centre-details-panel.spec.ts:188:5 › mobile viewport renders panel as full-screen sheet (7.3s)
  ✓  11 [chromium] › contact-directions.spec.ts:10:5 › contact details and directions link displayed (7.2s)
  ✓  12 [chromium] › directory.spec.ts:15:5 › combined directory serves all three service types (7.1s)
  ✓  13 [chromium] › directory.spec.ts:35:5 › search combines with the type filter (7.3s)
  ✓  14 [chromium] › directory.spec.ts:49:5 › pagination pages through results and resets on filter change (7.0s)
  ✓  15 [chromium] › directory.spec.ts:68:5 › sort order reverses the listing (7.0s)
  1 skipped
  14 passed (1.8m)
```

### Batch 2

```
Running 21 tests using 1 worker
  ✓   1 [chromium] › dropdowns.spec.ts:4:5 › category questions are labelled dropdowns and feed the ranking (7.5s)
  ✓   2 [chromium] › findsupport.spec.ts:64:5 › step 1: four needs, no login, step 1 of 3 (4.7s)
  ✓   3 [chromium] › findsupport.spec.ts:73:5 › selected need is marked pressed (4.2s)
  ✓   4 [chromium] › findsupport.spec.ts:82:5 › step 2 asks one question per screen and Back works (5.4s)
  ✓   5 [chromium] › findsupport.spec.ts:93:5 › parenting: KidSTART ranked first as a good match (6.8s)
  ✓   6 [chromium] › findsupport.spec.ts:108:5 › "May not apply" only when a published rule fails (6.6s)
  ✓   7 [chromium] › findsupport.spec.ts:123:5 › money need: ComCare SMTA listed with real tel: links (6.3s)
  ✓   8 [chromium] › findsupport.spec.ts:136:5 › skip the rest still gives general results (5.8s)
  ✓   9 [chromium] › findsupport.spec.ts:146:5 › language picker translates the page and back (4.6s)
  ✓  10 [chromium] › findsupport.spec.ts:158:5 › Bigger text toggle and Help now call link (3.9s)
  ✓  11 [chromium] › findsupport.spec.ts:170:5 › landing page leads into Find Support (7.3s)
  ✓  12 [chromium] › hotline.spec.ts:10:5 › Browse: "Help now" calls 1800 222 0000 and the old number is gone (7.0s)
  ✓  13 [chromium] › hotline.spec.ts:35:5 › Find Support (money): ComCare cards call 1800 222 0000, never 1800 777 0000 (5.8s)
  ✓  14 [chromium] › listen.spec.ts:55:7 › Listen reads ms text with a ms-MY voice (5.2s)
  ✓  15 [chromium] › listen.spec.ts:55:7 › Listen reads zh text with a zh-CN voice (5.8s)
  ✓  16 [chromium] › listen.spec.ts:55:7 › Listen reads ta text with a ta-IN voice (5.6s)
  ✓  17 [chromium] › listen.spec.ts:69:5 › Listen shows a translated note instead of using an English voice (5.3s)
  ✓  18 [chromium] › listen.spec.ts:79:5 › Listen in English still reads with an English voice (6.2s)
  ✓  19 [chromium] › nearest.spec.ts:12:5 › nearest centres: friendly messages for bad and unknown postal codes (8.2s)
  ✓  20 [chromium] › nearest.spec.ts:23:5 › nearest centres: 3 closest, sorted by distance, with call and directions (7.2s)
  ✓  21 [chromium] › no-results.spec.ts:8:5 › no-results state for gibberish query (5.4s)
  21 passed (2.1m)
```

### Batch 3

```
Running 13 tests using 1 worker
  ✓   1 [chromium] › persistence-refresh.spec.ts:103:5 › repeat visit with fresh cache keeps timestamp and records stable (10.9s)
  ✓   2 [chromium] › persistence-refresh.spec.ts:135:5 › refresh timestamp is shown and fresh (<24h) (7.3s)
  ✓   3 [chromium] › persistence-refresh.spec.ts:154:5 › reload and retry do not duplicate records (10.9s)
  ✓   4 [chromium] › persistence-refresh.spec.ts:193:5 › [MOCKED] browser-channel fault shows error state and Retry recovers (NOT server-side fallback proof) (11.1s)
  ✓   5 [chromium] › real-records.spec.ts:11:5 › real Family Service Centre records appear (6.9s)
  ✓   6 [chromium] › search.spec.ts:9:5 › case-insensitive search filters by name/address (9.1s)
  ✓   7 [chromium] › search.spec.ts:49:5 › search works for a second independent term (8.9s)
  ✓   8 [chromium] › share-print.spec.ts:4:5 › results can be shared on WhatsApp and printed (6.9s)
  ✓   9 [chromium] › timezone.spec.ts:22:5 › "Updated" is shown in SGT and does not move with the device timezone (21.6s)
  ✓  10 [chromium] › translations.spec.ts:41:7 › Browse in Service type: labels, options, SGT stamp, Call names (7.8s)
  ✓  11 [chromium] › translations.spec.ts:41:7 › Browse in Jenis perkhidmatan: labels, options, SGT stamp, Call names (7.4s)
  ✓  12 [chromium] › translations.spec.ts:41:7 › Browse in 服务类型: labels, options, SGT stamp, Call names (7.4s)
  ✓  13 [chromium] › translations.spec.ts:41:7 › Browse in சேவை வகை: labels, options, SGT stamp, Call names (7.3s)
  13 passed (2.1m)
```

### Batch 4

```
Running 11 tests using 1 worker
  ✓   1 [chromium] › ux-responsive.spec.ts:20:5 › FindCentres has no horizontal overflow at any target viewport (28.6s)
  ✓   2 [chromium] › ux-responsive.spec.ts:34:5 › FindSupport step 1 has no horizontal overflow at any target viewport (14.3s)
  ✓   3 [chromium] › ux-responsive.spec.ts:54:5 › mobile touch targets and search usability at 390px (9.9s)
  ✓   4 [chromium] › ux-responsive.spec.ts:77:5 › keyboard navigation reaches search and need options (10.3s)
  ✓   5 [chromium] › ux-responsive.spec.ts:102:5 › semantic headings, labels and document language (7.0s)
  ✓   6 [chromium] › ux-responsive.spec.ts:124:5 › FindCentres exposes semantic headings (7.1s)
  ✓   7 [chromium] › ux-responsive.spec.ts:134:5 › skip link is focusable and visible on Tab (7.0s)
  ✓   8 [chromium] › wizard.spec.ts:12:5 › selecting a need does not navigate automatically (5.3s)
  ✓   9 [chromium] › wizard.spec.ts:21:5 › Next advances, Back returns to step 1 with the selection kept (5.1s)
  ✓  10 [chromium] › wizard.spec.ts:31:5 › household dropdown selects without submitting (5.9s)
  ✓  11 [chromium] › wizard.spec.ts:44:5 › optional answers can all be skipped (5.3s)
  11 passed (1.8m)
```

### Batch 5

```
Running 8 tests using 1 worker
  ✓  1 [chromium] › accessibility.spec.ts:45:7 › Browse, details panel and no-results state pass axe at 390px (10.6s)
  ✓  2 [chromium] › accessibility.spec.ts:83:7 › Find Support steps 1 to 3 pass axe at 390px (8.6s)
  ✓  3 [chromium] › accessibility.spec.ts:45:7 › Browse, details panel and no-results state pass axe at 1440px (10.8s)
  ✓  4 [chromium] › accessibility.spec.ts:83:7 › Find Support steps 1 to 3 pass axe at 1440px (7.7s)
  ✓  5 [chromium] › accessibility.spec.ts:105:7 › Browse in Bahasa Melayu passes axe at 390px (8.1s)
  ✓  6 [chromium] › accessibility.spec.ts:105:7 › Browse in 中文 passes axe at 390px (8.0s)
  ✓  7 [chromium] › accessibility.spec.ts:105:7 › Browse in தமிழ் passes axe at 390px (8.1s)
  ✓  8 [chromium] › accessibility.spec.ts:119:5 › staff sign-in screen passes axe at 390px (7.0s)
  8 passed (1.2m)
```

### Batch 6

```
Running 3 tests using 1 worker
  ✓  1 [chromium] › page-health.spec.ts:30:5 › public screens raise no uncaught script errors (10.3s)
  ✘  2 [chromium] › page-health.spec.ts:54:5 › every app stylesheet and script on the public screens loads (10.6s)
  ✓  3 [chromium] › page-health.spec.ts:67:5 › Browse shows results within 5 s on a repeat visit at 390px (9.9s)
  3 passed (31.5s)
```
