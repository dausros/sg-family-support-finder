# SG Family Support Finder

An OutSystems 11 Reactive Web app that helps people in Singapore find social
services, family support and financial assistance. It brings three
government open datasets (**94 service locations**) into one searchable
directory, and adds a guided questionnaire that points people to
potentially relevant schemes and the right type of service location.

Built for the GovTech / MSF Low Code Engineer technical assessment. The brief
is `docs/Low Code Engineer JD.pdf`.

- Live app: https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/
  (public, no login)
- Modules: `SGFamilySupport_LIB` ← `SGFamilySupport_CS` ← `SGFamilySupportFinder`
- Tests: Playwright, **54 passed / 0 failed / 1 skipped** against the live app (18 Oct 2026).
  The skipped test is the logged-in admin flow, which needs a CentreAdmin test login.
- Infrastructure: Terraform AWS reference for self-managed OutSystems 11 in `infra/`

## Submission and access

| What | Where |
|---|---|
| OutSystems app (Browse) | https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/FindCentres |
| OutSystems app (Find Support) | https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/FindSupport |
| Source repo | `dausros/sg-family-support-finder` (private; reviewers need to be added as collaborators) |
| Tests | `tests/`, how to run below |
| Infrastructure as code | `infra/`, see `infra/README.md` |
| CI | `.github/workflows/` (Terraform checks on push/PR; Playwright on manual dispatch) |

Both screens are anonymous, so reviewers can use the app without an
account. Inspecting the modules in Service Studio needs access to the
OutSystems personal environment, which the owner grants separately.

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
personal environment throttles parallel cold loads. In GitHub, run the
**Playwright (live app)** workflow with the `app_base_url` input. It uploads
the HTML report as an artifact.

### Run the Terraform checks

```bash
cd infra
terraform init -backend=false
terraform fmt -check -recursive
terraform validate
```

No AWS credentials are needed for these. `terraform plan` and `apply`
need an account and have not been run; see `infra/README.md`.

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
   - **Scheme cards:** from the CS `SchemeCatalogue`, via `GetSchemeRecommendations`, which receives all the answers. Each card says why it may fit, what is still missing, what it gives, documents needed, how to apply, and links to the official page.
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
| `SGFamilySupport_CS` | The `DataGovSG` REST client (poll-download + GeoJSON download), GeoJSON DTO Structures and mapping. **Persistent entities** `CachedCentre`, `CachedOffice`, `CachedProgrammeSite`, `SyncStatus` and `AuditLog` (append-only record of admin changes), plus the static `SchemeCatalogue`. Sync actions, cache-first public getters and `GetSchemeRecommendations`. |
| `SGFamilySupportFinder` | `FindCentres` and `FindSupport` screens and the reusable `CentreDetailsPanel` block (Leaflet map). Client-side filtering, sort and pagination. Calls only public CS actions; no REST, no business rules. |

### Persistence and caching

- **Entities:** `CachedCentre` (55), `CachedOffice` (24),
  `CachedProgrammeSite` (15), keyed by dataset `OBJECTID`, plus one
  `SyncStatus` row per dataset (`LastSuccess`, `LastAttempt`,
  `RecordCount`, `LastError`).
- **Sync:** `SyncCentresCache` / `SyncOfficesCache` / `SyncProgrammeCache`
  each do a full replace (delete all, then bulk insert). Each has its own
  exception handler that records the error and keeps the last-known-good
  rows. `SyncDatasetCaches` orchestrates them so one dataset's failure
  never clears another.
- **Serving:** `GetCachedFamilyServiceCentres` /
  `GetCachedSocialServiceOffices` /
  `GetCachedStrengtheningFamiliesServices` return the list plus
  `LastSynced`, `FromCache` and `StaleWarning`.
  - If the cache is under 24 h old and has rows, it is served with **zero
    upstream calls**.
  - Otherwise the getter fetches live, refreshes the cache and returns
    the new rows.
  - If upstream fails and rows exist, the getter returns them with "Live
    data is unavailable. Showing last updated records."
- **Timers:** `SeedDatasetCache` (when published) and `RefreshDatasetCache`
  (daily at **03:00 SGT**: schedule 19:00 server time, UTC) call
  `SyncDatasetCaches`. If a timer never fires, the first page load after
  the 24 h window refreshes the cache anyway.

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
it never ran on its own. Its schedule was set through the MCP model API
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

## Testing

Playwright end-to-end and responsive tests in `tests/` run against the live
app. The two `[MOCKED]` specs abort the browser→OutSystems screen-action
call to exercise the error/Retry path. They are labelled as mocks and are not
evidence of server-side fallback.

**Latest full run: 18 Oct 2026, 21:59–22:09 SGT, Chromium, `--workers=1`, against the live app: 54 passed, 0 failed, 1 skipped (55 tests).**
Run in four batches of 5 minutes or less. The first run of `persistence-refresh.spec.ts` failed 2 tests because the app now shows `Updated dd/MM/yyyy HH:mm SGT` and the parser still expected `dd MMM yyyy, HH:mm`; the parser was updated and the spec re-run: 4/4.

| Spec | Passed | Failed | Covers |
|---|---|---|---|
| `admin.spec.ts` | 1 | 0 | CentreAdmin screen redirects to Login when logged out; logged-in add/hide/show (skipped without a test admin login) (1 skipped) |
| `api-error-retry.mock.spec.ts` | 1 | 0 | [MOCKED] screen-action failure shows error + Retry |
| `app-loads.spec.ts` | 2 | 0 | app loads, loading indicator resolves |
| `centre-details-panel.spec.ts` | 5 | 0 | details drawer open/update/Escape, directions/contact targets, mobile sheet |
| `contact-directions.spec.ts` | 1 | 0 | contact details and directions link |
| `directory.spec.ts` | 4 | 0 | 94 records across 3 types, Service type dropdown + search, OSUI Pagination, Sort by dropdown |
| `dropdowns.spec.ts` | 1 | 0 | category questions are labelled dropdowns and feed the ranking |
| `findsupport.spec.ts` | 10 | 0 | 4 needs without login, one question per screen, ranking (KidSTART first for parenting, "May not apply" only on a published rule), real tel: links, skip-the-rest, language picker, bigger text |
| `hotline.spec.ts` | 2 | 0 | Browse "Help now" is `tel:18002220000`; Find Support money results call ComCare 1800 222 0000; 1800 777 0000 appears nowhere |
| `nearest.spec.ts` | 2 | 0 | bad/unknown postal code messages; 3 nearest sorted by distance with call + directions |
| `no-results.spec.ts` | 1 | 0 | empty state for a gibberish query |
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

`fmt`, `validate` and `tflint` pass, and checkov reports 314 passed /
24 failed, with each finding explained. The topology diagram, cost notes
and assumptions are in `infra/README.md`. The working app runs on
OutSystems Cloud, not on this design, and `terraform apply` has not been
run.

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
  access. CS and LIB are 0 errors / 0 warnings.
- No OAP export of the modules is committed yet.

## Development workflow

The app is built in Service Studio, with OpenCode driving the official
OutSystems 11 Service Studio MCP server. Project skills live in
`.opencode/skills/`: `o11-mcp`, `servicestudio-mcp-oml`,
`datagov-integration`, `assessment-testing` and `aws-reference-iac`.
Agents are in `.opencode/agents/`, and the working rules are in `AGENTS.md`.
`opencode.example.json` shows the MCP client configuration with a
placeholder URL. The real tunnel URL is never committed.
