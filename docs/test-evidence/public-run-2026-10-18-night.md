# Public test run, 18 Oct 2026, night (after the second round of module changes)

- **When:** 18 Oct 2026, 23:44:54–23:54:59 UTC (07:44–07:54 SGT on 19 Oct).
- **Against:** the live app, https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/,
  after the UI module publish at 23:22:50 UTC (`docs/SERVICE_STUDIO_CHANGES.md`, round 11).
- **How:** Playwright, Chromium, `--workers=1`, no login, in six batches of
  spec files (each batch under 300 s), `--reporter=list`.
- **Result: 75 passed, 0 failed, 1 skipped (76 tests).** The skip is the
  logged-in admin flow (`admin.spec.ts`), which needs the reviewer login and
  was not run. No test is marked as an expected failure any more: the
  stylesheet test in `page-health.spec.ts` (known defect D-CSS-01) now passes
  as a normal test.

| Batch | Spec files | Time (UTC) | Result |
|---|---|---|---|
| 0 | `accessibility` | 23:44:54–23:46:07 | 8 passed |
| 1 | `admin`, `api-error-retry.mock`, `app-loads`, `centre-details-panel`, `contact-directions`, `directory` | 23:46:07–23:47:52 | 14 passed, 1 skipped |
| 2 | `dropdowns`, `findsupport`, `hotline`, `listen`, `nearest`, `no-results` | 23:47:52–23:50:01 | 21 passed |
| 3 | `page-health`, `persistence-refresh`, `real-records`, `search`, `share-print` | 23:50:01–23:51:41 | 11 passed |
| 4 | `timezone`, `translations`, `ux-responsive`, `wizard` | 23:51:41–23:54:16 | 16 passed |
| 5 | `page-structure` | 23:54:16–23:54:59 | 5 passed |

**Test changes in this round:**
- New `tests/page-structure.spec.ts` (5 tests): the staff sign-in page is
  branded and has no dead links; Browse has one level 1 heading, a level 2
  directory heading and a level 3 heading per result; no emoji on the public
  screens; the page description and Open Graph tags are present after load;
  map attribution links are underlined.
- `tests/page-health.spec.ts`: `test.fail` removed from the stylesheet test.
- `tests/findsupport.spec.ts`: the landing test looks for the new Browse
  heading, "Find family support services".
- `tests/translations.spec.ts`: the 中文 Call links may start with 致电 or
  拨打; both are standard for "Call", and the Browse links use 致电.
- `tests/admin.spec.ts`: the sign-in button is found by "Sign in" or "Login".

**Earlier attempts the same night**, kept for the record: a run at
23:27–23:38 UTC, before the last two test updates above, had 2 failures, both
from text the module changes had renamed (the landing test still looked for
"Not sure where to start?", and the 中文 test expected 拨打 only). After the
update, those two spec files were re-run at 23:41–23:42 UTC: 14 passed. The
full run above is the one reported.

Screenshots of the live screens at 390 px and 1440 px after the publish are in
`docs/screenshots/review-2026-10-18-round2/`.
