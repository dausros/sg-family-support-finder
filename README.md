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

## Implemented functionality (verified live 15 Oct 2026)

Published: https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/FindCentres (public, no login).

- `FindCentres` screen: title + introduction, labelled search input + Search
  button, live results count, responsive centre cards.
- Case-insensitive local filtering by centre name, address and postal code
  (dataset fetched once per page load; verified zero external calls on
  search). Live results: `lakeside`→2, `jurong`→5, `640516`→1,
  `tampines`→3, gibberish→0 with empty state, clear→55.
- Each result: centre name, composed address, postal code, telephone
  (`tel:`), email (`mailto:`), Google Maps directions link (verified popup
  destination, e.g. `.../maps/dir/?api=1&destination=516 Jurong West St 52,
  Singapore 640516`).
- States: loading indicator, no-results message, API-error message with
  working Retry (incl. transport-failure path via `OnInitialize` exception
  handler). Playwright: **8/8 pass**.

## FindSupport — guided support discovery (enhancement, verified live 16 Oct 2026)

Published: https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/FindSupport (public, no login, nothing stored).

- Guided form: support need (financial / family / children / caregiving),
  optional income (explicitly not used for eligibility), household
  situation; category buttons switch transparent local matching.
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
| `SGFamilySupport_CS` (Service) | `DataGovSG` REST (FSC poll/download + `OnBeforeRequest` full-URL override; SSO/SFP poll/download via request-scoped header handoff), CS-local `GeoJSONDownloadUrl` site property (FSC path), GeoJSON DTO Structures, public `GetFamilyServiceCentres` / `GetSocialServiceOffices` / `GetStrengtheningFamiliesServices` (`CentreList`/`LocationList`, `Success`, `ErrorMessage`) |
| `SGFamilySupportFinder` (Reactive Web) | `FindCentres` screen (local `ForEach` filter) + `FindSupport` guided screen (category matching, local lists, partial-failure warnings), `OnInitialize` fetch chains, `OpenExternalUrl`/`OpenSupportUrl` links. No REST consumption, no backend logic, no duplicate contracts |

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
- TrueChange: **0 errors** (5 expected warnings: template role defaults, OnInitialize server-call performance note, public-screen security note).
- Last publication: success (15 Oct 2026).

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
- Status: **PASS 14/14 (16 Oct 2026)** serially (`--workers=1`) on the
  published URLs: 8 FindCentres specs (app-loads ×2, real-records, search
  ×2 button-triggered, no-results, contact-directions via popup-URL
  assertion since O11 action links render `href="#"`, `[MOCKED]`
  screenservices-abort error/retry with recovery) + 6 FindSupport specs
  (guided form, per-category live records, income/household neutrality,
  official-link popups, bidirectional nav). Test corrections made for real
  O11 behavior only (explicit Search-button trigger, boolean-poll
  assertions instead of strict-mode-violating `.or()` chains, popup-URL
  instead of `href` assertion, generous first-load timeouts); no defect
  hidden. See `tests/README.md`.

## AWS IaC

- `infra/` (Terraform): reference VPC/subnets, ALB, Windows/IIS hosts, RDS SQL Server, IAM, CloudWatch, Secrets Manager placeholder. Provisions generic AWS landing zone only.
  Audited by iac-reviewer: fixed secrets-wiring mismatch (RDS-managed master secret now readable), scoped ALB egress, removed DB allow-all egress, enforced IMDSv2, removed dead `db_name` variable, fmt-style realignment.
- Does NOT install/license/configure OutSystems, LifeTime, or deploy this app. `terraform apply` out of scope (costs). Validated 15 Oct 2026 with Terraform v1.16.5: `init -backend=false`, `fmt -check -recursive` and `validate` all pass (one genuine `jsonencode` paren fix in the S3 log-bucket policy found by `init`). See `infra/README.md`.

## Assumptions and trade-offs

- Structure list (not Entities): correct for small read-only external dataset; no local persistence, no timers.
- Fetch-once + client-side filter: avoids repeated API calls for a ~44 KB dataset; server action keeps HTTP/mapping out of the UI.
- Postal code as Text preserves leading zeros/variable formats.
- Single module chosen over Core/UI split to minimise scope, publish ordering and dependency risk for this assessment.
- Directions via Google Maps link (no map widget dependency).

## Known limitations

- The download URL travels via the `GeoJSONDownloadUrl` site property
  (validated S3 host + dataset path, overwritten on every successful poll
  immediately before use). Site properties are shared environment state,
  not request-scoped storage — this is a known design trade-off: a
  header-scoped handoff through `OnBeforeRequest` would be cleaner but was
  deferred to avoid re-verifying the working retrieval path.
- The platform top menu (app title, Login link) is stock OutSystems chrome;
  the shared `Common/Menu` block was intentionally left untouched.
- Pre-existing `Common/Login` + `Common/InvalidPermissions` role warnings are untouched template defaults.
- `terraform apply` never executed (would create chargeable resources); the
  app itself runs on the OutSystems Cloud personal environment, not on the
  reference AWS design.
