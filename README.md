# SG Family Support Finder

An OutSystems 11 Reactive Web app that helps people in Singapore find social
services, family support and financial assistance. It brings three Ministry
of Social and Family Development datasets from data.gov.sg (**94 service
locations**) into one searchable directory, and adds a short guided
questionnaire that points people to schemes that may fit them and to the
nearest relevant service locations. Public screens need no login; staff
manage centres on a role-protected admin screen. The AWS infrastructure to
run OutSystems 11 self-managed is defined in Terraform, and the app and the
infrastructure are covered by automated tests that run locally with one script.

Built for the GovTech / MSF Low Code Engineer technical assessment. The brief
is `docs/Low Code Engineer JD.pdf` (the assessment is on page 4).

## Submission and access

| What | Where |
|---|---|
| Live app (public, no login) | https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/ |
| Browse Support Services | https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/FindCentres |
| Find Support (questionnaire) | https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/FindSupport |
| Staff screen (CentreAdmin role) | https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/CentreAdmin. Reviewer credentials are provided separately in the submission email. |
| Source repository (public) | https://github.com/dausros/sg-family-support-finder |
| Modules | `SGFamilySupport_LIB` ← `SGFamilySupport_CS` ← `SGFamilySupportFinder` (UI) |
| Infrastructure as code | `infra/` (Terraform, AWS), see `infra/README.md` |
| Automated tests | `tests/` (Playwright, live app), `infra/tests/` (`terraform test`) |
| One script for every check | `scripts/check-all.sh`, run locally (not on GitHub Actions) |
| Test evidence | `docs/test-evidence/` |
| Change log of every Service Studio change | `docs/SERVICE_STUDIO_CHANGES.md` |

The `reviewer` login has the `CentreAdmin` role only. It can add, edit, hide
and show centres, and has no other role. Inspecting the modules in
Service Studio needs access to the OutSystems personal environment, which is
granted separately on request.

### Latest results

| Check | Date | Result |
|---|---|---|
| Playwright, live app, Chromium, `--workers=1`, public specs (no login) | 18 Oct 2026, 18:48–19:04 UTC | **70 passed, 0 failed, 1 skipped** (71 tests; the skip is the logged-in admin flow, not re-run without the login; the 70 include 1 expected failure that tracks known defect D-CSS-01) (`docs/test-evidence/public-run-2026-10-18-evening.md`) |
| Playwright, live app, Chromium, `--workers=1`, with the reviewer login | 18 Oct 2026, 16:42–16:53 UTC | **60 passed, 0 failed, 0 skipped** (the 60 tests that existed then; `docs/test-evidence/reviewer-run-2026-10-18.md`) |
| Accessibility: axe-core, WCAG 2.0 / 2.1 A and AA, every public screen state, 390 px and 1440 px, 4 languages | 18 Oct 2026, 19:01–19:03 UTC | **0 violations** (`tests/accessibility.spec.ts`, 8 tests) |
| `terraform test` (offline, mocked AWS provider) | 18 Oct 2026 | **10 passed, 0 failed** |
| checkov | 18 Oct 2026 | **323 passed, 0 failed, 15 skipped** (each skip has its reason inline; listed in `infra/README.md`) |
| tflint (with the AWS ruleset) | 18 Oct 2026 | **0 issues** |
| `terraform fmt -check`, `terraform validate` | 18 Oct 2026 | pass |
| Real `terraform plan` / `apply` in an AWS account | | **not run** (no AWS account) |

The infrastructure results and the full Playwright output of the
`scripts/check-all.sh` run (16:20–16:29 UTC; 59 passed, 1 skipped, the
skipped test being the logged-in admin flow before the reviewer login
existed) are in `docs/test-evidence/local-run-2026-10-18.txt`.

### Run the tests

```bash
cd tests
npm ci
npx playwright install --with-deps chromium
APP_BASE_URL="https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/" \
  npx playwright test --workers=1
npx playwright show-report        # HTML report
```

`APP_BASE_URL` can be the app root or a screen URL, because the helpers
resolve `FindCentres` / `FindSupport` from either. Run serially: the
personal environment throttles parallel cold loads. The logged-in admin test
runs only when `SGFSF_ADMIN_USER` and `SGFSF_ADMIN_PASS` are set for a
CentreAdmin user; without them it is skipped.

### Run every check locally

```bash
scripts/install-tools.sh   # once: pinned terraform, tflint, checkov (checksum-verified)
scripts/check-all.sh       # Terraform fmt/validate, tflint, checkov, terraform test, Playwright
SKIP_E2E=1 scripts/check-all.sh   # infrastructure checks only
```

No AWS account or credentials are needed: `terraform test` uses mocked
providers. A real `terraform plan` and `apply` need an AWS account and have
not been run; see `infra/README.md`.

## Submission checklist (against the brief)

Each line is an ask from page 4 of `docs/Low Code Engineer JD.pdf`, where it is
met, and the evidence. Status as of 18 Oct 2026. Anything not proven is marked
as such.

| Ask in the brief | Where | Evidence | Status |
|---|---|---|---|
| Retrieve and integrate data from any dataset on data.gov.sg | CS module: three MSF datasets (FSC 55, SSO 24, SFP 15 = 94 records), cached in entities, daily refresh timer | `real-records.spec.ts`, `directory.spec.ts`, `persistence-refresh.spec.ts` pass against the live app | Done. The 03:00 SGT timer run has not been observed yet |
| Present the data through a clear and user-friendly interface | Live app: Browse (`FindCentres`) and Find Support (`FindSupport`), 4 languages | `ux-responsive.spec.ts` (320–1440 px, touch targets, keyboard), `translations.spec.ts`, `accessibility.spec.ts` (axe-core WCAG 2.1 A/AA: 0 violations) | Done. Open UX items are listed in `docs/UX_REVIEW.md` |
| Provide capabilities for users to explore and interact with the data | Search, filters, sort, pagination, details drawer, nearest 3 by postal code, guided questionnaire, share/print, staff add/edit/hide/show | `search`, `directory`, `centre-details-panel`, `nearest`, `findsupport`, `wizard`, `share-print`, `admin` specs | Done |
| Demonstrate sound frontend and backend application design | LIB → CS → UI modules; actions grouped by area with `Area_Verb` names; server-side role checks; audit log ("Architecture", "Design decisions") | TrueChange 0 errors in all modules (warnings listed under "Known limitations") | Done |
| IaC that defines the AWS infrastructure to deploy and operate the OutSystems platforms | `infra/` (Terraform): VPC over 2 AZs, ALB + TLS + WAF, Windows/IIS front-end ASGs, Deployment Controllers, LifeTime, RDS SQL Server (Multi-AZ prod), Amazon MQ (RabbitMQ), KMS, CloudWatch + SNS, AWS Backup, Secrets Manager, remote-state bootstrap | fmt, validate, tflint 0 issues, checkov 323 / 0 / 15 skipped with reasons, `terraform test` 10/10 (`infra/README.md`) | Written and tested offline. **Not verified:** a real `terraform plan` or `apply` in AWS (no AWS account) |
| Include appropriate automated testing | `tests/` (Playwright, live app), `infra/tests/` (`terraform test`), `scripts/check-all.sh` runs all of it | Playwright 60 passed, 0 failed, 0 skipped with the reviewer login (16:42 UTC); 70 passed, 0 failed, 1 skipped (admin flow, no login) after the accessibility and page-health specs were added (18:48–19:04 UTC); `docs/test-evidence/` | Done |
| Submission 1: provide access to the OutSystems environment | Public screens need no login; `/CentreAdmin` with the `reviewer` login (CentreAdmin role only) | Reviewer login checked on the live admin screen; admin test passed with it | Done. Credentials are in the submission email |
| Submission 2: IaC, automated tests and README in a Git repository, with access | This public repository | `infra/`, `tests/`, `infra/tests/`, `scripts/`, this README | Done |

## What the app does

Public screens need no login. Staff use one admin screen.

### 1. Browse Support Services (`FindCentres`)

- One directory of **94 records** from data.gov.sg, served from the CS cache:
  - 55 Family Service Centres (FSC)
  - 24 Social Service Offices (SSO)
  - 15 Strengthening Families Programme locations (SFP)
- **Search:** one full-width search bar with the Search button attached. It matches name, address or postal code.
- **Filters:** two labelled dropdowns, **Service type** and **Sort by**. Each is backed by a Static Entity (`DirectoryServiceType`, `DirectorySortOrder`).
  - "Clear filters" is a text link.
  - Results show `Showing X–Y of N found · Updated …`.
- **Pagination:** the **OutSystems UI Pagination** block, 10 per page. It resets when a filter changes.
- **Cards:** type badge, name, address and contact links in one link colour, plus "View details".
  - The `CentreDetailsPanel` drawer has a map (Leaflet/OpenStreetMap), Get directions, `role=dialog`, closes with Esc, and becomes a full-screen sheet on phones.
- **States:** loading, empty, error-with-Retry and stale-data.

### 2. Find Support (`FindSupport`)

A three-step wizard with explicit Next / Back and no automatic navigation.

1. **Support need:**
   - financial
   - family or relationships
   - children and parenting
   - caregiving / disability
2. **Your household (all optional, one question at a time, "Skip the rest" available):**
   - monthly income and household size (number inputs, numeric keypad)
   - five category questions as **dropdowns backed by CS Static Entities**: household type, marital status, housing type, employment, residency
   - every dropdown has a real `<label for>` and is 56px tall
3. **Help for you:**
   - **Scheme cards:** from the CS `SchemeCatalogue`, via `Scheme_GetRecommendations`, which receives all the answers. Each card says why it may fit, what is still missing, what it gives, documents needed, how to apply, and links to the official page.
   - **Answer chips** with a **Change answers** link.
   - **Nearest centres:**
     - Type a postal code to get the **3 closest Family Service Centres**, with straight-line distance, Call and Directions.
     - Uses OneMap search (no key). Centres without coordinates are geocoded once and stored (`CachedCentre.Latitude/Longitude`).
     - A bad or unknown postal code gets a plain-words message.
   - **Keep or share:**
     - **Share on WhatsApp** (`wa.me` link with a short plain-words summary and the app link).
     - **Print**, with a print stylesheet: no buttons, no clipping, title and date.

Results are framed as **indicative**: the responsible agency decides eligibility. Nothing the public types is stored.

### 3. Manage centres (`CentreAdmin`, staff only)

- **Locked to the `CentreAdmin` role** (defined in CS). Logged-out visitors are sent to Login.
- **Server-side check:** CS `Centre_CreateOrUpdate` and `Centre_SetActive` call `CheckCentreAdminRole()` themselves, so the protection does not rely on hidden UI.
- Search, **Add**, **Edit**, and **Hide / Show** a centre. Nothing is deleted.
  - Hidden centres drop out of Browse and nearest-centres.
  - Admin-edited rows are flagged `IsManagedByAdmin`, so the daily data.gov.sg sync does not overwrite them.
- To give someone access: Users app → the user → add role `CentreAdmin` (SGFamilySupport_CS).

### Accessibility and languages

- All public screens are in **English, Bahasa Melayu, 中文 and தமிழ்**, via the built-in translation table in `AccessBar`. There is also a text-size switch and a skip link.
- 48px+ tap targets and plain words.
- A green focus ring shows **only for keyboard focus**.
- An automated WCAG 2.0 / 2.1 A and AA scan (axe-core) of every public screen state, at 390 px and 1440 px and in all four languages, reports 0 violations (`tests/accessibility.spec.ts`). An automated scan finds only part of what a manual review would; a manual screen-reader pass has not been done.
- Look and feel follows the Singapore Government Design System: flat, 1px borders, 4px radius, one primary and one secondary button style. There is no gov masthead, because this is not an official site.

## Data sources

All three come from data.gov.sg under the Singapore Open Data Licence,
published by the Ministry of Social and Family Development.

| Dataset | Records | Used for |
|---|---|---|
| Family Services (FSC), `d_add23c06f7267e799185c79ccaa2099b` | 55 | Directory, family needs |
| Social Service Offices | 24 | Directory, financial needs |
| Strengthening Families Programme locations | 15 | Directory, family needs |

Retrieval follows data.gov.sg's poll-download pattern:
`GET https://api-open.data.gov.sg/v1/public/api/datasets/<id>/poll-download`
returns `{code, data: {url}}`, and the app downloads the GeoJSON
`FeatureCollection` from the returned signed S3 URL. Postal codes are kept as
Text so leading zeros survive. GeoJSON `coordinates` arrive as
`[longitude, latitude]`.

## Architecture

```
SGFamilySupport_LIB  (Library)      shared Structures / contracts, no logic
        ▲
SGFamilySupport_CS   (Service)      REST integration, entities, sync, caching,
        ▲                           scheme catalogue, public server actions
SGFamilySupportFinder (Reactive)    screens, blocks, navigation, forms, map
```

| Module | Owns |
|---|---|
| `SGFamilySupport_LIB` | Public Structures, e.g. `FamilyServiceCentre` and `SupportLocation` (the contract the UI and CS share). No logic, REST or UI. |
| `SGFamilySupport_CS` | The `DataGovSG` REST client (poll-download + GeoJSON download), GeoJSON DTO Structures and mapping. **Persistent entities** `CachedCentre`, `CachedOffice`, `CachedProgrammeSite`, `SyncStatus` and `AuditLog` (append-only record of admin changes), plus the static `SchemeCatalogue`. Actions are grouped in folders (see **Action structure** below): cache sync, cache-first public getters and `Scheme_GetRecommendations`. |
| `SGFamilySupportFinder` | `FindCentres` and `FindSupport` screens and the reusable `CentreDetailsPanel` block (Leaflet map). Client-side filtering, sort and pagination. Calls only public CS actions; no REST, no business rules. |

### Persistence and caching

- **Entities:** `CachedCentre` (55), `CachedOffice` (24),
  `CachedProgrammeSite` (15), keyed by dataset `OBJECTID`, plus one
  `SyncStatus` row per dataset (`LastSuccess`, `LastAttempt`,
  `RecordCount`, `LastError`).
- **Sync:** `Cache_SyncCentres` / `Cache_SyncOffices` / `Cache_SyncProgrammeSites`
  each do a full replace (delete all, then bulk insert). Each has its own
  exception handler that records the error and keeps the last-known-good
  rows. `Cache_SyncAll` orchestrates them so one dataset's failure
  never clears another.
- **Serving:** `Directory_GetFamilyServiceCentres` /
  `Directory_GetSocialServiceOffices` /
  `Directory_GetProgrammeSites` return the list plus
  `LastSynced`, `FromCache` and `StaleWarning`.
  - If the cache is under 24 h old and has rows, it is served with **zero
    upstream calls**.
  - Otherwise the getter fetches live, refreshes the cache and returns
    the new rows.
  - If upstream fails and rows exist, the getter returns them with "Live
    data is unavailable. Showing last updated records."
- **Timers:** `SeedDatasetCache` (when published) and `RefreshDatasetCache`
  (daily at **03:00 SGT**: schedule 19:00 server time, UTC) call
  `Cache_SyncAll`. If a timer never fires, the first page load after
  the 24 h window refreshes the cache anyway.

### Action structure

Checked in Service Studio through the model API on 18 Oct 2026 (folder, Public flag and description read back after the change). Naming is `Area_Verb…`. Only what the UI calls is Public.

**SGFamilySupport_CS: 17 server actions in use, 0 client actions, in 6 folders** (plus the one-time setup action `User_CreateReviewer` in an `Unused` folder, last row)

| Folder | Action | Public | Called by |
|---|---|---|---|
| Centre | `Centre_CreateOrUpdate` | Yes | UI `CentreAdmin` (checks the CentreAdmin role on the server, writes `AuditLog`) |
| Centre | `Centre_SetActive` | Yes | UI `CentreAdmin` (role check, `AuditLog`) |
| Centre | `Centre_Geocode` | No | `Directory_GetNearestCentres` |
| Directory | `Directory_GetFamilyServiceCentres` | Yes | UI `FindCentres`, `WizardStep3Results` |
| Directory | `Directory_GetSocialServiceOffices` | Yes | UI `FindCentres`, `WizardStep3Results` |
| Directory | `Directory_GetProgrammeSites` | Yes | UI `FindCentres`, `WizardStep3Results` (Strengthening Families Programme sites) |
| Directory | `Directory_GetNearestCentres` | Yes | UI `NearestCentres` block |
| Scheme | `Scheme_GetRecommendations` | Yes | UI `WizardStep3Results` |
| Integration_DataGovSg | `DataGovSg_FetchFamilyServiceCentres` | No | `Directory_GetFamilyServiceCentres` (when the cache is stale) |
| Integration_DataGovSg | `DataGovSg_FetchSocialServiceOffices` | No | `Directory_GetSocialServiceOffices` |
| Integration_DataGovSg | `DataGovSg_FetchProgrammeSites` | No | `Directory_GetProgrammeSites` |
| Cache | `Cache_SyncAll` | No | timers `RefreshDatasetCache` (03:00 SGT) and `SeedDatasetCache` (on publish) |
| Cache | `Cache_SyncCentres` | No | `Cache_SyncAll` |
| Cache | `Cache_SyncOffices` | No | `Cache_SyncAll` |
| Cache | `Cache_SyncProgrammeSites` | No | `Cache_SyncAll` |
| Cache | `Cache_RemoveOverriddenRows` | No | `Cache_SyncCentres`, `Directory_GetFamilyServiceCentres` |
| Geo | `Geo_DistanceKm` (function) | No | `Directory_GetNearestCentres` |
| Unused | `User_CreateReviewer` | No | Nothing. Ran once on 18 Oct 2026 to create the `reviewer` login; kept for the record and does nothing while its site property is empty (`docs/SERVICE_STUDIO_CHANGES.md`, Round 10) |

**SGFamilySupport_LIB:** structures only, no actions.

**SGFamilySupportFinder (UI): screen logic only**
- Module client action: `Directory/Directory_ApplyFilters` (filter, sort and page the already-loaded list; no server call).
- Server actions: `Authentication/DoLogin`, `DoLogout` (OutSystems template).
- Every screen, block, data action and aggregate the app owns has a Description. Screen actions only set screen state, call `Directory_ApplyFilters` or raise block events. Data actions only call the public CS actions above. Aggregates read static lookup entities, plus `CachedCentre` for the admin grid.

Known duplication (left as is on purpose): `Cache_Sync…` call the DataGovSG REST methods directly, while `Directory_Get…` refresh through `DataGovSg_Fetch…`. Merging them would change the refresh path of the live app, so it is listed as a follow-up and not done blind.

## Design decisions and trade-offs

**24-hour cache TTL.** The MSF datasets change rarely (centres open,
move or close a few times a year), while data.gov.sg throttles bursts with
HTTP 429. A daily refresh plus a 24 h freshness window keeps page loads at
zero upstream calls and data at most a day old. A shorter TTL would add
rate-limit exposure for no user-visible gain. If MSF published
change notifications, event-driven refresh would beat polling.

**Full-replace sync.** Each dataset is under 60 rows, so delete-all plus
bulk insert is simpler and more obviously correct than diffing. It is
idempotent on rerun, and removals upstream disappear locally. The cost is
a brief window inside the sync transaction and no change history. At
thousands of rows, an upsert keyed on `OBJECTID` with soft-deletes would
be the right move.

**Client-side filtering and pagination over 94 cached records.** The
whole directory is a few tens of KB, so loading it once and filtering,
sorting and paginating in the browser makes every interaction instant and
costs no server round-trips. It would not scale to tens of thousands of
rows. At that size, server-side aggregates with `Max Records` / `Start
Index` and indexed search columns take over. Filtering uses an explicit
`ForEach` + `ListAppend` because client `ListFilter` could not scope
per-row `Current` references in this runtime.

**LIB / CS / UI split.** LIB holds contracts only, CS owns integration,
data and business rules, and the UI only presents. This follows the
OutSystems Architecture Canvas layering: the UI can be rebuilt (or a
mobile app added) without touching integration, CS can be tested and
reused on its own, and there are no upward or circular references. The
trade-off is three modules to publish in order (LIB → CS → UI), which is
overhead for an app this size.

**Keyless Leaflet + OpenStreetMap.** No API key to provision, rotate or
leak, and no billing account. The map lives only inside
`CentreDetailsPanel`, so screens don't depend on it. Trade-offs: OSM
tiles come from a public CDN under its usage policy, which a production
government service would replace with OneMap (SLA, local addressing).
Directions deep-link to Google Maps rather than an embedded router.

**Timers.** Both timers were first made by hand in Service Studio.
On 18 Oct 2026 the model showed `RefreshDatasetCache` with no schedule, so
it never ran on its own. Its schedule was set through the Service Studio model API
(`Schedule "19:00"`, `CronSchedule "0 19 * * *"`: 19:00 UTC = 03:00
SGT, the quietest hour) and published. The refresh-through getter means the
app still works if a timer is missing or late.

**429 and partial-failure handling.** Each dataset is fetched and cached
independently.
- Find Support shows whichever datasets loaded, with a visible warning
  for the one that didn't. This was verified live during an SFP 429
  episode, when 55 FSC and 24 SSO records still rendered.
- If the cache holds rows, an upstream failure serves stale data with a
  banner rather than an error.
- A total failure shows an error state with Retry.
- Tests click through a transient 429 via Retry, with a time bound, so
  real breakage still fails.

**Indicative, not eligibility.** Eligibility for ComCare and similar
schemes is decided case by case by an officer, from documents. The app
never says someone qualifies. It says a scheme is "potentially relevant",
lists what it can't know ("Residency not stated…"), and links to the
official page and channel. Household inputs are optional and never block
results. This keeps the app honest and avoids misleading vulnerable users.

**Other choices.**
- Postal codes are stored as Text.
- No personal data is persisted: wizard answers live only in screen
  variables.
- FSC retrieval hands the signed download URL to the REST call through a
  CS site property (validated S3 host, overwritten right before use),
  while SSO and SFP use a request-scoped header. Site properties are
  shared environment state, so moving FSC to the header pattern would be
  cleaner. It was deferred to avoid re-verifying a working path.

## Automated tests

All checks run locally with one script, not on GitHub Actions:

```bash
scripts/install-tools.sh     # once: pinned terraform 1.9.8, tflint 0.64.0, checkov 3.3.29
scripts/check-all.sh         # everything; SKIP_E2E=1 for infrastructure only
```

`check-all.sh` runs Terraform fmt / init / validate (root and `bootstrap/`),
tflint, checkov, `terraform test`, then the Playwright suite against the live
app in serial batches (any new spec file is picked up in a final batch). It prints a summary and exits non-zero if
anything fails. The workflow files in `.github/workflows/` are kept as they
were, but the results below come from local runs.

**Latest run: 18 Oct 2026, 16:20–16:29 UTC (00:20–00:29 SGT on 19 Oct)** (full output: `docs/test-evidence/local-run-2026-10-18.txt`)

The run used the infrastructure, test and script files of master at
`43267998d0774454e0f66a857d8c9ff35ab6e91c` (the merge of pull request #6), from a
working copy rather than a git checkout, so the log's `Commit:` line reads "not
a git checkout". Per-spec counts in the table below match the log.

| Check | What it tests | Result |
|---|---|---|
| `terraform fmt -check -recursive` | Formatting of all `.tf` files | pass |
| `terraform validate` (root, `bootstrap/`) | Syntax, types, references | pass, pass |
| `tflint --recursive` | Terraform recommended rules + AWS ruleset (e.g. invalid instance types) | 0 issues |
| `checkov` | Security misconfiguration scan | 323 passed, 0 failed, 15 skipped (each skip has its reason inline, listed in `infra/README.md`) |
| `terraform test` | 10 offline plan runs with mocked AWS: Multi-AZ prod RDS, encryption, no world-open SQL/RDP, HTTPS with TLS 1.2+, 301 redirect, WAF rules, alarms, backups ≥ 35 days, OutSystems port matrix, rejected bad inputs | 10 passed, 0 failed |
| Playwright (Chromium, `--workers=1`, live app) | User journeys, data, languages, hotline, responsive layout, staff admin (table below) | 59 passed, 0 failed, 1 skipped in this run (admin login not yet available); **60 passed, 0 failed, 0 skipped** in the re-run with the reviewer login (below) |
| Real `terraform plan` / `apply` in AWS | Whether AWS accepts the plan | **not run** (no AWS account) |

### Playwright (live app), by spec

Playwright end-to-end and responsive tests in `tests/` run against the live
app. The two `[MOCKED]` specs abort the browser→OutSystems screen-action
call to exercise the error/Retry path. They are labelled as mocks and are not
evidence of server-side fallback.

**Latest full run: 18 Oct 2026, 18:48–19:04 UTC (02:48–03:04 SGT on 19 Oct), Chromium, `--workers=1`, against the live app, without a login: 70 passed, 0 failed, 1 skipped (71 tests).** The skipped test is the logged-in admin flow, which needs the reviewer login and was not re-run. The 70 include one expected failure (`test.fail`) that tracks known defect D-CSS-01. Evidence: `docs/test-evidence/public-run-2026-10-18-evening.md`.

**Latest run with the `reviewer` CentreAdmin login: 18 Oct 2026, 16:42–16:53 UTC (00:42–00:53 SGT on 19 Oct): 60 passed, 0 failed, 0 skipped (the 60 tests that existed then).** Evidence: `docs/test-evidence/reviewer-run-2026-10-18.md`.

Earlier runs the same day: 16:20–16:29 UTC through `scripts/check-all.sh`, 59 passed, 0 failed, 1 skipped (the admin flow, before the login existed; full output in `docs/test-evidence/local-run-2026-10-18.txt`); 23:44–23:53 SGT after the actions tidy and Listen fix, 59 passed, 0 failed, 1 skipped (60 tests); 21:59–22:09 SGT, 54 passed, 0 failed, 1 skipped (55 tests). In the 21:59 run, the first run of `persistence-refresh.spec.ts` failed 2 tests because the app had switched to `Updated dd/MM/yyyy HH:mm SGT` and the parser still expected `dd MMM yyyy, HH:mm`; the parser was updated and the spec re-run: 4/4.

Per-spec counts below are from the 18:48–19:04 UTC run. The logged-in admin test was skipped there; it passed in the 16:42 UTC run with the reviewer login.

| Spec | Passed | Failed | Covers |
|---|---|---|---|
| `accessibility.spec.ts` | 8 | 0 | axe-core WCAG 2.0 / 2.1 A and AA on Browse, details panel, no results, Find Support steps 1–3 (390 px and 1440 px), Browse in ms / 中文 / தமிழ், staff sign-in page: 0 violations |
| `admin.spec.ts` | 1 (+1 skipped) | 0 | CentreAdmin screen redirects to Login when logged out; logged-in add, edit, hide and show a centre (needs `SGFSF_ADMIN_USER` / `SGFSF_ADMIN_PASS`, skipped without them) |
| `api-error-retry.mock.spec.ts` | 1 | 0 | [MOCKED] screen-action failure shows error + Retry |
| `app-loads.spec.ts` | 2 | 0 | app loads, loading indicator resolves |
| `centre-details-panel.spec.ts` | 5 | 0 | details drawer open/update/Escape, directions/contact targets, mobile sheet |
| `contact-directions.spec.ts` | 1 | 0 | contact details and directions link |
| `directory.spec.ts` | 4 | 0 | 94 records across 3 types, Service type dropdown + search, OSUI Pagination, Sort by dropdown |
| `dropdowns.spec.ts` | 1 | 0 | category questions are labelled dropdowns and feed the ranking |
| `findsupport.spec.ts` | 10 | 0 | 4 needs without login, one question per screen, ranking (KidSTART first for parenting, "May not apply" only on a published rule), real tel: links, skip-the-rest, language picker, bigger text |
| `hotline.spec.ts` | 2 | 0 | Browse "Help now" is `tel:18002220000`; Find Support money results call ComCare 1800 222 0000; 1800 777 0000 appears nowhere |
| `listen.spec.ts` | 5 | 0 | Listen reads ms/zh/ta text with a ms-MY / zh-CN / ta-IN voice; with only English voices it shows the translated "no voice" note and speaks nothing; English unchanged (Web Speech API stubbed: headless Chromium has no voices) |
| `nearest.spec.ts` | 2 | 0 | bad/unknown postal code messages; 3 nearest sorted by distance with call + directions |
| `no-results.spec.ts` | 1 | 0 | empty state for a gibberish query |
| `page-health.spec.ts` | 3 | 0 | no uncaught script errors on the public screens; every app stylesheet and script loads (expected failure, tracks D-CSS-01); Browse shows results within 5 s on a repeat visit at 390 px |
| `persistence-refresh.spec.ts` | 4 | 0 | cached timestamp stable, <24 h freshness (SGT stamp), no duplicates, [MOCKED] fault + Retry |
| `real-records.spec.ts` | 1 | 0 | real FSC records from data.gov.sg render |
| `search.spec.ts` | 2 | 0 | case-insensitive search by name/address |
| `share-print.spec.ts` | 1 | 0 | WhatsApp link text, print view not clipped, no printed URLs, multi-page PDF |
| `timezone.spec.ts` | 1 | 0 | "Updated … SGT" is identical under UTC, Asia/Singapore and America/Los_Angeles device clocks, and under 48 h old |
| `translations.spec.ts` | 4 | 0 | Browse in English, Bahasa Melayu, 中文 and தமிழ்: filter labels, dropdown options, SGT stamp (no stray comma in 中文), Call links' accessible names |
| `ux-responsive.spec.ts` | 7 | 0 | no horizontal overflow 320–1440 px, 390 px touch targets, keyboard reach, headings/labels/lang, skip link |
| `wizard.spec.ts` | 4 | 0 | need selection doesn't auto-navigate, Next/Back keeps the selection, household dropdown, all optional answers skippable |

Not covered by automated tests:
- Server-side unit tests of CS logic (e.g. BDDFramework). Caching is
  proven through observable behaviour (stable timestamp, zero refetch,
  no duplicates), not by asserting on entities directly.
- The timers firing (the 03:00 SGT run is not observed by any test).
- Cross-browser runs beyond Chromium.
- A manual screen-reader review (axe-core covers the automatable part of WCAG
  only).

## Infrastructure (AWS reference)

`infra/` is a Terraform reference for running **self-managed OutSystems 11**
on AWS. It covers:
- a VPC over two AZs, with a NAT gateway per AZ behind a toggle
- Dev / Test / Prod front-end ASGs behind one ALB with host routing
- a Deployment Controller per environment and a dedicated LifeTime server
- RDS SQL Server, Multi-AZ for prod
- Amazon MQ for RabbitMQ as the cache invalidation service
- ACM + HTTPS with an HTTP→HTTPS redirect, WAFv2 managed rules, optional
  Route 53
- CloudWatch logs and alarms wired to SNS, AWS Backup, KMS
- an optional S3 + DynamoDB remote-state backend
- per-environment tfvars examples

Checked locally on 18 Oct 2026: `fmt`, `validate` and `tflint` pass; checkov
reports 323 passed / 0 failed / 15 skipped (9 findings fixed, 15 accepted
with the reason written next to each resource); `terraform test` runs 10
offline plans with mocked AWS and passes all of them. Those tests found one
real defect, now fixed: the first `terraform plan` in a fresh account would
have failed on the LifeTime security-group rules. The topology diagram, cost
notes, assumptions and the test list are in `infra/README.md`. The working
app runs on OutSystems Cloud, not on this design. A real `terraform plan` or
`apply` in AWS has not been run (no AWS account).

## Assumptions

- The three data.gov.sg datasets are the authoritative public lists. Record
  counts (55 / 24 / 15) are as published in October 2026 and will drift.
- Scheme content is a curated static catalogue, checked against official
  pages on 17 Oct 2026. It needs periodic review because schemes and
  criteria change. It is guidance, not policy.
- Anonymous access is right for a discovery tool, so no login is needed
  and nothing is stored.
- The public screens are in English, Bahasa Melayu, 中文 and தமிழ். Only the
  staff `/CentreAdmin` screen is English only.
- Infrastructure assumptions (Amazon MQ, RDS for SQL Server, versions,
  sizing) are listed with sources in `infra/README.md`.

## Known limitations

- The timers live only in the Service Studio module (see design
  decisions). The first scheduled 03:00 SGT run is on 19 Oct 2026 and has
  not been observed yet.
- The FSC download-URL handoff uses a site property (see design decisions).
- TrueChange (read 18 Oct 2026): UI 0 errors / 4 warnings, all by design:
  3 public read-only directory fetches on an anonymous screen (the
  "Security Warnings" line at each UI publish) and one On Ready data
  access. CS 0 errors / 1 warning: "unused action" for the one-time
  `User_CreateReviewer`, kept for the record instead of deleted. LIB 0 / 0.
- No OAP export of the modules is committed yet.
- The AWS infrastructure is checked offline only (fmt, validate, tflint,
  checkov, `terraform test` with a mocked provider). A real `terraform plan`
  or `apply` in an AWS account has not been run, because no AWS account was
  available. The Terraform provisions AWS infrastructure only: installing and
  licensing the Platform Server, Service Center and LifeTime on the hosts is
  out of its scope (`infra/README.md`).
- The admin test adds a test centre on the live app and leaves it hidden, so
  each logged-in run adds one hidden row to the admin list.
- Tests run on Chromium only, against the live personal environment, which
  can be slow on a cold start.
- Known defect D-CSS-01: every screen requests
  `SGFamilySupportTheme.extra.css`, which the server answers with a 404, so the
  browser console shows a stylesheet error on every screen. The visible theme
  loads from `SGFamilySupportTheme.css`. Tracked by an expected-failure test in
  `tests/page-health.spec.ts`; the cause is not yet verified.
- Open UX items from the 18 Oct 2026 review (template sign-in page, emoji used
  as icons, heading structure on Browse, link previews, the web server's plain
  404 page) and the planned Service Studio changes for each are in
  `docs/UX_REVIEW.md`.

## Development workflow

- The app is built in Service Studio (OutSystems 11). Model changes were
  made in small steps, each followed by a TrueChange check (0 errors before
  every publish) and a live test run. Every change is logged with its reason
  in `docs/SERVICE_STUDIO_CHANGES.md`.
- Supporting reviews: `docs/O11_BEST_PRACTICES_REVIEW.md`,
  `docs/SECURITY_REVIEW.md`, `docs/ACTIONS_AUDIT.md`,
  `docs/ASSESSMENT_CHECKLIST.md`, and `docs/UX_REVIEW.md`.
- Infrastructure and tests are plain files in this repository and are
  checked locally with `scripts/check-all.sh`.
