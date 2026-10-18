# Service Studio changes: wizard personalisation and UI/UX pass

Applied through the OutSystems 11 Service Studio model API (`applyModelApiCode` → `omlMerge`) on 2026-10-17 (SGT 11:00–12:00).

**Status**
- **Merged in Service Studio:** all three modules are open. CS and UI were changed; LIB has no changes.
- **Validation (Service Studio `getValidationMessages` after the final merge):**
  - SGFamilySupport_CS: 0 errors, 2 warnings. These are the pre-existing scalability warnings.
  - SGFamilySupportFinder: 0 errors, 17 warnings. The baseline was 20 (pre-existing roles, performance and security warnings). Three "unused element" warnings were removed by deleting dead elements (see UI-14).
- **Published** in order CS → UI. LIB was unchanged, so it was not republished. After the CS publish, UI references were refreshed (`omlRefreshReferences`) before the UI publish. Every publish returned `success`.
- **Live check:** `FindCentres` and `FindSupport` both return HTTP 200. The live theme CSS contains the marker class `.sgsf-pass-20261017`.
- **Playwright** against the live app:
  - `findsupport.spec.ts` + `wizard.spec.ts`: 16/16 pass.
  - Full-suite result: see the end of this file.

> Note on the sidecar validation: when the Model API runner validates a theme edit, it reports `Invalid Icon Library` on theme `Test`. This is a known sidecar artefact; the theme's IconLibrary stays null as before. Service Studio's own validation of the merged module does not report it, and the 0 errors above come from Service Studio.

---

## SGFamilySupport_CS

### CS-1 Static Entity `SchemeCatalogue`: new attributes
**What**
- Added 7 attributes:
  - `Categories` (Text 100): comma-separated needs, e.g. `family,parenting`.
  - `PciCap` (Integer): published per-capita monthly income cap; 0 means no cap.
  - `HouseholdIncomeCap` (Integer): published household monthly income cap; 0 means no cap.
  - `ResidencyRule` (Text 10): `SC` / `SC_PR` / `ANY`.
  - `EmploymentRule` (Text 20): `ANY` / `EMPLOYED` / `UNEMPLOYED` / `UNABLE`.
  - `BaseRank` (Integer).
  - `ThresholdNote` (Text 300): a source note shown beside the income comparison.
- The entity's Order By is now `BaseRank`.

**Why:** these let the ranking use the published rules instead of hard-coded text.

**Verify in Studio:** Data tab → Entities → Database → `SchemeCatalogue` → Attributes; Records tab.

**Verify in the app:** results cards show threshold notes such as "(kidstart.sg: either test)".

### CS-2 Static Entity `SchemeCatalogue`: records (15)
Verified on 2026-10-17 against the official pages listed in `InfoUrl`. Caps and rules:

| Code | Scheme | Categories | Residency | Employment | Household cap | PCI cap | Location link |
|---|---|---|---|---|---|---|---|
| SMTA | ComCare Short-to-Medium-Term Assistance | financial | SC_PR | ANY | – | $800 | SSO |
| IA | ComCare Interim Assistance | financial | SC_PR | ANY | – | $800 (applied flexibly until 31 Dec 2026) | SSO |
| LTA | ComCare Long-Term Assistance | financial | SC_PR | UNABLE | – | $800 | SSO |
| JSS | SkillsFuture Jobseeker Support | financial | SC_PR | UNEMPLOYED | not compared (own past income ≤ $5,000) | – | NONE |
| WIS | Workfare Income Supplement | financial | SC | EMPLOYED | not compared (own income ≤ $3,000) | – | NONE |
| SSOAPP | Social Service Office application channel | financial | ANY | ANY | – | – | SSO |
| COMLINK | ComLink+ | financial, parenting | ANY | ANY | – | – | SSO |
| FAM | Strengthening Families Programme (FAM), incl. FAM@FSC | family, parenting | ANY | ANY | – | – | SFP |
| FSC | Family Service Centre counselling and casework | family, parenting | ANY | ANY | – | – | FSC |
| KIDSTART | KidSTART | parenting | SC | ANY | $2,500 **or** | $650 | NONE |
| FFLP | Families for Life Parenting | parenting, family | ANY | ANY | – | – | NONE |
| BABYBONUS | Baby Bonus Scheme | parenting | SC | ANY | – | – | NONE |
| HCG | Home Caregiving Grant | caregiving | SC_PR | ANY | – | $4,800 | NONE |
| CTG | Caregivers Training Grant | caregiving | SC_PR | ANY | – | – | NONE |
| ENABLE | Enabling Guide (SG Enable) | caregiving | ANY | ANY | – | – | NONE |

- **Baby Bonus:** the record notes that the SG Child Support Package will replace it, so families should check the official page for the current scheme.
- **Not verified today:** FSC, SSOAPP and ENABLE are service entries carried over from the earlier catalogue. They are referral channels with no income test.

**Verify in Studio:** `SchemeCatalogue` → Records. There are 15 rows.

**Verify in the app:** Find Support → each need shows only the schemes in its category.

### CS-3 Structure `RankedRecommendation` (new, not public)
**What:** `Score` (Integer) + `Recommendation` (SchemeRecommendation).

**Why:** carries a score so results can be ordered without changing the public output structure.

**Verify in Studio:** Data tab → Structures → `RankedRecommendation`.

### CS-4 Server Action `GetSchemeRecommendations`: rebuilt in place
The signature and output are unchanged, so UI consumers needed no change.

**Flow:**
1. `NormaliseInputs` (Assign):
   - Need: the legacy `children` maps to `parenting`.
   - Income is parsed (`$` and `,` are stripped; negative or non-numeric means "not stated").
   - PCI = income ÷ household size.
   - Employment is normalised to employed / unemployed / unable / retired.
   - Residency is normalised to citizen / pr / other.
2. `GetSchemes` (Aggregate on SchemeCatalogue).
3. For each scheme, `MatchesNeed` (If): `Index("," + Categories + ",", "," + Need + ",") <> -1`.
4. `ScoreScheme` (Assign): computes the score, the notes, Relevance and Reasons (rules below).
5. Insertion into `Ranked` by score:
   - `StartAtTop` sets `Pos = 0`.
   - `MoreToCompare` checks `Pos < Ranked.Length`.
   - `RankedHigher` checks `Ranked[Pos].Score >= CurrentRanked.Score`; if so, `NextPosition` does `Pos + 1`.
   - `InsertRanked` calls `ListInsert`.
   - This replaces an earlier `ListSort` node, which did not reorder at runtime: the live results came back in Code order.
6. `ForEach` over Ranked → `ListAppend` to `Recommendations` → End. An `AllExceptions` handler sets `ErrorMessage`.

**Ranking rules** (all indicative; nothing is ever hidden because of a rule):

| Rule | Effect on score | Note shown on the card |
|---|---|---|
| Base | 100 − BaseRank × 3 | – |
| Income test, if the scheme has a cap and income is stated. KidSTART passes if household ≤ $2,500 **OR** PCI ≤ $650 | within: +30 / above: −40 | "Your household per-capita income appears to be about $X, within/above the typical threshold of $Y per person (source) - indicative only." The same wording is used for household income. |
| Workfare and Jobseeker Support | no household/PCI comparison (their tests use the person's own income) | – |
| PCI caps | SMTA, IA, LTA $800 (IA flexible to 31 Dec 2026); HCG $4,800 | as above |
| Residency `SC` | citizen +10, otherwise −50 | "You said you are a Singapore Citizen, which this scheme requires." / "This scheme is stated for Singapore Citizens, so it may not apply to you." |
| Residency `SC_PR` | citizen/PR +10, other −50 | "Your residency status meets this scheme's stated residency rule." / "…stated for Singapore Citizens and Permanent Residents, so it may not apply to you." |
| Employment `EMPLOYED` (WIS) | working +20, otherwise −40 | "You said you are working, which this scheme requires." |
| Employment `UNEMPLOYED` (JSS) | looking for work +30, working −30 | "You said you are looking for work, which this scheme is for." |
| Employment `UNABLE` (LTA) | unable +30, working −30 | "You said you are unable to work, which this scheme considers." |

**Relevance labels:**
- No step-2 input: "Potentially relevant", plus "Add household details in Step 2 for tailored notes."
- Otherwise: score ≥ 120 is "Likely relevant", ≥ 85 is "Potentially relevant", and anything lower is "May not apply - check details".

**Verify in Studio:** Logic tab → Server Actions → `GetSchemeRecommendations`. You should see the nodes named above, and no `SortByScore` node.

**Verify in the app:** Find Support → Parenting support → income 2000, size 4, Family with children, Working, Singapore Citizen → View results. KidSTART is first and marked "Likely relevant", with the note "…about $500, within the typical threshold of $650 per person…".

---

## SGFamilySupportFinder (UI)

All screen changes are on `MainFlow/FindSupport` unless stated otherwise. The containers referred to are the children of the `MainContent` placeholder, in order.

### UI-1 Step 1: Parenting as its own need
**What:**
- The need button "Children and parenting" is relabelled **"Parenting support"**; its `OnSelectNeed` argument is now `"parenting"`.
- All four need buttons have:
  - Style `"btn sgsf-choice" + If(NeedCategory = …, " sgsf-choice-on", "")`
  - `aria-pressed`
- Container style is `sgsf-wizard sgsf-need-grid`, a 2-column grid on ≥768px.
- The Continue button is `btn btn-primary sgsf-continue`.
- The "Selected: …" line has `aria-live=polite` and uses friendly labels.

**Verify in Studio:** FindSupport → MainContent → 3rd container (step "need").

**Verify in the app:** four cards; the selected one gets a tick, an emerald border and is announced as pressed.

### UI-2 Stepper and step heading
**What:**
- New container `sgsf-stepper` with three expressions (Need / Household / Results). Classes: `sgsf-step` plus `is-current` / `is-done`.
- The step line is `sgsf-step-head` with `aria-live`:
  - "Step 1 of 3: Choose your support need"
  - "Step 2 of 3: Tell us about your household (optional)"
  - "Step 3 of 3: Your indicative results"
- Header classes: `sgsf-page-title`, `sgsf-lead`.
- The disclaimer has `role=note` and reads "indicative, not an official eligibility decision".

**Verify in the app:** the pill bar at the top changes as you move between steps.

### UI-3 Step 2: household inputs
**What:**
- Income: label `sgsf-field-title`, hint `sgsf-hint`; the input has `aria-label` and `inputmode=decimal`.
- Household size label added; the input has `aria-label`.
- The Employment and Residency free-text inputs were replaced with segmented button groups (`sgsf-seg sgsf-seg-wrap`, `role=group`, `aria-pressed`):
  - Household type: Family with children / Single adult / Senior household / Other / prefer not to say.
  - Employment status: Working / Looking for work / Unable to work / Retired.
  - Residency: Singapore Citizen / Permanent Resident / Other.
- New Screen Actions `OnSelectEmployment` and `OnSelectResidency` (input `Value`). Each toggles the variable and clears `FormError`.
- Footer `sgsf-wizard-foot` with `BackToNeedButton2` ("Back") and `ViewResultsButton`.
- `FormError` moved last, with `role=alert`.

**Verify in the app:** chips toggle on and off; negative income shows "cannot be negative".

### UI-4 Step 3: result cards (`RecList`)
**What:** the list item (`sgsf-rec-card`) was rebuilt:
1. Header `sgsf-rec-head`:
   - Scheme name `sgsf-rec-title` (`role=heading`, `aria-level=3`).
   - Relevance pill `sgsf-pill` (`is-strong` = Likely, `is-weak` = May not apply).
2. Agency (`sgsf-rec-agency`).
3. "Why this may fit: …" (`sgsf-rec-why`).
4. Lines (`sgsf-rec-line`; empty lines are hidden): What it is, Eligibility considerations, To refine this check, What you may need, How to apply.
5. Actions (`sgsf-rec-actions`):
   - **Official information**: btn-primary; `aria-label` "Official information: <scheme> (opens in a new tab)"; calls `OpenSupportUrl(InfoUrl)`.
   - **Apply or enquire**: secondary; shown when `ApplyUrl` differs from `InfoUrl`.
   - **Find a nearby Social Service Office / Family Service Centre / FAM (SFP) location**: links to `FindCentres(ServiceType = LocationKind)`; shown when LocationKind is SSO, FSC or SFP.
6. Source line (`sgsf-rec-source`).

`RecList` also has the extended property `disable-virtualization=True`, so every card renders (at most 15); this was needed for tests and screen readers.

**Verify in Studio:** FindSupport → results container → … → `RecList` → its Container.

**Verify in the app:** each card shows the pill, the why-note and three action buttons.

### UI-5 Step 3: heading, count, states, locations
**What:**
- Heading "Your assistance recommendations (indicative only)": `sgsf-h2`, `role=heading`, `aria-level=2`.
- Lead: "Potentially relevant support based on your answers, most relevant first. This does not determine eligibility."
- New count line `sgsf-meta`: "N schemes shown, most relevant first…".
- Empty state: "No schemes in our catalogue match this need yet…".
- Loading (`sgsf-state sgsf-loading`, a spinner that respects reduced motion), error (`role=alert`, `sgsf-error`) and partial-warning (`sgsf-warn`) states are styled.
- The duplicate static ComCare block in the financial branch was removed; the SMTA, IA and LTA cards cover it.
- The location lists (SSOList, FSCList, SFPList) use `sgsf-card-grid` / `sgsf-card`, with headings such as "Where to go: Social Service Offices (24 locations, live data)".
- The family-locations `If` condition now includes `parenting`: `NeedCategory = "family" or NeedCategory = "parenting" or NeedCategory = "children"`.
- The caregiving referral box is styled as a card.
- Back and Start again buttons use `sgsf-btn-secondary`.

### UI-6 Browse link
**What:** the container above step 1 has class `sgsf-wizard sgsf-browse`. Its link text is "Or browse all support locations".

### UI-7 Screen `FindCentres`: ServiceType deep link
**What:**
- New Input Parameter `ServiceType` (Text, not mandatory, default "").
- New Assign `PresetServiceType` after Start in `OnInitialize2`. It sets `ServiceTypeFilter` when the value is FSC, SSO or SFP.

**Verify in the app:** `…/FindCentres?ServiceType=SSO` opens with "Type: SSO".

### UI-8 Screen `FindCentres`: layout and copy
**What:**
- The hero text now names all three types.
- Search hint: "Search by name, street or postal code."
- The search input has `aria-label`.
- The top and search containers lost their inline `max-width:1160px` styles and now use `sgsf-page` (plus `sgsf-page-head` / `sgsf-search-row`). The search field and button now sit on one row.

**Verify in the app:** title, hero, search, filters and cards all share the same left edge as the header logo.

### UI-9 Theme `Test`: StyleSheet additions
Appended blocks, each starting with a guard rule (`.ro-theme-guard12`…`15`). Marker: `.sgsf-pass-20261017`.
- **Wizard:** `sgsf-wizard`, `sgsf-intro`, `sgsf-page-title`, `sgsf-lead`, `sgsf-stepper`/`sgsf-step`/`is-current`/`is-done`, `sgsf-step-head`, `sgsf-need-grid`, `sgsf-choice` (+ `sgsf-choice-on`, tick via `content:"\2713" / ""` so it is not read out), `sgsf-continue`, `sgsf-field`, `sgsf-field-title`, `sgsf-hint`, `sgsf-seg-wrap`, `sgsf-wizard-foot`, `sgsf-btn-secondary`, `sgsf-answers`, `sgsf-disclaimer`, `sgsf-selected-line`.
- **Results:** `sgsf-h2`, `sgsf-loc-head`, `sgsf-meta`, `sgsf-state`/`sgsf-loading`/`sgsf-error`/`sgsf-warn`, `sgsf-rec-list`, `sgsf-rec-card`, `sgsf-rec-head`, `sgsf-rec-title`, `sgsf-pill` (+ `is-strong`/`is-weak`), `sgsf-rec-agency`, `sgsf-rec-why`, `sgsf-rec-line`, `sgsf-rec-actions`, `sgsf-link-btn`, `sgsf-rec-source`, `sgsf-referral`.
- **Directory:** `sgsf-page`, `sgsf-page-head`, `sgsf-search-row`. `sgsf-toolbar` changed from grid to flex-wrap, because the filter groups were misaligned. Card names are bold. Links and buttons have a ≥44px touch target.
- **Global fixes:**
  - `ThemeGrid_MarginGutter` is neutralised inside sgsf containers and cards (it was causing a stray left indent).
  - Content in `.content-middle` is aligned to the header gutter.
  - **Mobile header:** the default OSUI MenuIcon and ApplicationTitle are hidden. The `.header-navigation` height is now auto; before, it was 100vh and covered the page, intercepting taps on phones.
- **Contrast:** text colours on their backgrounds meet WCAG AA:
  - muted #52677A on white
  - #7A4A00 on #FFFBEB
  - #8A4B00 on #FFF4E5
  - #B42318 on #FEF3F2
  - white on emerald primary

**Verify in Studio:** Interface tab → Themes → `Test` → Style Sheet (search for `sgsf-pass-20261017`).

**Verify in the app:** at a phone width (390px), the header no longer overlaps and all buttons are tappable.

### UI-10 Dead elements removed (FindCentres)
**What:** local variables `AllCentres` and `TempFiltered`, and the screen action `ShowCentreDetails`. All three were flagged unused by validation.

**Why:** cleaner validation (20 → 17 warnings).

---

## Manual steps in Service Studio
- None required for the app to work.
- Optional: open the `Test` theme in Studio once and confirm the Icon Library setting is unchanged. It was untouched; this note only exists because of the sidecar's Invalid Icon Library message.
- The scheme facts were verified on 2026-10-17. Re-check thresholds after policy updates; ComCare IA flexibility ends 31 Dec 2026, and Baby Bonus is moving to the SG Child Support Package.

## Tests changed on this branch
- `docs/i18n/translator.js` carries the same `doText` line. The table file `docs/i18n/sgfsf-i18n.json` still holds the longer Tamil wording; the live table in the module has the short one.
- `tests/findsupport.spec.ts` was rewritten for the new behaviour:
  - parenting is its own need
  - pressed state
  - **parenting ranking test:** KidSTART is first, with the within-threshold PCI note
  - above-threshold flagging
  - employment and residency ranking
  - general results with no inputs
  - the "Find a nearby" deep link
  - family, caregiving and navigation
- `tests/wizard.spec.ts`: selectors updated ("Parenting support"; the household choice is checked via `aria-pressed`).

---

## Product pass (goal: "looks nice, functional for Singaporeans, real purpose")

Published CS → UI, 2026-10-17, around 12:15 SGT. Validation stayed at 0 errors (CS 2 warnings, UI 17 warnings). Facts come only from `sgfsf-schemes-verified.json` (official pages, checked 2026-10-17).

### PP-1 Landing (`FindCentres`): the problem, stated up front
**What changed:**
- **Page head (`sgsf-page sgsf-page-head`):** title "Not sure where to start? Find family support in under a minute." The subtitle explains the problem and spells out each acronym once: "Help in Singapore is spread across MSF, AIC, CPF, Social Service Offices (SSOs), Family Service Centres (FSCs) and Strengthening Families Programme (FAM) centres. Answer three questions to see what you may get and where to go. No login needed."
- **Calls to action (`sgsf-hero-box` → `sgsf-journeys`):**
  - Primary: **"Find support for my family"** → FindSupport (`btn btn-primary sgsf-journey sgsf-cta`).
  - Secondary: **"Browse centres"**, which clears the filters (`btn sgsf-btn-secondary sgsf-journey sgsf-cta`).
- **Old hero texts:** removed ("Find the right support, faster." and the duplicate blurb).
- **Search row:** now opens with the label "Or browse every centre: search by name, street or postal code" (`sgsf-search-label`; no digits, so the results-count test still finds the count label). The search field is full width on mobile.

**Why:** visitors immediately see who the app is for and the one thing to do next.

**Verify in Studio:** FindCentres → MainContent: the 1st container has two texts; the 2nd container is the CTA row; the search container starts with a Text.

**Verify in the app:** open `/FindCentres`; the headline and both buttons are visible above the fold at 390px and 1280px.

### PP-2 Find Support intro
**What changed:** the lead now reads "Help in Singapore is spread across many agencies and centres. Answer three quick questions to see schemes you may qualify for, what to do next and where to go. No login needed and nothing is stored."

### PP-3 CS: helplines in the catalogue and the output
**What changed:**
- `SchemeCatalogue`: new attributes `HelplineName` (Text 80) and `HelplinePhone` (Text 20). They are filled only where the verified data gives a number:

  | Code | Helpline |
  |---|---|
  | SMTA, LTA, IA | ComCare Hotline 1800 222 0000 |
  | SSOAPP | Social Service Office line 1800 777 0000 (corrected on 18 Oct 2026 to the ComCare Hotline 1800 222 0000, see Round 8) |
  | HCG, CTG | AIC Hotline 1800 650 6060 |
  | FAM | Divorce Support and Family Counselling 1800 111 2222 |
  | BABYBONUS | Baby Bonus hotline 1800 111 2222 |
  | COMLINK | MSF ComLink+ line 1800 111 2222 |
  | WIS | CPF Board 1800 227 1188 |
  | JSS | SkillsFuture Jobseeker Support hotline 6669 7932 |

  KidSTART, FFLP, FSC and ENABLE have no number, because the verified pages give none.
- Public Structure `SchemeRecommendation`: new attributes `HelplineName` and `HelplinePhone`.
- `GetSchemeRecommendations` → `ScoreScheme`: two new assignments copy them into `CurrentRec`.
- The UI references were refreshed after the CS publish.

**Verify in Studio:** `SchemeCatalogue` → Records → Helpline columns.

### PP-4 Result cards: actionable next step and a call button
**What changed:**
- "How to apply" is renamed **"What to do next: …"** (`sgsf-rec-next`, bold). The text is the official how-to-apply wording.
- A new line, "Helpline: <name>, <number>", appears when a number exists.
- A new action, **"Call <number>"**, appears when a number exists:
  - Style: `btn sgsf-btn-secondary sgsf-link-btn sgsf-tel`.
  - `aria-label`: "Call <helpline name> at <number>".
  - It opens `tel:<digits>` through `OpenSupportUrl`, the same pattern as the existing centre phone links.

**Verify in the app:** on the financial results, the SMTA card shows "Call 1800 222 0000".

### PP-5 Urgent-help strip on results
**What changed:** a new container `sgsf-urgent` (`role=note`) sits between the results count and the cards. It reads "Need help urgently? Call the ComCare Hotline:" followed by a link "1800 222 0000" (`tel:18002220000`, `aria-label` "Call the ComCare Hotline at 1800 222 0000").

The results order is now: heading → count → urgent strip → ranked cards → "Where to go" location lists.

### PP-6 Visual polish
- The primary CTA is now emerald with white text. It had been rendering as white text on pale green.
- **Mobile:**
  - The page title is 28px.
  - The search field and button are full width.
  - The header wraps cleanly.
- **Theme blocks:** `.ro-theme-guard16`…`19`.

### PP-7 Tests
`tests/findsupport.spec.ts` gained two tests:
- "results show what to do next, scheme helplines and the urgent ComCare hotline"
- "landing page states the problem and leads into Find Support"

### Not done (on purpose)
- **Postal-code "near me" sort:** skipped. The directory has no geocoding of user input. A distance sort would need a OneMap call (a new integration), so it is not cheap.

## Full-suite run (live app, after the product pass)
`npx playwright test` with `--workers=2` and `APP_BASE_URL=…/SGFamilySupportFinder/FindCentres`: **46/46 passed**. That is the 44 original specs plus the 2 new findsupport tests.
- The first full run had 2 failures in `persistence-refresh.spec.ts`. Cause: the new search label contained "94 centres", and the spec's count-label regex matched it.
- Fix: the label was reworded on the app side; the existing spec was not touched.
- After that, `persistence-refresh.spec.ts` + `app-loads.spec.ts` were re-run: 6/6 passed.

Screenshots from the live app (390px and 1280px) are kept outside the repo: landing, step 1 (parenting), step 2, parenting results, financial results with the urgent strip, the SSO deep link, and the details panel.


## Round 3 (2026-10-17, ~14:40–15:10 SGT): languages that actually translate, one-row header, short hero

Published live (UI module, 0 errors) after each step.

### R3-1 Why BM / 中文 / தமிழ் stayed in English
- The language buttons did switch the OutSystems locale (`SetCurrentLocale`), so the "Translated for convenience" note appeared.
- But the three Multilingual Locales (`ms`, `zh-CN`, `ta`) had **no translated text**. OutSystems only takes translations through Service Studio's import (Data tab → Multilingual Locales). The model API cannot write a translated value (a documented gap), so it fell back to English.

### R3-2 Fix: built-in translation table (works today)
- `AccessBar` → `ApplySavedPrefs` (OnReady, runs on every screen) now installs a small translator (JavaScript node) with a table of 374 UI strings × 3 languages (`docs/i18n/sgfsf-i18n.json`).
- It translates rendered English text, placeholders, `title` and `aria-label` in place, and keeps working when React re-renders (MutationObserver). Numbers are kept as placeholders, so "Question 2 of 5", amounts and phone numbers translate correctly.
- Switching back to English restores the original text. `<html lang>` follows the language (for screen readers and Listen).
- **Native first:** any text already in the target language (e.g. after a native translation import) is left untouched. So the native import can replace the table later with no code change.
- Official names stay in English (ComCare, SupportGoWhere, Singpass, MSF, SSO, FSC, scheme names).
- Accessibility: in a translated language, an `aria-label` that no longer contains the button's visible text is dropped, so the visible text names the control (WCAG 2.5.3 "label in name").
- `ChooseLanguage` now also closes the menu and re-applies the table right away.

### R3-3 Header redesigned (one clean row)
- **"Aa Bigger text"** toggle (`aria-pressed`, ✓ when on). Replaces the separate A / A+ boxes.
- **"🌐 Language ▾"** button that opens a 4-option menu (English / Bahasa Melayu / 中文 / தமிழ்). `aria-expanded`, current language marked ✓. Local variable `ShowLanguages`, action `ToggleLanguages`.
- **"📞 Help now: 1800 222 0000"** — a tidy emerald `tel:` pill (full width on phones).
- 48px targets; at 390px, Bigger text and Language share one row and Call sits under them.
- Theme blocks `.ro-theme-guard24`, `.ro-theme-guard25`.

### R3-4 Hero copy
- "Not sure where to start?" + one line: "Answer three short questions to see help you may get and where to go." (The long paragraph listing MSF/AIC/CPF/SSOs/FSCs/FAM was removed.)

### R3-5 Accessibility fixes from axe (live)
- `label-content-name-mismatch` (serious) on the urgent call link, A+ and the big results Call button: fixed (labels removed or rebuilt so the visible text is the name).

### R3-6 Refinements (live, 0 errors)
- Translation table grew to 500 strings per language: the module's own native texts (error messages, "May not apply", directions/map links, loading and retry messages) are now covered too.
- Wizard Back / Next buttons now line up; header nav links wrap instead of overflowing (Tamil).
- Tamil: slightly smaller button text so the big Call button and headings fit on one line at 390px.
- Native translation import file prepared outside the repo (sgfsf-translations.xlsx, one sheet per locale, 416/423 texts filled) with Service Studio steps (Data tab → Multilingual Locales → Export / Import Language Resources).
- Live check after publish, 4 languages × 390px + 1280px: 7 results and 9 `tel:` links on every run, 0 page errors, axe 0 violations on home, details, step 1, step 2 and results.

## Round 4 (2026-10-17, ~15:40–16:00 SGT): Tamil call buttons, bigger-text header, tap targets, tests

All changes are in the SGFamilySupportFinder (UI) module. Validated 0 errors (11 warnings) and published five times (15:48, 15:51, 15:55, 16:00, 16:07 SGT; the 16:00 publish only re-added the guard 29 rule). LIB and CS were not changed.

### R4-1 Tamil "Call" buttons fit on one line
- Problem: in Tamil with **Bigger text** on, the green ComCare call button on the results page broke its phone number over two lines at 390px.
- Translation table (ta): "ComCare-ஐ அழைக்கவும்" shortened to "ComCare அழைக்க" (same meaning, "Call ComCare").
- Built-in translator (`AccessBar.ApplySavedPrefs` JavaScript node, function `doText`): translated text now joins digit groups with a non-breaking space, so a number such as 1800 222 0000 never splits across lines in BM / 中文 / தமிழ். English text is untouched. One line added before `if (cur !== v) n.nodeValue = v;`:
  `v = v.replace(/(\d) (?=\d)/g, "$1\u00a0");`
- Theme `Test` (CSS guard 28): Tamil call buttons use 15–16px text and slightly tighter padding; `a[href^="tel:"]` never breaks inside words.
- Live check: every `tel:` button is one line (48px tall, no overflow) in Tamil with and without Bigger text; language round trip EN → TA → EN → BM → 中文 → TA keeps every label correct.

### R4-2 Bigger text / Language buttons no longer wrap (Tamil)
- CSS guard 28: header buttons `white-space: nowrap`; in Tamil they use 15px text and 10px padding so "Aa பெரிய எழுத்து" and "🌐 மொழி தமிழ்" each stay on one line with Bigger text on.

### R4-3 Bigger tap targets for small links (elderly pass)
- CSS guard 29: the "Edit your answers" link and the footer links (MSF ComCare, SG Enable, data.gov.sg dataset) are now at least 48px tall.

### R4-4 Tests
- `tests/centre-details-panel.spec.ts`: the v2 results page shows "Places that can help" as collapsed lists, so the test opens the first list before "View details".
- `docs/i18n/translator.js` carries the same `doText` line. The table file `docs/i18n/sgfsf-i18n.json` still holds the longer Tamil wording; the live table in the module has the short one.
- `tests/findsupport.spec.ts`, `tests/wizard.spec.ts`, `tests/ux-responsive.spec.ts`: updated for the one-question-per-screen flow (committed earlier in this round).
- Full live suite after the last publish: **42 / 42 passed** (run after the 15:51 publish).


### R4-5 Call buttons on one line in every language (later the same round)
- CSS guard 32 (Theme `Test`): the big ComCare call button on results uses 12px side padding; with **Bigger text** on it uses 18px text (it was 22px, so the number broke onto a second line in English and 中文); in BM it uses 15px (16px with Bigger text).
- Live check after publish (16:07 SGT), results page at 390px: the call button is on one line in EN (Bigger text), BM (normal and Bigger text), 中文 (Bigger text) and தமிழ் (Bigger text).
- Earlier live run after the 15:55 publish, 4 languages × 390px: 7 results and 9 `tel:` links each, 0 page errors, axe 0 violations.

### Screenshots (390px, live app)
- Tamil, Bigger text, results: `docs/screenshots/ta-390-big-results-call-oneline.png`
- Tamil, Bigger text, header: `docs/screenshots/ta-390-big-home-header.png`
- English, Bigger text, results: `docs/screenshots/en-390-big-results-call-oneline.png`
- BM, results: `docs/screenshots/ms-390-results-call-oneline.png`
- 中文, Bigger text, results: `docs/screenshots/zh-390-big-results-call-oneline.png`

### Optional native translations
- `docs/sgfsf-translations.xlsx`: one sheet per locale (ms, zh-CN, ta) plus a README sheet. In Service Studio: Data tab → Multilingual Locales → Import Language Resources, then publish.

### Manual steps in Service Studio (optional)
- The footer links **MSF ComCare**, **SG Enable** and **data.gov.sg dataset** have no destination (they render as `href="#"`). Set each Link's URL (Destination → External URL) to the official page, then publish.
- When you move to OutSystems' own translations (Data tab → Multilingual Locales → Import Language Resources with sgfsf-translations.xlsx), the built-in table can stay as a fallback; native translations always win.


### R5 Language menu: removed the stray "Button" word (17 Oct, 16:40 SGT)
- Found in phone testing: the Language menu read "ButtonEnglish", "ButtonBahasa Melayu", "Button中文", "Buttonதமிழ்".
- Cause: the four language buttons in block `Common/AccessBar` were created with `IButton`, which comes with a default Text widget "Button"; the label text was added beside it instead of replacing it.
- Fix: deleted those 4 default "Button" Text widgets. A model sweep of every screen and block (Text widgets reading "Button", "Link", "Text", "Container", "Expression", "Label", "Title", "Icon", `lbl_…` or `{0}`) found no others.
- Published 0 errors. Live check at 390px: the menu reads English, Bahasa Melayu, 中文, தமிழ். Screenshot: `docs/screenshots/lang-menu-fixed.png`.


### R6 Security pass (17 Oct, 16:45–17:00 SGT)
- App start-up script (block `Common/AccessBar`, action `ApplySavedPrefs`) now: redirects plain `http://` to `https://`; hides the app and tries to open it at top level when it is loaded inside a frame (anti-clickjacking); adds `<meta name="referrer" content="strict-origin-when-cross-origin">`.
- `WizardStep2Household/IncomeInput`: `inputmode="numeric"` (was `decimal`), `pattern="[0-9]*"`, `autocomplete="off"` → number keypad on phones.
- Published 0 errors (UI module). Live checks: http lands on https, framed copy hidden, referrer meta present, sweep of all screens 0 page errors.
- Full findings: `docs/SECURITY_REVIEW.md`.


### R7 O11 best-practice pass (17 Oct, 17:00–17:20 SGT)
- FindCentres: new Data Action `GetDirectory` (one server call for the three lists, replaces 3 server calls in OnInitialize); `LoadDirectory` on screen OnReady and on Retry, with AllExceptions → "Failed to load services. Check your connection and tap Retry."; old `OnInitialize2` → `OnDirectoryFetched` (OnAfterFetch); `OnSearch2` → `OnSearch`.
- CS: descriptions on 4 entities.
- TrueChange UI warnings 11 → 9, 0 errors. Published CS then UI. Live: full suite 42/42, sweep 4 languages × 390/1280 0 page errors.
- Mocked tests updated for the new data action endpoint.
- Full checklist: `docs/O11_BEST_PRACTICES_REVIEW.md`.


## Features round (17 Oct 2026, from 17:35 SGT)

Goal (17:18 SGT): build the recommended features (nearest centres, share results, admin screen), turn category inputs into dropdowns, and make it look really good. Order: dropdowns → nearest centres → share/print → admin → polish.

### F0 CS backend for all features (published 17:50 SGT, 0 errors, 0 warnings in CS)
- **Static entities (public)** for every category choice: `HouseholdType`, `EmploymentStatus`, `ResidencyStatus`, `MaritalStatus`, `HousingType` (Id, Label, Order, Is_Active). Labels match the text that `GetSchemeRecommendations` already normalises, so the ranking logic did not need to change for the existing questions.
- **`GetSchemeRecommendations`**: two new optional inputs, `MaritalStatus` and `HousingType` (default `""`, so existing callers are unaffected). They only add plain-words notes and small rank nudges where `sgfsf-schemes-verified.json` states the condition: FAM (divorcing/divorced families, marriage support), ComCare IA (enhanced IA is for people in public housing), ComLink+ (families in public rental flats). Compared with `Entities.SchemeCatalogue.<Code>`, no hard-coded text identifiers.
- **Role `CentreAdmin` (public)**. Checked server-side with `CheckCentreAdminRole()` as the first node of every admin action; failure raises the role's own exception.
- **`CachedCentre`** is now public (read-only) and has `IsActive` (default True), `IsManagedByAdmin` (default False), `LastEditedOn`.
  - The data.gov.sg sync (`SyncCentresCache` and the refresh path in `GetCachedFamilyServiceCentres`) now deletes only non-admin rows, then calls the new private `RemoveOverriddenDatasetRows` (one SQL DELETE) so an admin's edited or hidden centre is never overwritten by the next sync.
  - Both serving aggregates filter `IsActive = True`. The refresh path now serves from the cache after writing it (it used to return the raw upstream list, which would have ignored admin changes).
- **`Centre_CreateOrUpdate(Centre)`** (public): role gate → trim and validate (name, address, 6-digit postal code, email format) → create (gives a unique centre number 900000+Id) or update; coordinates are cleared when the postal code changes so they get re-geocoded. Returns `Success` + plain-words `ErrorMessage`.
- **`Centre_SetActive(CentreId, IsActive)`** (public): role gate → hide/show a centre. Nothing is deleted.
- **OneMap**: REST integration `OneMapAPI.Search` (`/api/common/elastic/search`, no key), structures `OneMapSearchResponse`/`OneMapResult` (coordinates arrive as text → `TextToDecimal`).
- **`GetNearestCentres(PostalCode)`** (public): validate 6 digits → OneMap lookup (must return the same postal code) → for each active centre, geocode once via private `Centre_Geocode` if it has no coordinates (saved, never fails the caller) → `GeoDistanceKm` → `ListSort` → top 3 (`NearbyCentre` list). Friendly messages for a bad format, an unknown postal code, and any failure (AllExceptions handler + `LogMessage`).
- **`GeoDistanceKm`** (function): equirectangular distance (cos 1.35° = 0.9997), accurate to well under 0.1% at Singapore's size, and needs no trigonometry (O11 has no Sin/Cos).
- All new and changed flows were laid out with the BFS layout pass.

**Dependency note.** The Model API cannot add new cross-module references (`AddDependency` fails with `IModelServices.ResolveModuleSignature must be set first`; verified again today). The new CS elements were added to the UI module in Service Studio (Manage Dependencies).

### F3 Share my results + print view (UI published 17:54 SGT)
- `WizardStep3Results`: new "Keep or share these results" card with two 56px buttons.
  - **Share on WhatsApp** → screen action `ShareOnWhatsApp`: builds a short plain-words summary of the top 5 results (scheme, agency, helpline), the "suggestions only" line and the app link, then opens `https://wa.me/?text=…` (URL-encoded in a JS node). Nothing is sent until the user presses send in WhatsApp.
  - **Print or save as PDF** → screen action `PrintResults` (`window.print()`). Theme print styles hide the header, menus, buttons and the urgent strip, keep each card on one page, and print phone numbers next to call links.
- New strings added to the built-in translation table (BM, 中文, தமிழ்) through a marked `/*sgsf-i18n-extra*/` block, so later features extend one block instead of editing the large dictionary.
- Theme CSS lives in one marked `/* sgsf-features-css */` block at the end of the theme.
- Live check (390px): WhatsApp opens with the summary text; button height 56px; 0 page errors. Screenshot: `feat-3-share.png`.

### F1 Wizard choices as dropdowns (UI published 18:13 SGT)
- Step 2 now asks **7** optional questions, one per screen: income, household size, then 5 choice questions, each a native **Dropdown** bound to a public Static Entity in CS (`GetHouseholdTypes`, `GetMaritalStatuses`, `GetHousingTypes`, `GetEmploymentStatuses`, `GetResidencyStatuses`: block aggregates fetched At Start, filtered `Is_Active = True`). Values and labels are the entity `Label`, so the existing Text variables and the CS ranking logic are unchanged.
  - New: **marital status** (Q4) and **housing type** (Q5), passed through the block event `OnHouseholdSubmitted` → `FindSupport` → `WizardStep3Results` → `GetSchemeRecommendations(MaritalStatus, HousingType)`. They are also part of the results' query key, so changing an answer refreshes the results.
  - The old button groups and their three `OnSelect*` screen actions were removed (no dead code). Income and household size stay number inputs (number keypad).
  - Each dropdown has a real `<label for>` (Label widget with TargetWidget), 56px tall, 18px text, and a "Choose one (optional)" empty option. Hidden questions hide the whole dropdown container.
- "Question N of 7" and the Listen text were updated for 7 questions. All new strings (questions, options, empty text) are in the translation table (BM, 中文, தமிழ்).
- Why dropdowns everywhere (the brief allowed big buttons for 2–4 options): dropdowns were requested, and one control type for every choice question keeps step 2 consistent. Native selects open the phone's large picker.
- Tests: new `dropdowns.spec.ts` (options come from the static entities, one visible dropdown per question, ≥48px, the answers reach the ranking: rental flat lifts ComLink+). `findsupport.spec.ts` and `wizard.spec.ts` updated for 7 questions and dropdowns. New `share-print.spec.ts` for F3. **Live suite 44/44.**
- TrueChange (UI): 0 errors, 9 warnings (the same 9 by-design warnings).
- Screenshot: `feat-1-dropdowns.png`.

### F3 fix: Save as PDF / print was cut off (found in testing 18:20 SGT; UI published 18:31 SGT)
- **Cause:** the layout's `.active-screen.screen-container` is a fixed-height (100vh) scroll box with `overflow: hidden auto`, so print got 1 page and clipped the rest. The earlier print rule `a[href^="tel:"]::after { content: attr(href) }` printed raw `tel:` URLs.
- **Fix (theme, one `@media print` block):** `html`, `body` and every layout wrapper get `height: auto; overflow: visible; position: static`. Header, nav, skip link, access bar, stepper, buttons, the share card and the nearest-centres search are hidden. Cards are full width with `break-inside: avoid`, call links print as plain bold text with `white-space: nowrap`, no URL printing (`a[href]::after { content: none }`), A4 page margins, 12pt body.
- New print-only title on the results: "Support you may qualify for · 17 Oct 2026" (date from `CurrDateTime()`, translated).
- **Checked** with Playwright `page.pdf()` at A4 portrait and landscape, from 390px and 1280px windows: 3 pages, all 7 scheme cards present, no URLs, phone numbers on one line. Page images were viewed: `feat-3-print-pdf-a4.png`, `feat-3-print-pdf-desktop.png`. `share-print.spec.ts` now also checks that no wrapper clips, that no URL is printed after call links, and that the PDF has more than one page.

### UX round from review feedback #2-#6 (UI published 18:47-18:55 SGT)
**Look and feel: Singapore Government Design System style (look only).** No gov masthead, crest or logo, because this is not an official site.
- Flat surfaces, 1px light-grey borders, 4px radius, no shadows, gradients or pills.
- The left-stripe callouts (`.sgsf-urgent`, `.sgsf-error`) are now full-border alerts. "Need help now?" is an info alert with an ⓘ icon, a light-blue background and a full border.
- Type scale: H1 32/40, H2 24/32.

**One button system**, in the theme (`/* sgsf UX batch */` block):
- **Primary:** solid green `.btn-primary`, for the main action of each screen only.
- **Secondary:** white with a 1px grey border and dark text, same height and radius as primary. Used for Back, Start again, Listen, Share on WhatsApp, Print, Find centres, How to apply, and the scheme cards' call buttons. Only the single urgent ComCare call stays primary.
- **Tertiary:** text link. Used for Clear filters, Skip the rest, and the footer links.

**Focus.** OSUI's yellow focus fill (`.has-accessible-features a:focus` → `--color-focus-outer`) is neutralised by setting the focus colour variables to transparent.
- Mouse and tap clicks show nothing: `:focus:not(:focus-visible) { outline: none }`.
- Keyboard focus shows a green ring offset by 2px, with no fill.
- Headings and `tabindex="-1"` targets get no focus styling.
- Verified: a keyboard-focused link shows a green ring and a transparent background.

**Browse Services (FindCentres) screen.** Every control now does something distinct.
- **Removed** the "Browse centres" button (`BrowseAllButton`). It led to the page you were already on. Its action `ClearFilters` stays, because Clear filters uses it.
- The header's "Browse Services" is already a non-link "current page" label on this screen.
- **Search** is full width with the Search button attached, 52px tall.
- **Filters:** the hand-rolled chip and sort buttons were replaced with two labelled native Dropdowns: "Service type" and "Sort by".
  - They are backed by two new UI-local Static Entities, `DirectoryServiceType` and `DirectorySortOrder` (Code + Label), loaded by screen aggregates At Start.
  - OnChange calls the existing `SetServiceType` / `SetSortOrder` actions, so the filter logic is unchanged.
  - "Clear filters" is a text link. The duplicate "Type: … · Sort: …" summary is kept for screen readers only.
  - The OSUI ButtonGroup isn't referenced by this module (it would need Manage Dependencies), so a Dropdown was used, which is one of the OSUI-recommended patterns.
- **Pagination:** the custom First/Prev/1-2-3/Next/Last pager was replaced with the **OutSystems UI `Pagination` block**.
  - StartIndex = PageStart−1, MaxRecords = 10, TotalCount = TotalMatches.
  - OnNavigate → `GoToPage(Trunc(NewStartIndex/10)+1)`.
  - The current page uses the block's own selected state. This fixes the "4 turns yellow when I click 3" focus bug.
- Footer links (MSF ComCare, SG Enable, data.gov.sg) have one consistent link style and an "(opens in a new tab)" accessible name. They open the right site in a new tab (`window.open(url, "_blank", "noopener")`).

**Wizard (Find Support).**
- Dropdown fix: the bordered select and its ▾ arrow are now the same box. The container and the select are both 100% of the form column, up to 520px (verified: select 520 = box 520 at 1280px; 326 = 326 at 390px).
- Inputs and the Back/Next row share the same 520px column. Back and Next are vertically aligned (same top).
- "Skip the rest and see results" moved to its own centred line below Back/Next, as a text link.
- **Removed** the footer link "Browse all support places". It duplicated the header nav item "Browse Services".

Screenshots (viewed): `ux-home-1280.png`, `ux-centres-p2-1280.png`, `ux-centres-p2-390.png`, `ux-filters-1280.png`, `ux-wizard-1280.png`, `ux-results-1280.png`, `ux-focus-1280.png`.

### F2 Postal code → 3 nearest centres (UI 18:21, sort fix CS+UI 19:02 SGT)
- New Block **`NearestCentres`** (MainFlow), placed on the results step above "Keep or share". It is self-contained.
  - Labelled postal-code input: text with `inputmode=numeric`, `maxlength=6`, `autocomplete=postal-code`, so leading zeros survive. The "Find centres" button and loading text sit with it.
  - Errors appear in a `role=alert` box. Results are in an `aria-live` region.
  - Screen action `FindNearest`: client-side 6-digit check → CS `GetNearestCentres` → assigns. It has an AllExceptions handler with a friendly message.
- Each result card shows the name, a distance badge ("0.4 km away"), the address, a **Call** link (`tel:`) and **Directions** (Google Maps directions in a new tab). A note explains the distance is a straight line.
- **Bug found and fixed:** the first version always showed the same 3 centres, unsorted.
  - **Cause 1:** `ListSort` on the record list did not reorder it. It was replaced with a sorted insert while building the list: `ListIndexOf(AllDistances, Current.DistanceKm > CurrentNearby.DistanceKm)` then `ListInsert`, or `ListAppend` when the new one is farthest.
  - **Cause 2:** the UI was still running the old CS code ("Outdated Consumer"). After a CS publish, the UI is now refreshed (`omlRefreshReferences`) and republished.
- Verified live:
  - 560211 (Ang Mo Kio) → Allkin AMK 230 at 0.4 km, Allkin YCK at 0.9 km, REACH Sin Ming at 1.1 km.
  - 730345 → Care Corner Woodlands at 0.0 km first.
  - "12" → "Please type a 6-digit postal code…".
  - 999999 → "We could not find postal code 999999…".
- New `nearest.spec.ts` (bad and unknown codes; 3 results sorted ascending, nearest under 2 km, call + directions links). Screenshot: `feat-2-nearest.png`.

### Tidy round (root review, 19:05 SGT)
- Centre cards: every link has one colour (green, underlined), links are left-aligned with the text, and "View details" is in sentence case.
- The card grid is the same width as the search bar and filter panel at 1280px (no overflow).
- Results: the orphan "Edit" link is now a "Change answers" text link inline with the answer chips. The chips now also show the marital status and housing answers.
- Print hides "Change answers" and "How to apply".
- Browse tests rewritten for the dropdown filters and the OSUI Pagination. **Live suite 46/46** (44 + 2 nearest specs).

### F4 Centre admin screen (UI 19:20 SGT)
- New screen **`MainFlow/CentreAdmin`** (URL `/SGFamilySupportFinder/CentreAdmin`). **Screen role: `CentreAdmin`** (the CS role, referenced through Manage Dependencies). Anonymous and Registered are not ticked, so a logged-out visit goes to Login. Verified live.
- **Server-side checks:** CS `Centre_CreateOrUpdate` and `Centre_SetActive` call `CheckCentreAdminRole()` and raise the role exception. Hiding the button is not the protection.
  - The screen's `SaveCentre` and `SetCentreActive` actions have `SecurityException` handlers ("Only Centre Admins can change centres…") and `AllExceptions` handlers.
- **Screen aggregate `GetCentres`** (At Start) on CS `CachedCentre`.
  - Filter: name or street contains the search text, or the postal code equals it.
  - Sorted by name. Shows hidden centres too, so they can be shown again.
- **Add / Edit:** one form held in the local `EditCentre` (CachedCentre record).
  - Fields: name, street, postal code (`inputmode=numeric`, `maxlength=6`), phone (`inputmode=tel`) and email (`inputmode=email`), each with a real `<label for>`.
  - Validation (required fields, 6-digit postal code, geocoding the new postal code) stays in CS `Centre_CreateOrUpdate`. Its `ErrorMessage` shows in a `role=alert` box.
- **Hide / Show** (`Centre_SetActive`). Nothing is deleted. Hidden centres drop out of Browse and nearest-centres, and are greyed in the admin list.
- Each row shows "Shown/Hidden" plus "Edited by admin" (`IsManagedByAdmin`), so the nightly data.gov.sg sync doesn't overwrite admin edits.
- Same header and nav as the public screens. 48px buttons. Row actions go full width at 390px.
- This is a staff-only screen, so it is English only (not in the public translation table).
- `admin.spec.ts`:
  - The logged-out redirect is checked live.
  - The add → save → hide → show flow runs when `SGFSF_ADMIN_USER` / `SGFSF_ADMIN_PASS` for a CentreAdmin test user are set. **Not run yet: no test admin account.**

### Docs (20:30 SGT)
- README "What the app does" rewritten for this round: dropdown filters, OSUI Pagination, 7-question wizard with Static Entity dropdowns, nearest centres, share/print, CentreAdmin screen and the role, accessibility. The testing table now matches the 17 Oct live run (47 passed, 0 failed, 1 skipped).
- New `docs/ASSESSMENT_CHECKLIST.md`: every ask in the brief (last page of `docs/Low Code Engineer JD.pdf`) mapped to evidence, with ✅/⚠️.
- IaC re-check on this branch (Terraform 1.9.8): `fmt -check` clean; `init -backend=false` + `validate` pass for `infra/` and `infra/bootstrap/`; tflint 0 issues; checkov 314 passed / 24 failed (all explained in `infra/README.md`). No plan or apply.


## Round 8: fix round for a 10/10 (18 Oct 2026, 20:44–22:10 SGT)

Goal (18 Oct): "fix it and make it a 10/10", then "check that everything is genuine and sound". Every change went through the Service Studio model API (`applyModelApiCode` → `omlMerge` → `omlPublish`), one small change at a time. Nothing was deleted, no `omlReset`.

### Validation (TrueChange, read again 18 Oct 2026 21:58 SGT)
| Module | Errors | Warnings |
|---|---|---|
| SGFamilySupport_LIB | 0 | 0 |
| SGFamilySupport_CS | 0 | 0 |
| SGFamilySupportFinder (UI) | 0 | 4 |

The 4 UI warnings, all by design:
- **Security Warning ×3** on `FindCentres/GetDirectory` → `FetchCentres`, `FetchSSO`, `FetchSFP`: public, read-only directory actions on an anonymous screen. They take no input and return only public data.gov.sg directory rows. This is also the "Security Warnings" line every UI publish prints. None comes from this round's changes; all three were there before it.
- **Coherence Suggestion ×1** on `FindCentres/On Ready` (`LoadDirectory` reads the Data Action). `LoadDirectory` is also the Retry handler, and the list logic already runs in `OnDirectoryFetched` (OnAfterFetch). Left as is.

### Server-side authorisation (checked, nothing to add)
`SGFamilySupport_CS.Centre_CreateOrUpdate` and `Centre_SetActive` (the only public actions that change data) start with `If CheckCentreAdminRole()`. The False branch raises the `CentreAdmin` role exception ("Only centre admins can change centres."). Read back from the model on 18 Oct 21:58 SGT (`getServerAction`). The other public CS actions only read public data.

### CS changes (`SGFamilySupport_CS`)
| # | Element | Before → after | Why |
|---|---|---|---|
| R8-CS-1 | Static entity `SchemeCatalogue`, record `SSOAPP` (apply at a Social Service Office) | phone **1800 777 0000** → **1800 222 0000**; how-to-apply text "SSO hotline: 1800 222 0000." → **"ComCare Hotline: 1800 222 0000."** | MSF lists 1800-222-0000 as the ComCare Hotline "to enquire about financial assistance or social support" (https://www.msf.gov.sg/contact-us-feedback, read 18 Oct 2026). |
| R8-CS-2 | Timer `RefreshDatasetCache` | `Schedule` null (never ran on its own) → **daily 19:00 server time (UTC) = 03:00 SGT**, `CronSchedule "0 19 * * *"`, with a description | The daily refresh promised in the README was not scheduled. 03:00 SGT is the quietest hour. |
| R8-CS-3 | New entity `AuditLog` (not public) | — → Id, ActionName (Create / Update / Hide / Show / SaveFailed), EntityName, RecordId, Details, UserId, CreatedOn | Append-only record of every admin change to centres (who, what, when). |
| R8-CS-4 | Server action `Centre_CreateOrUpdate` | no audit, no DB handler → writes `AuditLog` after each save; new `DatabaseException` handler rolls back, writes a `SaveFailed` audit row and returns a plain-words `ErrorMessage` | Traceability, and no raw database errors reaching the admin screen. |
| R8-CS-5 | Server action `Centre_SetActive` | no audit → writes a Hide / Show `AuditLog` row | Same. |

### UI changes (`SGFamilySupportFinder`)
| # | Element | Before → after | Why |
|---|---|---|---|
| R8-UI-1 | Module references | stale → refreshed after each CS publish (`omlRefreshReferences`) | Avoid "Outdated Consumer". |
| R8-UI-2 | Unused reference `GetFamilyServiceCentres2` | present → removed | Dead reference. |
| R8-UI-3 | Theme | name `Test` → **`SGFamilySupportTheme`** | A real name for reviewers. |
| R8-UI-4 | Script `SGFamilySupportI18n` (the translation table) | missing labels → Service type, Sort by, All services, Name A to Z / Z to A, the Call link names and the result-card sentences now translate in Bahasa Melayu, 中文 and தமிழ்; a sentence-by-sentence fallback for longer texts; 38 more entries | Parts of the public screens stayed in English after a language change. |
| R8-UI-5 | Call links | `aria-label` did not contain the visible number → "Call 6453 5349" (localised: Hubungi / 拨打 / அழைக்கவும்) | axe `label-content-name-mismatch`. |
| R8-UI-6 | "Updated …" stamp on Browse, and the print date | the visitor's device time, e.g. "Updated 16 Oct 2026, 19:05" → **Singapore time**, "Updated 18/10/2026 21:38 SGT" (中文: "更新于 2026 年 10 月 18 日 21:38（新加坡时间）", no stray comma) | A visitor abroad saw a time that was not Singapore's. |
| R8-UI-7 | Find Support "Change answers" link | `aria-label` "Change your answers" → "Change answers" | axe `label-content-name-mismatch` (serious). |
| R8-UI-8 | Theme CSS, centre details panel | → label/value columns, title no longer squeezed on phones, 44 px Close / Call / Email targets | Readability at 390 px. |
| R8-UI-9 | 中文 logo badge | "新加坡" squeezed into the square → stays "SG" | Layout. |

### Publishes (all `status: success`)
| Time (SGT) | Module |
|---|---|
| 18 Oct 20:45 | CS (hotline) |
| 18 Oct 20:49 | CS (timer, AuditLog, audit + handler) |
| 18 Oct 21:04 | UI (references, theme, i18n, Call names, SGT) |
| 18 Oct 21:31 | UI (i18n fallback, Change answers) |
| 18 Oct 21:38 | CS (ComCare Hotline wording), then UI |
| 18 Oct 21:44 | UI (panel CSS, SG badge) |

### Live checks after the last publish (18 Oct 21:45–21:47 SGT, Chromium, 390 and 1440 px, device timezone America/Los_Angeles)
- Browse "Help now" link: `href="tel:18002220000"`, text "Help now: 1800 222 0000".
- Find Support, money need: "📞 Call ComCare 1800 222 0000"; no "1800 777 0000" anywhere (English and 中文).
- "Showing 1–10 of 94 found · Updated 18/10/2026 21:38 SGT", the same under UTC, Asia/Singapore and America/Los_Angeles device clocks.
- Filters in all four languages: Service type / Jenis perkhidmatan / 服务类型 / சேவை வகை; Sort by / Susun ikut / 排序方式 / வரிசைப்படுத்து; options "All services", "Name A to Z", "Name Z to A" and their translations.
- Call links: "Call 6453 5349" / "Hubungi 6453 5349" / "拨打 6453 5349" / "அழைக்கவும் 6453 5349".
- Get directions opens `https://www.google.com/maps/dir/?api=1&destination=230%20Ang%20Mo%20Kio%20Ave%203,%20Singapore%20560230`.
- axe (WCAG 2.1 A/AA + best practice): 0 violations on Browse, the details panel and the English results.

### Tests changed in this round
- New `hotline.spec.ts` (2), `timezone.spec.ts` (1), `translations.spec.ts` (4).
- `persistence-refresh.spec.ts`: the timestamp parser now reads the new `Updated dd/MM/yyyy HH:mm SGT` format (it failed 2 tests on the old `dd MMM yyyy, HH:mm` format before this fix).
- Full live run: see `README.md` → Testing.

### Not verified
- The 03:00 SGT timer has not been seen firing yet (first run due 19 Oct 2026 03:00 SGT). The schedule assumes the server clock is UTC.
- The logged-in admin flow (and so an `AuditLog` row being written) has not been run live: there is no CentreAdmin test login yet.

## Round 9: actions tidy and Listen language fix (18 Oct 2026, 23:05–23:40 SGT)

Goal (18 Oct): "For finder with the client actions and server actions can you ensure they are neat and not converged and all over the place?" Then: the Listen button reads Malay text with an English voice.

Applied through the Service Studio model API (`applyModelApiCode` → `omlMerge`). The model was re-read after each merge. `getValidationMessages` showed 0 errors before each publish. The full before/after inventory is in `docs/ACTIONS_AUDIT.md`.

### Before
- CS: 17 server actions, all loose at the root. Only 3 used `Entity_Verb` (`Centre_*`). `GetFamilyServiceCentres` and `GetCachedFamilyServiceCentres` (and the same pairs for offices and programme sites) read as duplicates. The three raw fetchers were Public although nothing outside CS calls them, and the UI still listed two of them as unused dependencies.
- UI: one module client action (`ApplyDirectoryFilters`) at the root. 46 screen/block actions, data actions and aggregates had no Description.
- Layer split was already right: no client actions in CS; UI screen actions only hold screen state; UI data actions only call public CS actions; the role check is on the server.
- No action had 0 references (`GeoDistanceKm` is used in an expression in `GetNearestCentres`), so nothing was moved to an "Unused" folder.

### Changes (module, element, before → after, why)
| # | Module | Element | Before → after | Why |
|---|---|---|---|---|
| T1 | UI | `ListenButton` › `ToggleSpeech` › JS `Speak` | Took the language from `GetCurrentLocale()` and picked an **English voice** when the device had none for the language (it showed "Reading in English"). Text passed in as a parameter (wizard steps 1–2) was read in English. → Takes the language the page is showing (`__sgsfI18n.lang`); translates the `Text` parameter through the page's translation table; sets `utterance.lang` to `ms-MY` / `zh-CN` / `ta-IN` / `en-SG`; picks a voice with a matching language (`ms-MY`→`ms-SG`→`ms`; `zh-CN`→`zh-SG`→`cmn`→`zh-TW`→`zh`; `ta-IN`→`ta-SG`→`ta-LK`→`ta`), waiting up to 1.5 s for `voiceschanged`. If there is no matching voice, it shows a translated note and does **not** speak. "Phone" is also translated. | Reported in testing: Malay text, English voice. |
| T2 | UI | `ListenButton` › `SpeechEnded` | No inputs → new optional input `Note`, assigned to `VoiceNote`. | Lets the async voice check show the no-voice note. |
| T3 | UI | Script `SGFamilySupportI18n` | → exposes `__sgsfI18n.tr(text)` (one line, uses the existing `tr`). | Needed by T1 to translate the `Text` parameter. |
| T4 | UI | Dependencies on CS | `GetSocialServiceOffices`, `GetStrengtheningFamiliesServices` listed → removed (0 uses in any UI screen, block or action, checked by a model query before deleting). | Unused dependencies; allowed the fetchers to become private. |
| T5 | CS | Server-action folders | none → `Centre`, `Directory`, `Scheme`, `Integration_DataGovSg`, `Cache`, `Geo`, each with a description; all 17 actions moved in. | Grouping. |
| T6 | CS | Internal renames (key-based references; timers and the `Geo_DistanceKm(...)` expression updated by the model) | `GetFamilyServiceCentres` → `DataGovSg_FetchFamilyServiceCentres`; `GetSocialServiceOffices` → `DataGovSg_FetchSocialServiceOffices`; `GetStrengtheningFamiliesServices` → `DataGovSg_FetchProgrammeSites` (all three Public Yes → **No**); `SyncDatasetCaches` → `Cache_SyncAll`; `SyncCentresCache` → `Cache_SyncCentres`; `SyncOfficesCache` → `Cache_SyncOffices`; `SyncProgrammeCache` → `Cache_SyncProgrammeSites`; `RemoveOverriddenDatasetRows` → `Cache_RemoveOverriddenRows`; `GeoDistanceKm` → `Geo_DistanceKm` | One `Area_Verb` naming scheme; no near-duplicate names; only UI-facing actions public. |
| T7 | CS | Public renames | `GetCachedFamilyServiceCentres` → `Directory_GetFamilyServiceCentres`; `GetCachedSocialServiceOffices` → `Directory_GetSocialServiceOffices`; `GetCachedStrengtheningFamiliesServices` → `Directory_GetProgrammeSites`; `GetNearestCentres` → `Directory_GetNearestCentres`; `GetSchemeRecommendations` → `Scheme_GetRecommendations` | Same scheme. The UI was refreshed (`omlRefreshReferences`) and republished straight after the CS publish. |
| T8 | UI | Client action | `ApplyDirectoryFilters` (root) → `Directory/Directory_ApplyFilters` (new client-action folder with a description) | Same scheme. |
| T9 | UI | Descriptions | 46 screen/block actions, data actions and aggregates with no Description → one plain-words line each (FindCentres, FindSupport, CentreAdmin, AccessBar, CentreDetailsPanel, ListenButton, NearestCentres, WizardStep1Need/2Household/3Results). `NearestCentres` block description now names `Directory_GetNearestCentres`. OutSystems template elements (Login, layouts, Menu, UserInfo) were left as shipped. | Assessors open Service Studio. |

No logic was moved between CS and UI. No entity, data or module was deleted.

### Validation and publishes (UTC)
- Before: LIB 0/0; CS 0 errors / 0 warnings; UI 0 errors / 4 warnings (3 × "Security Warning": the public directory calls server actions from an Anonymous screen, which is by design; 1 × "Coherence Suggestion" on `FindCentres` On Ready).
- After each merge and before each publish: identical. LIB 0/0, CS 0/0, UI 0 errors / the same 4 warnings.
- Publishes: UI (Listen fix) at 15:19:44Z (success); UI (Listen fix 2) at 15:23:58Z (success); UI (unused CS dependencies removed) at 15:29:45Z (success); CS (folders + renames + 3 fetchers private) at 15:32:22Z (success); UI (references refreshed to renamed CS actions) at 15:33:04Z (success); UI (client action folder/rename + descriptions) at 15:36:18Z (success); UI (description wording) at 15:37:44Z (success). The UI ran "Outdated Consumer" for about 42 s between the CS publish (15:32:22Z) and the UI publish (15:33:04Z).

### Live checks after the last publish (headless Chromium)
- Listen, with a stubbed voice list (en-GB, ms-MY, zh-CN, ta-IN): ms → `lang ms-MY`, voice Amira, text "Apa yang anda perlukan bantuan? Pilih satu. …"; zh → `zh-CN`, Tingting, "您需要哪方面的帮助？…"; ta → `ta-IN`, Vani, "உங்களுக்கு எதில் உதவி வேண்டும்? …"; en → `en-GB`, Daniel, English text.
- English voices only: ms/zh/ta show "Tiada suara Bahasa Melayu pada peranti ini. Tambah satu dalam tetapan teks-ke-pertuturan telefon anda." / "此设备没有中文语音。请在手机的文字转语音设置中添加。" / "இந்தச் சாதனத்தில் தமிழ்க் குரல் இல்லை. …", and nothing is spoken.
- Real headless Chromium (0 voices): the same notes after 1.5 s; English still speaks with `lang en-SG`.
- Renamed CS actions working live: Browse shows "10 of 94 found · Updated 18/10/2026 23:32 SGT", and a search for "lakeside" finds Lakeside Family Centre (`Directory_Get*` ×3). Find Support shows 7 scheme cards (`Scheme_GetRecommendations`). Nearest for 560211: Allkin FSC @ Ang Mo Kio 230 0.4 km, Allkin FSC @ Yio Chu Kang 643 0.9 km, REACH @ Sin Ming 1.1 km (`Directory_GetNearestCentres`). Help-now link `tel:18002220000`. Language switch gives `html lang` ms / zh-CN / ta.
- New spec `tests/listen.spec.ts` (5 tests) pins the Listen behaviour.
- Full live Playwright run after this round (23:44–23:53 SGT, `--workers=1`): **59 passed, 0 failed, 1 skipped** (the skipped one is the logged-in admin flow, which needs a CentreAdmin test login).

### Not verified
- Real speech on iPhone/Android: whether a phone has a Malay, Chinese or Tamil voice installed is up to the device; not tested on a real phone.
- Known duplication left on purpose: `Cache_Sync…` call the DataGovSG REST methods directly, while `Directory_Get…` refresh through `DataGovSg_Fetch…`. Merging the two refresh paths would change live behaviour, so it is a follow-up and was not done blind.
- The screen actions on `FindCentres` (`OnSearch`, `GoToPage`, `SetServiceType`, `SetSortOrder`, `ClearFilters`) each copy the six outputs of `Directory_ApplyFilters`. This is readable, but it could be one shared "RefreshList" screen action. It was left as is.


## Round 10: reviewer login for assessors (18 Oct 2026, 16:20–16:55 UTC)

Goal: a login an assessor can use on the staff screen `/CentreAdmin`, with the `CentreAdmin` role only. The reviewer is not known in advance, so it is a generic end-user account named `reviewer`. No password is stored in this repository or in this document.

**Module:** `SGFamilySupport_CS` only. LIB and UI were not changed.

**Prerequisite (done in Service Studio):** `SGFamilySupport_CS` → Manage Dependencies → `Users` → `EncryptPassword`. The model API cannot add new dependencies, and without `EncryptPassword` the password would have been stored in plain text.

**Elements created (model API, `applyModelApiCode` → `omlMerge`):**

| Element | Type | Purpose |
|---|---|---|
| `User_CreateReviewer` | Server action, private | If the setup site property is not empty: `Users.EncryptPassword` → `CreateUser` (System `User` entity: Name "Reviewer", Username `reviewer`, active) → `GrantCentreAdminRole`. Does nothing when the site property is empty. |
| `ReviewerSetupPassword` | Site property (Text) | Held the initial password for the single run only. |
| `SetupReviewerOnce` | Timer, schedule "When Published", 5 min timeout | Ran `User_CreateReviewer` once after publish. |
| `Auth` | Server action folder | Temporary home of the action during setup. |

**Published:**
- 16:28:52 UTC: CS with the elements above. The timer ran once and created `reviewer` with only the `CentreAdmin` role.
- 16:32:09 UTC: clean-up. The timer `SetupReviewerOnce` was removed. The site property `ReviewerSetupPassword` was cleared (empty default, description says it is kept empty on purpose). `User_CreateReviewer` was moved to a new server action folder `Unused` with the description "one-time setup: …", and the empty `Auth` folder was removed. Nothing calls the action now, and it does nothing while the site property is empty.

**Validation after clean-up:** CS 0 errors, 1 new warning: "unused action" for `User_CreateReviewer`. It is expected: the action was kept for the record instead of deleted, and nothing calls it. UI keeps its 4 known warnings.

**Verified:**
- Logged in as `reviewer` on the live `/CentreAdmin` screen: "Manage centres" loads with the centre list (50 rows shown).
- Full live Playwright suite with the reviewer login, 18 Oct 2026, 16:42–16:53 UTC: **60 passed, 0 failed, 0 skipped**. This includes the logged-in admin test that used to be skipped. See `docs/test-evidence/reviewer-run-2026-10-18.md`.
- `tests/admin.spec.ts` was fixed while doing this: the login and form fields are now found by role (`textbox`, `searchbox`, `input[type=password]`), and the final Hide is awaited (status message and the "Show" button), so the test centre is hidden before the page closes. One test centre left visible by an earlier run was hidden again; the public count is back to 94.

**Notes:**
- The password can be changed at any time in the Users app (`/Users` → `reviewer` → change password). Reviewer credentials are given in the submission email, not here.
- The 16:28:52 UTC CS version in the environment's version history still has the initial password as the site property default. Changing the reviewer password in the Users app makes that value useless.
