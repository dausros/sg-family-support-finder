# O11 Reactive best-practice review: SG Family Support Finder

Date: 17 Oct 2026 (SGT 17:00–17:20). Modules: `SGFamilySupport_LIB` (foundation), `SGFamilySupport_CS` (core services), `SGFamilySupportFinder` (end-user UI).
Checked through the Service Studio model API (model reads + TrueChange) and live Playwright runs.

**TrueChange (UI module): 0 errors, 11 warnings before → 0 errors, 9 warnings after.** CS and LIB: 0 errors, 0 warnings.
**Live tests after the last publish: full suite 42/42 passed**, then a 13-test subset after the final rename; sweep of all screens in EN/BM/中文/தமிழ் at 390px and 1280px with 0 page errors.

## Checklist

| Area | Check | Result |
|---|---|---|
| Architecture | 4-layer canvas: LIB → (System) only; CS → LIB; UI → CS, LIB, OutSystemsUI, Users, Maps, Charts. No upward or side references. | Pass |
| Architecture | UI holds no business logic: eligibility rules live in CS (`Scheme_GetRecommendations`); entities and the data.gov.sg REST client are in CS; CS entities are not Public, UI reads them only through CS server actions. | Pass |
| Data fetching | FindCentres used to call 3 server actions from **OnInitialize** (3 round trips before first paint; TrueChange performance warnings ×3). | **Fixed**: new Data Action `GetDirectory` loads all three lists in **one** server call; `LoadDirectory` (screen OnReady + Retry button) refreshes it with an AllExceptions handler that shows "Failed to load services. Check your connection and tap Retry."; the merge/filter/paging logic moved to `OnDirectoryFetched` (OnAfterFetch). |
| Data fetching | FindSupport results come from Data Action `GetResults` in block `WizardStep3Results`; no aggregates in loops; no server calls in OnRender / OnParametersChanged. | Pass |
| Lifecycle events | OnInitialize only for local init; no heavy logic in OnRender (only OutSystemsUI template `Menu` block uses OnRender). | Pass (template left as is) |
| Blocks | Wizard steps and `CentreDetailsPanel` are blocks with input parameters and Events (`TriggerEvent`) to talk to the parent; they don't reach into parent state. | Pass |
| Client vs server | UI logic in client/screen actions; server work only through screen data actions; no server action calls inside client-action loops. | Pass |
| Exception handling | Every FindCentres screen action that can fail has an exception handler with a plain message (search, filters, paging, sort, load). FindSupport actions only assign local state. | Pass |
| Naming | Leftover numbered names `OnInitialize2`, `OnSearch2`, `InitException2`. | **Fixed**: `OnDirectoryFetched`, `OnSearch`, `FetchedException`. |
| Descriptions | All public CS server actions have descriptions. 4 CS entities had none. | **Fixed**: descriptions added to `CachedCentre`, `CachedOffice`, `CachedProgrammeSite`, `SyncStatus`; new `GetDirectory`, `LoadDirectory`, `OnDirectoryFetched` described. |
| Unused elements | TrueChange reports no unused elements. | Pass |
| Unused dependencies | UI references OutSystemsMaps and OutSystemsCharts. | Left as is: not removed through the model API (a wrong removal can't be undone safely remotely). Manual step: Module → Manage Dependencies, untick if unused, publish. |
| Static entities | Service types FSC / SSO / SFP are text literals in filters. | Left as is: 3 fixed values, low value vs risk this close to submission. Could become a static entity `ServiceType`. |
| Translations | 4 languages come from an in-app JS dictionary (block `AccessBar`). | Left as is (works on Personal Environment). Recommended path: import `docs/sgfsf-translations.xlsx` via Data → Multilingual Locales; native translations win. |
| CSS | Styling in the theme stylesheet and block classes, not inline. Theme is still named `Test`. | Pass (theme name left; renaming touches every screen) |
| Accessibility | Labels / aria-labels on inputs and buttons, skip link, `lang` set per language, 48px targets, axe 0 violations (earlier run). | Pass |
| Security | See `docs/SECURITY_REVIEW.md`. | Pass / fixed |

## Remaining TrueChange warnings (9)
- **Missing roles ×4** (FindCentres, FindSupport, Login, InvalidPermissions): the app is a public directory, so screens are open to Anonymous by design.
- **Security Warning ×3** (`GetDirectory` → the three CS actions): public data actions callable by anonymous users. They return only public directory data and take no input.
- **Performance Warning ×1** (`AccessBar/ApplySavedPrefs/ApplySize`): one small client action call on ready to apply the saved text size.
- **Coherence Suggestion ×1** (FindCentres On Ready): Studio suggests "Fetch At Start" for the refresh in OnReady. Kept on purpose: OnReady + Refresh Data is what lets the screen catch a failed load and show Retry.

## Test changes
- `tests/api-error-retry.mock.spec.ts`, `tests/persistence-refresh.spec.ts`: the mocked network fault now also covers `DataActionGetDirectory` (the three lists arrive in one call since the refactor).
