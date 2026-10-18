# Finder actions audit: before and after (read-only, 18 Oct 2026, 15:06–15:30 UTC)

Source: live Service Studio model read through the OutSystems 11 model API (runQuery `Root { ServerActions { Name Description Public Function Folder { Name } … } }`, getActionNames, getServerAction, getClientAction, getScreen, getWebBlock, getTimers, getValidationMessages). References were counted by scanning every dumped action, screen, block and timer of the three modules for the action (by name lookup `Named("…")` or expression use).

## Counts per module (own actions only, excluding System/OutSystems UI/Users references)

| Module | Type | Server actions | Client actions | Service actions | Folders |
|---|---|---|---|---|---|
| SGFamilySupport_LIB | Reactive Library | 0 | 0 | 0 | none |
| SGFamilySupport_CS | Service (Core Services) | 17 (9 public, 8 private; 1 is a function) | 0 | 0 | none — all 17 at the root |
| SGFamilySupportFinder | Reactive (UI) | 2 (DoLogin, DoLogout — template, in Authentication folder) | 1 (ApplyDirectoryFilters, at root) | 0 | Authentication |

Screen/block actions in the UI module (local to their screen or block): CentreAdmin 6 + 1 aggregate, FindCentres 10 + 1 data action + 2 aggregates, FindSupport 9, AccessBar 4, CentreDetailsPanel 3, ListenButton 3, NearestCentres 1, WizardStep1Need 3, WizardStep2Household 4 + 5 aggregates, WizardStep3Results 9 + 1 data action; plus OutSystems template actions (Login, layouts, Menu, MenuIcon, UserInfo, ApplicationTitle).

Validation before: LIB 0/0, CS 0 errors 0 warnings, UI 0 errors 4 warnings (3 × "Security Warning": GetDirectory calls server actions from an Anonymous screen — by design, it is the public directory; 1 × "Coherence Suggestion" on FindCentres On Ready → LoadDirectory).

## SGFamilySupport_CS — every server action (before)

| Action | Folder | Public | Description | Referenced by | What it does |
|---|---|---|---|---|---|
| Centre_CreateOrUpdate | (root) | Yes | yes | UI screen CentreAdmin | Admin only (CentreAdmin role, checked here on the server). Adds a centre or saves changes to one. Saved centres are marked admin-managed so the data.… |
| Centre_SetActive | (root) | Yes | yes | UI screen CentreAdmin | Admin only (CentreAdmin role, checked here on the server). Hides a centre from the public app (IsActive = False) or shows it again. Nothing is delete… |
| Centre_Geocode | (root) | No | yes | CS GetNearestCentres | Looks up a centre's coordinates on OneMap from its postal code and saves them once, so later distance checks need no extra call. Never fails the call… |
| GetCachedFamilyServiceCentres | (root) | Yes | yes | UI screen FindCentres, UI block WizardStep3Results | Serves Family Service Centres from the local cache when fresh (under 24 hours old); otherwise refreshes from data.gov.sg and falls back to last-known… |
| GetCachedSocialServiceOffices | (root) | Yes | yes | UI screen FindCentres, UI block WizardStep3Results | Serves Social Service Offices from the local cache when fresh (under 24 hours old); otherwise refreshes from data.gov.sg and falls back to last-known… |
| GetCachedStrengtheningFamiliesServices | (root) | Yes | yes | UI screen FindCentres, UI block WizardStep3Results | Serves Strengthening Families Programme sites from the local cache when fresh (under 24 hours old); otherwise refreshes from data.gov.sg and falls ba… |
| GetNearestCentres | (root) | Yes | yes | UI block NearestCentres | Finds the 3 active centres closest to a Singapore postal code (OneMap search, no key). Centres missing coordinates are geocoded once and saved. Frien… |
| GetSchemeRecommendations | (root) | Yes | yes | UI block WizardStep3Results | Ranks the static SchemeCatalogue for a support need using optional household inputs (income, household size, employment, residency). Indicative only:… |
| GetFamilyServiceCentres | (root) | Yes | yes | CS GetCachedFamilyServiceCentres | Retrieves Family Service Centres from data.gov.sg poll-download + GeoJSON and maps to FamilyServiceCentre list. |
| GetSocialServiceOffices | (root) | Yes | yes | CS GetCachedSocialServiceOffices | Retrieves Social Service Offices from data.gov.sg poll-download + GeoJSON and maps to SupportLocation list. |
| GetStrengtheningFamiliesServices | (root) | Yes | yes | CS GetCachedStrengtheningFamiliesServices | Retrieves Strengthening Families Programme sites from data.gov.sg poll-download + GeoJSON and maps to SupportLocation list. |
| SyncDatasetCaches | (root) | No | yes | CS timers RefreshDatasetCache + SeedDatasetCache | Refreshes all three dataset caches (FSC, SSO, SFP). Each dataset sync contains its own failures, so one upstream outage never clears the other caches. |
| SyncCentresCache | (root) | No | yes | CS SyncDatasetCaches | Idempotent refresh of CachedCentre rows from the MSF Family Services dataset (data.gov.sg). Full replace per run; keeps last-known-good rows when ups… |
| SyncOfficesCache | (root) | No | yes | CS SyncDatasetCaches | Idempotent refresh of CachedOffice rows from the Social Service Offices dataset (data.gov.sg). Full replace per run; keeps last-known-good rows when … |
| SyncProgrammeCache | (root) | No | yes | CS SyncDatasetCaches | Idempotent refresh of CachedProgrammeSite rows from the Strengthening Families Programme dataset (data.gov.sg). Full replace per run; keeps last-know… |
| RemoveOverriddenDatasetRows | (root) | No | yes | CS GetCachedFamilyServiceCentres, CS SyncCentresCache | After a data.gov.sg sync, deletes dataset rows whose centre an admin has edited or deactivated, so the admin's version wins. |
| GeoDistanceKm (function) | (root) | No | yes | CS GetNearestCentres (expression) | Straight-line distance in km between two points in Singapore. Equirectangular approximation (cos 1.35 deg = 0.9997); error under 0.1% at Singapore's … |

## SGFamilySupportFinder (UI) — module-level actions (before)

| Action | Kind | Folder | Public | Description | Notes |
|---|---|---|---|---|---|
| ApplyDirectoryFilters | Client | (root) | No | yes | Filters, sorts and pages the merged directory list locally; screen logic, correctly in UI. |
| DoLogin / DoLogout | Server | Authentication | No | empty (OutSystems template) | Template login/logout used by the Login screen and UserInfo block. |

UI module dependencies on CS server actions (Manage Dependencies list): GetStrengtheningFamiliesServices, GetCachedStrengtheningFamiliesServices, GetNearestCentres, GetCachedFamilyServiceCentres, GetSchemeRecommendations, Centre_CreateOrUpdate, GetSocialServiceOffices, GetCachedSocialServiceOffices, Centre_SetActive. Of these, GetSocialServiceOffices and GetStrengtheningFamiliesServices are listed but never called anywhere in the UI (0 uses in all screens, blocks and actions).

## Problems found

1. All 17 CS server actions sit loose at the module root: no folders, so admin, directory, data.gov.sg integration, cache-sync and geo helpers are mixed together.
2. Inconsistent naming: only the 3 Centre_* actions follow Entity_Verb; the rest are GetX / GetCachedX / SyncXCache / RemoveOverriddenDatasetRows.
3. Near-duplicate names that read as the same thing: GetFamilyServiceCentres vs GetCachedFamilyServiceCentres (same for Social Service Offices and Strengthening Families). The non-cached ones are the raw data.gov.sg fetchers, used only inside CS by the cached ones, but the names do not say so.
4. Public flags wider than needed: GetFamilyServiceCentres, GetSocialServiceOffices and GetStrengtheningFamiliesServices are Public = Yes but no consumer calls them (only CS itself). The UI even keeps two unused dependencies on them.
5. UI module-level client action ApplyDirectoryFilters sits at the root (minor).
6. Many screen/block actions in the UI have no Description (e.g. FindCentres ClearFilters, GoToPage, OnSearch; FindSupport Handle*; AccessBar ChooseLanguage). Assessors opening Service Studio see blank descriptions.
7. Layer split is otherwise sound: no client actions in CS, no business rules or duplicated queries in UI client actions (UI data actions only call CS actions; UI aggregates read static lookup entities and the Centre list for the admin grid). The admin role is checked on the server inside Centre_CreateOrUpdate and Centre_SetActive.
8. No unused CS action: every one has at least 1 caller (GeoDistanceKm is used in an expression inside GetNearestCentres). Nothing goes to an "Unused" folder.

## AFTER (read back from the model after the last merge, 15:37 UTC)

Validation after: LIB 0/0, CS 0 errors 0 warnings, UI 0 errors with the same 4 warnings (no new ones).

| CS folder | Action | Public | Description |
|---|---|---|---|
| Cache | Cache_RemoveOverriddenRows | No | yes |
| Cache | Cache_SyncAll | No | yes |
| Cache | Cache_SyncCentres | No | yes |
| Cache | Cache_SyncOffices | No | yes |
| Cache | Cache_SyncProgrammeSites | No | yes |
| Centre | Centre_CreateOrUpdate | Yes | yes |
| Centre | Centre_Geocode | No | yes |
| Centre | Centre_SetActive | Yes | yes |
| Directory | Directory_GetFamilyServiceCentres | Yes | yes |
| Directory | Directory_GetNearestCentres | Yes | yes |
| Directory | Directory_GetProgrammeSites | Yes | yes |
| Directory | Directory_GetSocialServiceOffices | Yes | yes |
| Geo | Geo_DistanceKm | No | yes |
| Integration_DataGovSg | DataGovSg_FetchFamilyServiceCentres | No | yes |
| Integration_DataGovSg | DataGovSg_FetchProgrammeSites | No | yes |
| Integration_DataGovSg | DataGovSg_FetchSocialServiceOffices | No | yes |
| Scheme | Scheme_GetRecommendations | Yes | yes |

UI: client action `Directory/Directory_ApplyFilters`; server actions `Authentication/DoLogin`, `DoLogout` (template). UI dependencies on CS are now exactly the 7 actions it calls. 46 screen/block actions, data actions and aggregates got a Description.

Full change list with reasons: docs/SERVICE_STUDIO_CHANGES.md → "Round 9".
