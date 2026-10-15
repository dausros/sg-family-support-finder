# SG Family Support Finder + Support Discovery Portal — OpenCode project instructions

## Source and objective
Read `docs/Low Code Engineer JD.pdf` before planning. Page 4 is the assessment source of truth. If PDF parsing fails, request a verified text extract; never guess requirements.
Build the assessment as a three-module OutSystems 11 application (`SGFamilySupport_LIB` ← `SGFamilySupport_CS` ← `SGFamilySupportFinder`) using real MSF datasets from data.gov.sg: a Family Service Centre directory (`FindCentres`) plus a guided support-discovery enhancement (`FindSupport`, labelled as enhancement). Provide user search/exploration, frontend/backend design, automated tests, AWS platform IaC, and a clear README.

## Working principles
- Keep scope minimal: public directory + guided support screens, search, details/contact/directions, loading/empty/error states. No authentication, persistent entities, timers, extra datasets, or map widgets unless verified necessary.
- Datasets in use: MSF Family Services (`d_add23c06f7267e799185c79ccaa2099b`, 55 records), Social Service Offices (`d_22cfe2aed0bf20a679ab59bcaf0f8248`, 24 records), Strengthening Families Programme (`d_b3ce295807d1edc7442ff2d24355b0af`, 15 records) — each with its verified schema. Never invent records, contacts, or eligibility decisions; caregiving/disability shows official referrals only.
- Prefer a Structure list over persistent Entities for read-only external data. Do not invent entities just to satisfy an assumed rubric.
- Verify the dataset identifier, API contract, field names and endpoint behavior with actual responses before coding. Never substitute mock centre records for live data in the finished app.
- Confirm the open Service Studio module name before every MCP mutation. Never modify the `Test` module. Use official O11 MCP tools and inspect Model API signatures before writing.
- Work in small changes. Do not merge or publish OML, deploy AWS resources, or incur costs without explicit user approval. Record actual outcomes and errors.
- AWS Terraform must distinguish provisioned AWS resources from OutSystems platform installation, licensing and operations prerequisites; do not claim it deploys the personal environment.
- Do not fabricate test results, deployment status, access or engineering experience. Avoid unnecessary tool attribution in deliverables; follow any applicable AI disclosure requirements.
- Keep secrets out of source control. Explain tradeoffs and unresolved gaps honestly.

## Skills and delegation
Read `SKILLS.md` for routing. Load the relevant `.opencode/skills/<name>/SKILL.md` before domain work. Delegate focused tasks to `.opencode/agents/` agents when OpenCode supports them; otherwise follow the same instructions directly. Do not delegate trivial steps.

## Execution gates
1. Verify PDF and O11 module, API response and MCP write capability.
2. Build and validate integration and data mapping.
3. Build screen and interactions.
4. Review, merge and publish only after approval.
5. Execute automated tests and capture real results.
6. Validate Terraform without applying; finish README and submission checklist.
