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
- Tests: Playwright, **40 passed / 0 failed** against the live app (17 Oct 2026)
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

### 1. Browse Support Services (`FindCentres`)

- One directory of **94 records**: 55 Family Service Centres (FSC), 24
  Social Service Offices (SSO) and 15 Strengthening Families Programme
  locations (SFP), served from the CS cache.
- Search by name, address or postal code, combined with an All / FSC /
  SSO / SFP type filter, A–Z / Z–A sort and a Clear filters action.
- Pagination at 10 per page, labelled `Showing X–Y of N`, with
  First / Prev / numbered / Next / Last. It resets when the filter
  changes.
- Uniform cards with a type badge, name, address, postal code, contact
  links and View details.
- The `CentreDetailsPanel` drawer shows address, phone, email, an
  interactive Leaflet/OpenStreetMap map with a marker, Get Directions and
  Open in Google Maps. It closes with Esc, uses `role=dialog`, and
  becomes a full-screen sheet on mobile.
- Loading, empty, error-with-Retry and stale-data states. Results show
  the cache timestamp (`Updated dd MMM yyyy, HH:mm`).

### 2. Find Support (`FindSupport`)

A three-step wizard with explicit Continue / Back and no automatic
navigation:

1. **Support need:** financial difficulties, family or relationship
   difficulties, children and parenting, or caregiving / disability support.
2. **Household details (optional):** monthly income, household size,
   employment and residency. Income must be non-negative and household
   size positive, and invalid input shows an inline message.
3. **Recommendations:**
   - Scheme cards from a static `SchemeCatalogue` entity in CS (8
     schemes, checked against official pages on 16 Oct 2026), returned
     by `GetSchemeRecommendations`. Each card shows why it may be
     relevant, known conditions, what is missing from the user's answers,
     what it provides, documents needed, how to apply and the official link.
   - Matching live service locations (SSO for financial needs, FSC and SFP
     for family needs) open the same details drawer.
   - Caregiving shows official referrals (SG Enable, Enabling Guide) rather
     than invented matches.

The household answers currently drive the "missing information" notes on
each card. **Ranking schemes by income band, household size, employment and
residency is in progress** on a separate branch, together with updated
`findsupport.spec.ts` assertions. Today's spec still asserts that the
household inputs do not gate results.

Every result is framed as **indicative**: "Results are indicative only — the
responsible agency decides eligibility." Nothing is stored, and no login
is needed.

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
| `SGFamilySupport_CS` | The `DataGovSG` REST client (poll-download + GeoJSON download), GeoJSON DTO Structures and mapping. **Persistent entities** `CachedCentre`, `CachedOffice`, `CachedProgrammeSite` and `SyncStatus`, plus the static `SchemeCatalogue`. Sync actions, cache-first public getters and `GetSchemeRecommendations`. |
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
- **Timers:** `SeedDatasetCache` (on publish) and `RefreshDatasetCache`
  (daily) call `SyncDatasetCaches`. If a timer never fires, the first page
  load seeds the cache anyway.

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

**Timers created in Service Studio.** The MCP model API writes a
timer-schedule feature that Service Studio 11.55.92 refuses to merge, so
both timers were made by hand in Studio. They exist only in the module,
not in any scripted change. The refresh-through getter means the app still
works if a timer is missing.

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

**Latest full run: 17 Oct 2026, serial, Chromium, against the live app.**
The test code was not changed for this run.

| Spec | Passed | Failed | Covers |
|---|---|---|---|
| `app-loads.spec.ts` | 2 | 0 | app loads, loading indicator resolves |
| `real-records.spec.ts` | 1 | 0 | real FSC records from data.gov.sg render |
| `search.spec.ts` | 2 | 0 | case-insensitive search by name/address, second independent term |
| `no-results.spec.ts` | 1 | 0 | empty state for a gibberish query |
| `contact-directions.spec.ts` | 1 | 0 | contact details and directions link |
| `directory.spec.ts` | 4 | 0 | all three types (94 records), search + type filter, pagination with reset, sort reversal |
| `centre-details-panel.spec.ts` | 5 | 0 | details drawer open/update/Escape, directions and contact targets, mobile full-screen sheet, opened from Find Support |
| `findsupport.spec.ts` | 6 | 0 | wizard loads without login, per-need guidance + live SSO/FSC/SFP records, caregiving referrals, input neutrality, navigation |
| `wizard.spec.ts` | 6 | 0 | explicit Continue/Back, household options, income validation, blank optionals |
| `persistence-refresh.spec.ts` | 4 | 0 | cached timestamp stable across visits, <24 h freshness, no duplicates on reload/Retry, [MOCKED] channel fault + Retry |
| `ux-responsive.spec.ts` | 7 | 0 | no horizontal overflow 320–1440 px on both screens, 390 px touch targets, keyboard reach, headings/labels/lang, skip link |
| `api-error-retry.mock.spec.ts` | 1 | 0 | [MOCKED] screen-action failure shows error state, Retry recovers |
| **Total** | **40** | **0** | 12 spec files, serial (`--workers=1`), 6 min 14 s |

Not covered by automated tests:
- Server-side unit tests of CS logic (e.g. BDDFramework). Caching is
  proven through observable behaviour (stable timestamp, zero refetch,
  no duplicates), not by asserting on entities directly.
- The timers firing.
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
  pages on 16 Oct 2026. It needs periodic review because schemes and
  criteria change. It is guidance, not policy.
- Anonymous access is right for a discovery tool, so no login is needed
  and nothing is stored.
- English only.
- Infrastructure assumptions (Amazon MQ, RDS for SQL Server, versions,
  sizing) are listed with sources in `infra/README.md`.

## Known limitations

- Ranking schemes by household inputs is not merged yet (see Find Support
  above).
- The two timers exist only in the Service Studio module (see design
  decisions).
- The FSC download-URL handoff uses a site property (see design decisions).
- Leftover template role warnings remain on `Common/Login` and
  `Common/InvalidPermissions`.
- No OAP export of the modules is committed yet.

## Development workflow

The app is built in Service Studio, with OpenCode driving the official
OutSystems 11 Service Studio MCP server. Project skills live in
`.opencode/skills/`: `o11-mcp`, `servicestudio-mcp-oml`,
`datagov-integration`, `assessment-testing` and `aws-reference-iac`.
Agents are in `.opencode/agents/`, and the working rules are in `AGENTS.md`.
`opencode.example.json` shows the MCP client configuration with a
placeholder URL. The real tunnel URL is never committed.
