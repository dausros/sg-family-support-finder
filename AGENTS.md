# SG Family Support Finder — OpenCode project instructions

## Source and objective
Read `docs/Low Code Engineer JD.pdf` before planning. Page 4 is the assessment source of truth. If PDF parsing fails, ask for a verified text extract and never guess requirements.

The app is a three-module OutSystems 11 Reactive Web application, built on three MSF datasets from data.gov.sg:

| Module | Type | Owns |
|---|---|---|
| `SGFamilySupport_LIB` | Library | Shared Structures / public contracts (`FamilyServiceCentre`, `SupportLocation`). No logic, REST or UI. |
| `SGFamilySupport_CS` | Service | `DataGovSG` REST integration and GeoJSON mapping; **persistent cache Entities** `CachedCentre`, `CachedOffice`, `CachedProgrammeSite` and `SyncStatus`; static `SchemeCatalogue`; sync actions (`SyncDatasetCaches` and per-dataset syncs); cache-first public getters (`GetCached*`, with `LastSynced` / `FromCache` / `StaleWarning`); `GetSchemeRecommendations`. |
| `SGFamilySupportFinder` | Reactive Web (UI) | `FindCentres` (Browse Support Services directory: search, SFP/FSC/SSO filter, sort, 10-per-page pagination), `FindSupport` (3-step wizard), `CentreDetailsPanel` block (keyless Leaflet/OSM map). Calls only public CS actions. |

Dependency direction: LIB ← CS ← UI (UI may also reference LIB). No upward or circular references. Publish order: LIB → CS → UI.

Datasets (verified schemas):
- Family Services / FSC: `d_add23c06f7267e799185c79ccaa2099b` (55 records)
- Social Service Offices: `d_22cfe2aed0bf20a679ab59bcaf0f8248` (24 records)
- Strengthening Families Programme: `d_b3ce295807d1edc7442ff2d24355b0af` (15 records)

## Working principles
- Persistent Entities exist for one reason: caching the three external datasets and their sync status, plus the static scheme catalogue. Don't add Entities for anything else without a demonstrated need.
- Caching contract:
  - The cache is fresh for 24 h; serve it with zero upstream calls.
  - When the cache is stale, refresh through it.
  - If upstream fails and rows exist, serve them with `StaleWarning`.
  - Syncs are full-replace per dataset, and one dataset's failure never clears another.
- Timers `SeedDatasetCache` and `RefreshDatasetCache` are authored in Service Studio. The MCP cannot create timers on this Studio version, so never try to recreate them through the Model API.
- Never invent records, contacts or eligibility decisions. Find Support results are indicative only, and the responsible agency decides eligibility. Caregiving/disability shows official referrals. Scheme content comes from official pages only.
- Verify dataset IDs, API contracts and field names against actual responses before coding. Never substitute mock records for live data in the finished app.
- Confirm which module is open in Service Studio before every MCP mutation (see `.opencode/skills/o11-mcp`). Never modify unrelated modules.
- Work in small changes and check `getValidationMessages` after each.
- Don't merge or publish OML, deploy AWS resources or incur costs without explicit user approval. Record actual outcomes and errors.
- Terraform (`infra/`) is an AWS reference for self-managed OutSystems 11. Keep "provisioned AWS resources" separate from "OutSystems installation, licensing and operations". Never claim it deploys the personal environment, and mark unverified OutSystems requirements as assumptions.
- Don't fabricate test results, deployment status, access or experience. Run Playwright serially (`--workers=1`) against `APP_BASE_URL` and record real counts.
- Keep secrets and tunnel URLs out of source control. `opencode.example.json` is the template; the real `opencode.json` is git-ignored.
- Explain trade-offs and unresolved gaps honestly in `README.md`.

## Skills and delegation
Read `SKILLS.md` for routing. Load the relevant `.opencode/skills/<name>/SKILL.md` before domain work. `servicestudio-mcp-oml` is the official OutSystems Model API skill; `o11-mcp` holds this project's rules on top of it. Delegate focused tasks to `.opencode/agents/` when OpenCode supports agents; otherwise follow the same instructions directly.

## Execution gates
1. Verify the PDF, the open O11 module, the API responses and MCP write capability.
2. Build and validate integration, mapping and caching in CS.
3. Build screens and interactions in the UI module.
4. Review, then merge and publish (LIB → CS → UI) only after approval.
5. Run the automated tests and capture real results.
6. Validate Terraform (`fmt`, `validate`, `tflint`, `checkov`) without applying, then update the README.
