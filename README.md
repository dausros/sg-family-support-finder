# SG Family Support Finder

OutSystems 11 Reactive Web application that helps Singapore residents find publicly listed Family Service Centres from the Ministry of Social and Family Development (MSF) dataset on data.gov.sg. Users can search centres by name, address or postal code, view published contact details, and open directions.

## MSF relevance

MSF is Singapore's lead ministry for social and family policies, delivering services through Family Service Centres, Social Service Offices and partners. This directory surfaces the published Family Service Centre list so residents can find support near them.

## Dataset source and attribution

- Dataset: Family Services (GEOJSON), MSF, via data.gov.sg
- Dataset ID: `d_add23c06f7267e799185c79ccaa2099b`
- Dataset page: https://data.gov.sg/datasets/d_add23c06f7267e799185c79ccaa2099b/view
- Access pattern (poll-download): `GET https://api-open.data.gov.sg/v1/public/api/datasets/d_add23c06f7267e799185c79ccaa2099b/poll-download` returns `{code, data:{url}}`; the app then downloads the GeoJSON `FeatureCollection` from the returned URL.
- Licence: Open Data Licence (free for personal or commercial use). Source: Ministry of Social and Family Development (2019), via data.gov.sg.
- Verified record shape: `properties` (`OBJECTID`, `NAME`, `ADDRESSBLOCKHOUSENUMBER`, `ADDRESSSTREETNAME`, `ADDRESSFLOORNUMBER`, `ADDRESSUNITNUMBER`, `ADDRESSPOSTALCODE`, `TELEPHONE`, `EMAIL`, `DESCRIPTION`), `geometry.coordinates` as `[longitude, latitude]`. Example: `Lakeside Family Centre (Jurong West)`.

## Implemented functionality (verified live 17 Oct 2026 — redesigned UI)

Published: https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/FindCentres (public, no login).

- `FindCentres` is now a combined **Browse Support Services** directory (94
  records: 55 FSC + 24 SSO + 15 SFP) served from the CS cache with
  `Kind`-badged uniform cards in a responsive 2-column grid.
- Search by name/address/postal code combines with a service-type segmented
  filter (All/FSC/SSO/FSP), A–Z/Z–A sort, one-click Clear filters and an
  active-filter summary. Live results: `lakeside`→2, `jurong`→5+FSC scope,
  gibberish→empty state with recovery hint.
- Real client-side pagination (10 per page, `Showing X–Y of N found`,
  First/Prev/numbered/Next/Last with clamping and reset-on-filter). No
  upstream calls on paginate/filter — cached retrieval only.
- Each card: type badge, service name, composed address + postal code,
  contact links (empty tel/mailto suppressed), prominent View details
  opening the drawer. Detailed actions live in `CentreDetailsPanel`.
- Branded header (Browse Services / Find Support, current-page indication,
  no dead Login link), compact journey hero, single consolidated footer.
- States: loading indicator, no-results message, API-error message with
  working Retry. Character-encoding verified: MWS en-dashes render
  correctly (Latin-1 mojibake repaired at the mapping layer).

## FindSupport — guided support discovery (enhancement, verified live 17 Oct 2026)

Published: https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/FindSupport (public, no login, no user data stored).

- Three-step wizard with explicit progression: (1) support need selection
  (no auto-advance; visible selection echo + Continue), (2) one coherent
  household form (situation options select without submitting, optional
  income/size/employment/residency, single Back | View results footer,
  non-negative income / positive household-size validation with an inline
  message and no silent advance), (3) recommendations.
- Live datasets: SSO (24) + FSC (55) + SFP (15) via CS actions
  `GetSocialServiceOffices` / `GetStrengtheningFamiliesServices`
  (request-scoped header handoff, no shared state); per-dataset failures
  degrade to a visible warning instead of blocking the screen — verified
  live during an upstream SFP 429 episode (55 FSC + 24 SSO rendered).
- Financial → ComCare guidance + verified MSF link + SSO cards; family /
  children → FSC + SFP cards with guarded contact links; caregiving →
  SG Enable + Enabling Guide referrals only (no invented matches).
  Wording is "potentially relevant" throughout; no eligibility claims.
- Bidirectional nav with `FindCentres`; `SupportLocation` shared contract
  in LIB; Playwright `findsupport.spec.ts` (6 tests).

## Architecture (three modules)

Dependency direction: `SGFamilySupport_LIB` ← `SGFamilySupport_CS` ← `SGFamilySupportFinder` (Finder also references LIB directly for contracts). No persistent Entities, no circular dependencies.

| Module (type) | Owns |
|---|---|
| `SGFamilySupport_LIB` (Library) | Shared `FamilyServiceCentre` + `SupportLocation` Structures as public contracts; no logic, REST, or UI |
| `SGFamilySupport_CS` (Service) | `DataGovSG` REST (FSC poll/download + `OnBeforeRequest` full-URL override; SSO/SFP poll/download via request-scoped header handoff), CS-local `GeoJSONDownloadUrl` site property (FSC path), GeoJSON DTO Structures, public live getters `GetFamilyServiceCentres` / `GetSocialServiceOffices` / `GetStrengtheningFamiliesServices` (`CentreList`/`LocationList`, `Success`, `ErrorMessage`), **plus the persistence layer below** |
| `SGFamilySupportFinder` (Reactive Web) | `FindCentres` screen (local `ForEach` filter) + `FindSupport` guided screen (category matching, local lists, partial-failure warnings), `OnInitialize` fetch chains calling the cached CS getters, `OpenExternalUrl`/`OpenSupportUrl` links. No REST consumption, no backend logic, no duplicate contracts |

## Persistence and caching (verified live 16 Oct 2026)

`SGFamilySupport_CS` stores the three datasets in persistent Entities so
repeat visits serve stored data without upstream calls:

- Entities: `CachedCentre` (55 FSC rows), `CachedOffice` (24 SSO rows),
  `CachedProgrammeSite` (15 SFP rows) — each keyed by the dataset `OBJECTID`
  plus a `SyncStatus` row per dataset (`Dataset`, `LastSuccess`,
  `LastAttempt`, `RecordCount`, `LastError`).
- Sync: `SyncCentresCache` / `SyncOfficesCache` / `SyncProgrammeCache`
  (full replace per run — delete-all then bulk insert — so reruns are
  idempotent; each has its own exception handler that records the error in
  `SyncStatus` and keeps last-known-good rows), orchestrated by input-less
  `SyncDatasetCaches` (one dataset's failure never clears the others).
- Serving: public `GetCachedFamilyServiceCentres` /
  `GetCachedSocialServiceOffices` /
  `GetCachedStrengtheningFamiliesServices` (same list outputs plus
  `LastSynced`, `FromCache`, `StaleWarning`). Fresh cache (< 24 h old with
  rows) is served with zero upstream calls; otherwise the action
  refresh-through-fetches live, replaces the cache and updates the status;
  if upstream fails and cached rows exist, they are returned with
  `StaleWarning = "Live data is unavailable. Showing last updated records."`
  instead of an error. The UI renders `LastSynced` as
  `· Updated dd MMM yyyy, HH:mm` next to the results count.
- Timers (created in Service Studio — the MCP merge on 11.55.92 rejects the
  newer timer-schedule feature, so timers are Studio-authored, not
  model-API-authored): `SeedDatasetCache` (on publish) and
  `RefreshDatasetCache` (daily), both calling `SyncDatasetCaches` with a
  20-minute timeout. Even if a timer never fires, the first screen load
  self-seeds the cache through refresh-through.
- Data fidelity: full Oct 2026 scans of all three datasets show no mojibake
  or control characters; the only non-ASCII content is legitimate en-dashes
  in MWS centre names, which persist and render end-to-end.

## REST integration

Two-step retrieval in `GetFamilyServiceCentres`:
1. `GET` poll-download endpoint → require `code = 0` and a download URL
   starting with `https://s3.ap-southeast-1.amazonaws.com/` containing the
   dataset path (full signed query string preserved verbatim; nothing
   hardcoded). Failures return `Success = False` with a retryable message.
2. The signed URL is handed to the `DownloadGeoJSON` REST method via the
   `GeoJSONDownloadUrl` site property; a documented `OnBeforeRequest`
   callback replaces `BaseURL` with that exact URL (other calls pass
   through untouched; no credentials forwarded) → parse GeoJSON
   `FeatureCollection.features` → map each feature to `FamilyServiceCentre`
   (postal code kept as Text; `coordinates[0]`→Longitude, `[1]`→Latitude;
   empty feature list → no-results state).
3. Client `OnSearch` filters the fetched list locally with an explicit
   `ForEach` + `ListAppend` into a separate result list (the client
   `ListFilter` action cannot scope per-row `Current` references — verified
   against the shipped runtime), plus an `OnInitialize` exception handler so
   transport failures reach the error/Retry UI instead of hanging on load.

## Structures and server actions (as published)

- `FamilyServiceCentre`: `CentreId` Integer, `CentreName`/`Address`/`PostalCode`/`Telephone`/`Email` Text, `Latitude`/`Longitude` Decimal (redundant `Name` removed).
- GeoJSON mapping Structures: `PollDownloadData`, `PollDownloadResponse`, `GeoJSONProperties`, `GeoJSONGeometry` (Decimal-list coordinates), `GeoJSONFeature`, `GeoJSONCollection`.
- `GetFamilyServiceCentres` outputs `CentreList` (FamilyServiceCentre List), `Success` Boolean, `ErrorMessage` Text; full flow with validation If, site-property handoff, `ForEach` mapping via `ListAppend`, and an `AllExceptions` handler.
- `DataGovSG` REST client + `OnBeforeRequest` callback (see above).
- TrueChange: **0 errors** (expected warnings only: template role defaults, OnInitialize server-call performance notes, public-screen security notes).
- Last publication: success (16 Oct 2026).

## CentreDetailsPanel (reusable block, verified live 16 Oct 2026)

- `CentreDetailsPanel` Web Block (inputs `IsOpen`, `Location : SupportLocation`, `CentreType`; event `OnClose`): right-side drawer with type badge, address/postal/telephone+Call/email+Email, Get Directions / Open in Google Maps links, empty-contact fallback text, Esc-to-close with focusable Close, `role=dialog` semantics. Used by FindCentres (`FSC`) and FindSupport (FSC/SSO/SFP kinds).
- Keyless Leaflet map (OpenStreetMap tiles via CDN, marker + popup, resize handling, guarded when coordinates are absent): no Google Maps API key, no billing. Raw coordinates are hidden from view (present in markup only for the map reader).
- No map widget dependency in FindCentres/FindSupport themselves; the only map lives inside the panel block.

## Application access

- Published `FindCentres`: https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/FindCentres (public directory, no authentication).
- No credentials in this repository.

## Automated testing

- `tests/` (Playwright): app-loads (+loading resolves), real-records (+results count),
  search (case-insensitive `lakeside` variants + independent `tampines` term),
  no-results, contact/directions (+address fragment), labelled `[MOCKED]`
  offline/browser-channel error-retry. Base URL via `APP_BASE_URL` env only
  (run serially: `npx playwright test --workers=1`).
  Deterministic waits (`expect.poll`, `waitForFunction`); no fixed sleeps; no
  hardcoded environment URLs. Audited read-only by test-reviewer; corrections applied.
- Status: **30 passed, 0 failed (16 Oct 2026)** serially (`--workers=1`) on the
  pre-redesign publish, including the four enabled persistence specs.
  Redesign verification (17 Oct 2026): combined directory (94 records),
  wizard/pagination/filter specs (`wizard.spec.ts`, `directory.spec.ts`)
  added; existing specs adapted to the explicit-Continue wizard and renamed
  data channels; full serial re-verification in progress — see
  `tests/README.md` for the final recorded result. Previously verified
  suites (carried over): 8 FindCentres specs (app-loads ×2, real-records, search
  ×2 button-triggered, no-results, contact-directions via popup-URL
  assertion since O11 action links render `href="#"`, `[MOCKED]`
  screenservices-abort error/retry with recovery) + 6 FindSupport specs
  (guided form, per-category live records, income/household neutrality,
  official-link popups, bidirectional nav) + 5 CentreDetailsPanel specs
  (sidebar open/update/Escape/directions/mobile sheet) + 7 responsive/a11y
  specs (overflow-free viewports 320→1920, touch targets, keyboard reach,
  semantic headings, focusable skip link, visibly rendering map) + 4 persistence
  specs (repeat-visit timestamp/record stability, <24h freshness, reload/Retry
  no-duplicates, `[MOCKED]` channel fault/recovery). Test corrections made for real
  O11 behavior only (explicit Search-button trigger, boolean-poll
  assertions instead of strict-mode-violating `.or()` chains, popup-URL
  instead of `href` assertion, generous first-load timeouts, updated
  screenservices action-name patterns after the cache-first rebind); no defect
  hidden. See `tests/README.md`.

## AWS IaC

- `infra/` (Terraform): reference VPC/subnets, ALB, Windows/IIS hosts, RDS SQL Server, IAM, CloudWatch, Secrets Manager placeholder. Provisions generic AWS landing zone only.
  Audited by iac-reviewer: fixed secrets-wiring mismatch (RDS-managed master secret now readable), scoped ALB egress, removed DB allow-all egress, enforced IMDSv2, removed dead `db_name` variable, fmt-style realignment.
- Does NOT install/license/configure OutSystems, LifeTime, or deploy this app. `terraform apply` out of scope (costs). Validated 15 Oct 2026 with Terraform v1.16.5: `init -backend=false`, `fmt -check -recursive` and `validate` all pass (one genuine `jsonencode` paren fix in the S3 log-bucket policy found by `init`). See `infra/README.md`.

## Assumptions and trade-offs

- Structure list (not Entities) for live contracts and UI mapping; persistent
  Entities only for the dataset cache + sync metadata (small tables, full
  replace, no timers in MCP-authored code).
- Fetch-once + client-side filter: avoids repeated API calls for a ~44 KB dataset; server action keeps HTTP/mapping out of the UI. Cache-first serving extends this across visits: fresh cache means zero upstream calls per page load.
- Postal code as Text preserves leading zeros/variable formats.
- Three modules share one publish order (LIB → CS → Finder UI) to minimise scope, publish ordering and dependency risk for this assessment.
- Directions via Google Maps links and panel Leaflet map (OpenStreetMap tiles, keyless CDN): no Google Maps API key, no billing.

## Known limitations

- The download URL travels via the `GeoJSONDownloadUrl` site property
  (validated S3 host + dataset path, overwritten on every successful poll
  immediately before use). Site properties are shared environment state,
  not request-scoped storage — this is a known design trade-off: a
  header-scoped handoff through `OnBeforeRequest` would be cleaner but was
  deferred to avoid re-verifying the working retrieval path.
- The two cache timers were created directly in Service Studio because the
  MCP model API writes a timer-schedule feature that Studio 11.55.92
  refuses to merge; their definitions live only in the module, not in any
  scripted change.
- The platform top menu (app title, Login link) is stock OutSystems chrome;
  the shared `Common/Menu` block was intentionally left untouched.
- Pre-existing `Common/Login` + `Common/InvalidPermissions` role warnings are untouched template defaults.
- `terraform apply` never executed (would create chargeable resources); the
  app itself runs on the OutSystems Cloud personal environment, not on the
  reference AWS design.
