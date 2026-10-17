# Service Studio changes: wizard personalisation and UI/UX pass

Branch: `tab/wizard-personalisation`. Applied through the Service Studio MCP (`applyModelApiCode` → `omlMerge`) on 2026-10-17 (SGT 11:00–12:00).

**Status**
- **Merged in Service Studio:** all three modules are open. CS and UI were changed; LIB has no changes.
- **Validation (Service Studio `getValidationMessages` after the final merge):**
  - SGFamilySupport_CS: 0 errors, 2 warnings. These are the pre-existing scalability warnings.
  - SGFamilySupportFinder: 0 errors, 17 warnings. The baseline was 20 (pre-existing roles, performance and security warnings). Three "unused element" warnings were removed by deleting dead elements (see UI-14).
- **Published** with the owner's OK, in order CS → UI. LIB was unchanged, so it was not republished. After the CS publish, UI references were refreshed (`omlRefreshReferences`) before the UI publish. Every publish returned `success`.
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

## Manual steps for the owner
- None required for the app to work.
- Optional: open the `Test` theme in Studio once and confirm the Icon Library setting is unchanged. It was untouched; this note only exists because of the sidecar's Invalid Icon Library message.
- The scheme facts were verified on 2026-10-17. Re-check thresholds after policy updates; ComCare IA flexibility ends 31 Dec 2026, and Baby Bonus is moving to the SG Child Support Package.

## Tests changed on this branch
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

## Full-suite run
To be filled in after the full Playwright run against the live app.
