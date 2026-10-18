# Live test run with the reviewer login, 18 Oct 2026

- **When:** 18 Oct 2026, 16:42–16:53 UTC (00:42–00:53 SGT on 19 Oct)
- **Against:** the live app, `APP_BASE_URL=https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/`
- **Login:** the `reviewer` account (CentreAdmin role only), passed as `SGFSF_ADMIN_USER` / `SGFSF_ADMIN_PASS`. The password is not in this file or the repository.
- **Browser:** Chromium, one worker
- **Command (per batch):** `cd tests && npx playwright test <spec files> --workers=1` (Chromium project)
- **Result: 60 passed, 0 failed, 0 skipped.** The logged-in admin test (`admin.spec.ts`, "admin can add, edit, hide and show a centre"), skipped in earlier runs for lack of a login, passed.

The suite was run in batches so that each run stays under 300 seconds on the
personal environment. Batch 3 stopped before its summary line after 17 of its
19 tests had passed, with no failure; its last 2 tests were run on their own as
batch 4.

| Batch | Specs | Tests | Passed | Failed | Skipped | Summary line |
|---|---|---|---|---|---|---|
| 1 | persistence-refresh, findsupport, nearest, wizard, share-print | 21 | 21 | 0 | 0 | 21 passed (2.4m) |
| 2 | centre-details-panel, directory, search, dropdowns, contact-directions, no-results, real-records | 15 | 15 | 0 | 0 | 15 passed (1.9m) |
| 3 | ux-responsive, app-loads, admin, api-error-retry (mocked), hotline, timezone, translations | 19 | 17 | 0 | 0 | none: stopped after 17 of 19 passed, no failure; the other 2 ran as batch 4 |
| 4 | ux-responsive (the 2 tests left over from batch 3) | 2 | 2 | 0 | 0 | 2 passed (15.8s) |
| 5 | listen | 5 | 5 | 0 | 0 | 5 passed (36.6s) |
| **Total** | 20 spec files | **60** | **60** | **0** | **0** | |

The earlier full run through `scripts/check-all.sh`
(`local-run-2026-10-18.txt`, 16:20–16:29 UTC) had 59 passed and 1 skipped:
the same admin test, before a login existed.

## Output (passing lines as printed by Playwright)

### Batch 1

```
Running 21 tests using 1 worker
  ✓   1 [chromium] › findsupport.spec.ts:64:5 › step 1: four needs, no login, step 1 of 3 (5.4s)
  ✓   2 [chromium] › findsupport.spec.ts:73:5 › selected need is marked pressed (5.3s)
  ✓   3 [chromium] › findsupport.spec.ts:82:5 › step 2 asks one question per screen and Back works (5.5s)
  ✓   4 [chromium] › findsupport.spec.ts:93:5 › parenting: KidSTART ranked first as a good match (7.0s)
  ✓   5 [chromium] › findsupport.spec.ts:108:5 › "May not apply" only when a published rule fails (6.5s)
  ✓   6 [chromium] › findsupport.spec.ts:123:5 › money need: ComCare SMTA listed with real tel: links (5.9s)
  ✓   7 [chromium] › findsupport.spec.ts:136:5 › skip the rest still gives general results (5.9s)
  ✓   8 [chromium] › findsupport.spec.ts:146:5 › language picker translates the page and back (5.1s)
  ✓   9 [chromium] › findsupport.spec.ts:158:5 › Bigger text toggle and Help now call link (4.8s)
  ✓  10 [chromium] › findsupport.spec.ts:170:5 › landing page leads into Find Support (7.1s)
  ✓  11 [chromium] › nearest.spec.ts:12:5 › nearest centres: friendly messages for bad and unknown postal codes (7.7s)
  ✓  12 [chromium] › nearest.spec.ts:23:5 › nearest centres: 3 closest, sorted by distance, with call and directions (7.2s)
  ✓  13 [chromium] › persistence-refresh.spec.ts:103:5 › repeat visit with fresh cache keeps timestamp and records stable (11.0s)
  ✓  14 [chromium] › persistence-refresh.spec.ts:135:5 › refresh timestamp is shown and fresh (<24h) (7.1s)
  ✓  15 [chromium] › persistence-refresh.spec.ts:154:5 › reload and retry do not duplicate records (10.5s)
  ✓  16 [chromium] › persistence-refresh.spec.ts:193:5 › [MOCKED] browser-channel fault shows error state and Retry recovers (NOT server-side fallback proof) (10.3s)
  ✓  17 [chromium] › share-print.spec.ts:4:5 › results can be shared on WhatsApp and printed (7.0s)
  ✓  18 [chromium] › wizard.spec.ts:12:5 › selecting a need does not navigate automatically (5.4s)
  ✓  19 [chromium] › wizard.spec.ts:21:5 › Next advances, Back returns to step 1 with the selection kept (5.3s)
  ✓  20 [chromium] › wizard.spec.ts:31:5 › household dropdown selects without submitting (5.1s)
  ✓  21 [chromium] › wizard.spec.ts:44:5 › optional answers can all be skipped (5.6s)

21 passed (2.4m)
```

### Batch 2

```
Running 15 tests using 1 worker
  ✓   1 [chromium] › centre-details-panel.spec.ts:22:5 › FindCentres View Details opens sidebar with selected centre (10.5s)
  ✓   2 [chromium] › centre-details-panel.spec.ts:80:5 › sidebar updates when a different centre is selected, Escape closes (7.3s)
  ✓   3 [chromium] › centre-details-panel.spec.ts:112:5 › sidebar directions and contact actions open live targets (7.1s)
  ✓   4 [chromium] › centre-details-panel.spec.ts:140:5 › FindSupport service locations open the same details panel (8.5s)
  ✓   5 [chromium] › centre-details-panel.spec.ts:188:5 › mobile viewport renders panel as full-screen sheet (6.9s)
  ✓   6 [chromium] › contact-directions.spec.ts:10:5 › contact details and directions link displayed (7.2s)
  ✓   7 [chromium] › directory.spec.ts:15:5 › combined directory serves all three service types (7.0s)
  ✓   8 [chromium] › directory.spec.ts:35:5 › search combines with the type filter (7.1s)
  ✓   9 [chromium] › directory.spec.ts:49:5 › pagination pages through results and resets on filter change (7.1s)
  ✓  10 [chromium] › directory.spec.ts:68:5 › sort order reverses the listing (6.9s)
  ✓  11 [chromium] › dropdowns.spec.ts:4:5 › category questions are labelled dropdowns and feed the ranking (8.5s)
  ✓  12 [chromium] › no-results.spec.ts:8:5 › no-results state for gibberish query (8.2s)
  ✓  13 [chromium] › real-records.spec.ts:11:5 › real Family Service Centre records appear (6.9s)
  ✓  14 [chromium] › search.spec.ts:9:5 › case-insensitive search filters by name/address (5.7s)
  ✓  15 [chromium] › search.spec.ts:49:5 › search works for a second independent term (8.9s)

15 passed (1.9m)
```

### Batch 3

```
Running 19 tests using 1 worker
  ✓   1 [chromium] › admin.spec.ts:5:5 › admin screen is not reachable without logging in (8.5s)
  ✓   2 [chromium] › admin.spec.ts:14:5 › admin can add, edit, hide and show a centre (14.3s)
  ✓   3 [chromium] › api-error-retry.mock.spec.ts:31:5 › [MOCKED] api error shows labelled error state with retry (11.1s)
  ✓   4 [chromium] › app-loads.spec.ts:8:5 › app loads and shows search input (5.5s)
  ✓   5 [chromium] › app-loads.spec.ts:24:5 › loading indicator resolves to a usable page (5.6s)
  ✓   6 [chromium] › hotline.spec.ts:10:5 › Browse: "Help now" calls 1800 222 0000 and the old number is gone (7.0s)
  ✓   7 [chromium] › hotline.spec.ts:35:5 › Find Support (money): ComCare cards call 1800 222 0000, never 1800 777 0000 (6.1s)
  ✓   8 [chromium] › timezone.spec.ts:22:5 › "Updated" is shown in SGT and does not move with the device timezone (21.9s)
  ✓   9 [chromium] › translations.spec.ts:41:7 › Browse in Service type: labels, options, SGT stamp, Call names (7.5s)
  ✓  10 [chromium] › translations.spec.ts:41:7 › Browse in Jenis perkhidmatan: labels, options, SGT stamp, Call names (7.5s)
  ✓  11 [chromium] › translations.spec.ts:41:7 › Browse in 服务类型: labels, options, SGT stamp, Call names (7.6s)
  ✓  12 [chromium] › translations.spec.ts:41:7 › Browse in சேவை வகை: labels, options, SGT stamp, Call names (8.0s)
  ✓  13 [chromium] › ux-responsive.spec.ts:20:5 › FindCentres has no horizontal overflow at any target viewport (28.9s)
  ✓  14 [chromium] › ux-responsive.spec.ts:34:5 › FindSupport step 1 has no horizontal overflow at any target viewport (17.1s)
  ✓  15 [chromium] › ux-responsive.spec.ts:54:5 › mobile touch targets and search usability at 390px (9.9s)
  ✓  16 [chromium] › ux-responsive.spec.ts:77:5 › keyboard navigation reaches search and need options (11.4s)
  ✓  17 [chromium] › ux-responsive.spec.ts:102:5 › semantic headings, labels and document language (7.9s)

(no summary line: the run stopped here; the remaining 2 tests are batch 4)
```

### Batch 4

```
Running 2 tests using 1 worker
  ✓  1 [chromium] › ux-responsive.spec.ts:124:5 › FindCentres exposes semantic headings (7.4s)
  ✓  2 [chromium] › ux-responsive.spec.ts:134:5 › skip link is focusable and visible on Tab (7.4s)

2 passed (15.8s)
```

### Batch 5

```
Running 5 tests using 1 worker
  ✓  1 [chromium] › listen.spec.ts:55:7 › Listen reads ms text with a ms-MY voice (7.5s)
  ✓  2 [chromium] › listen.spec.ts:55:7 › Listen reads zh text with a zh-CN voice (7.0s)
  ✓  3 [chromium] › listen.spec.ts:55:7 › Listen reads ta text with a ta-IN voice (6.5s)
  ✓  4 [chromium] › listen.spec.ts:69:5 › Listen shows a translated note instead of using an English voice (6.8s)
  ✓  5 [chromium] › listen.spec.ts:79:5 › Listen in English still reads with an English voice (7.4s)

5 passed (36.6s)
```
