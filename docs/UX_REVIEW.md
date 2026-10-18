# UX and accessibility review, 18 Oct 2026

A review of the live public site as an assessor would see it, on a phone
(390 px wide) and on desktop (1440 px), done on 18 Oct 2026 between 18:29 and
19:07 UTC. Every finding below was observed on the live app; the evidence is
named beside it. The staff screen was reviewed only from the logged-out side
(the sign-in page) and from the module structure documented in the README; the
logged-in admin screen was not opened for this review.

Screenshots: `docs/screenshots/review-2026-10-18/`.

## Score

**Public site: 8 / 10.** Unchanged by this round, because no change was made
to the modules (see "Next Service Studio changes").

What earns it:
- Real, attributed data: 94 records from three MSF datasets, with the source,
  the licence and an "Updated … SGT" stamp on every list, and results framed
  as indicative.
- Accessibility basics hold up under an automated check: axe-core (WCAG 2.0
  and 2.1, levels A and AA) reports **0 violations** on every public screen
  state at 390 px and 1440 px, in all four languages, and on the sign-in page
  (`tests/accessibility.spec.ts`, 8 tests). Labels, focus, `lang`, a skip link
  and landmarks are in place (`tests/ux-responsive.spec.ts`).
- No horizontal overflow from 320 to 1440 px, 44 px and larger touch targets,
  a full-screen details sheet on phones.
- Empty, error-with-Retry and stale-data states exist and are tested.
- Speed is fine once the environment is awake: a repeat visit to Browse shows
  results in about 1.5 s on a phone-sized viewport (1,553 ms and 1,427 ms
  measured at 18:31 UTC; the test budget is 5 s). The first visit after the
  personal environment has idled took 6.7 s.

What holds it back (most visible first):

| # | Finding | Where | Evidence |
|---|---|---|---|
| 1 | The staff sign-in page is the unstyled template: a placeholder "Te" logo, the module name "SGFamilySupportFinder" as its heading, a page title of just "Login", and a "Forgot password?" link that goes to `#`. It is the first thing a reviewer sees after opening `/CentreAdmin`. | UI module, `Login` screen | `staff-sign-in-1440.png`; link target read from the live page |
| 2 | Every screen asks for `css/SGFamilySupportFinder.SGFamilySupportTheme.extra.css`, which the server answers with a 404 HTML page, so the browser console shows "Refused to apply style" on every screen. The visible theme (`SGFamilySupportTheme.css`, 53 KB) loads, so nothing looks broken, but anyone who opens the developer tools sees red errors. Known defect **D-CSS-01**. The cause is not verified: the screens list the file as a dependency (`View.getCssDependencies` in the published screen scripts), but the server has no such file. | UI module, theme `SGFamilySupportTheme` | `tests/page-health.spec.ts` (tracked with `test.fail`) |
| 3 | Emoji are used as icons (globe, telephone, speaker, money bag, family, child, handshake). Most are hidden from screen readers (`aria-hidden="true"`), but the speaker in "Listen" is read out, and emoji render differently on each phone. Plain text or the OutSystems UI icon set would match the Singapore Government Design System look the app follows. | UI module, `AccessBar`, Find Support step 1, results | live page scan of emoji text nodes |
| 4 | Browse has one heading on the whole page, "Not sure where to start?" (level 1). The directory itself has no heading, and result names are plain text, so screen-reader users cannot jump between the 10 results by heading. | UI module, `FindCentres` | heading list read from the live page |
| 5 | On Find Support, the question heading and the Listen button sit at the page edge while the rest of the step is in the centred content column (visible at 1440 px; at 390 px the need buttons are indented further than the rest). | UI module, `FindSupport` step 1 | `find-support-step1-1440.png` |
| 6 | No `meta description` or Open Graph tags, so a shared link (the app's own "Share on WhatsApp" sends the app link) previews with the page title only. Reactive apps render in the browser, so this needs a platform-level setting; whether this environment allows it is not verified. | UI module | page head read from the live page |
| 7 | An unknown address under the app (for example `/SGFamilySupportFinder/NoSuchPage`) shows the web server's plain "404 - File or directory not found" page, not an app page with a way back. | platform / web server | screenshot taken during the review |
| 8 | In the map inside the details panel, the "Leaflet" attribution link is blue on dark grey text with no underline (about 2.6:1 between link and text). axe lists it for manual review, not as a violation. | UI module, `CentreDetailsPanel` | axe "needs review" output |

**Staff screen: not scored in this review.** The sign-in page is item 1 above.
The role check on the server, the audit log and the hide-instead-of-delete
rule are described in the README and were last exercised by the logged-in test
run on 18 Oct 2026, 16:42–16:53 UTC (`docs/test-evidence/reviewer-run-2026-10-18.md`).

## What changed in this round

All changes are in this repository; none in the modules.

1. **Automated WCAG check.** `tests/accessibility.spec.ts` runs axe-core with
   the WCAG 2.0 and 2.1 A and AA rule sets on Browse, the details panel, the
   no-results state, all three Find Support steps, Browse in Bahasa Melayu,
   中文 and தமிழ், and the sign-in page, at 390 px and 1440 px. Any violation
   fails the test and prints the rule and the elements. The check was shown to
   catch real faults by injecting three into the live page (see the evidence
   file).
2. **Page health.** `tests/page-health.spec.ts` checks that the public screens
   raise no uncaught script errors, that every app stylesheet and script loads
   (currently an expected failure, D-CSS-01), and that Browse shows results
   within 5 s on a repeat visit at 390 px.
3. **This review**, with the fix list below, so the next set of module changes
   is already decided.
4. **README corrections:** the latest results, the new specs, and the commit
   reference for the 16:20 UTC run (it named a commit ID from before the
   history was rewritten).
5. **Type check clean:** `tsc --noEmit` in `tests/` reported one implicit
   `any` in `nearest.spec.ts`; fixed, and the spec re-run (2 passed).

Test evidence for this round: `docs/test-evidence/public-run-2026-10-18-evening.md`.

## Next Service Studio changes

In order of value. Each is small, and each has a test that will show it worked.

| # | Module, element | Change | Test that proves it |
|---|---|---|---|
| 1 | UI, `Login` screen | Replace the placeholder logo with the app mark, set the heading to "Staff sign-in", set the screen title to "Staff sign-in - SG Family Support Finder", remove the "Forgot password?" link (password resets are done by an administrator in the Users app), and add a "Back to the public site" link. | add an assertion to `admin.spec.ts` (logged-out test) for the heading and the absence of `href="#"` |
| 2 | UI, theme `SGFamilySupportTheme` | Find why the screens depend on `…SGFamilySupportTheme.extra.css` (theme settings, then a full republish of the UI module) and remove the dependency or publish the file. | `page-health.spec.ts`: remove `test.fail` once the test passes |
| 3 | UI, `FindCentres` | Add a level 1 heading "Find support services" above the search, make "Not sure where to start?" a level 2 heading, and give each result name `role="heading"` with `aria-level="3"`. | extend the heading test in `ux-responsive.spec.ts` |
| 4 | UI, `AccessBar`, `FindSupport`, results | Replace emoji with text or OutSystems UI icons marked `aria-hidden="true"`; keep the visible words. | `accessibility.spec.ts` plus a check that no emoji text is exposed to assistive technology |
| 5 | UI, `FindSupport` step 1 | Put the question heading and the Listen button inside the same content container as the steps. | screenshot comparison at 390 px and 1440 px |
| 6 | UI, `CentreDetailsPanel` | Underline links in the map attribution (`.leaflet-control-attribution a { text-decoration: underline; }`). | axe no longer lists `link-in-text-block` for review |
