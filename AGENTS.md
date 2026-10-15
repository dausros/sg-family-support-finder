# SG Family Support Finder — OpenCode project instructions

## Source and objective
Read `docs/Low Code Engineer JD.pdf` before planning. Page 4 is the assessment source of truth. If PDF parsing fails, request a verified text extract; never guess requirements.
Build one OutSystems 11 Reactive Web module using a real MSF Family Services dataset from data.gov.sg. Provide user search/exploration, frontend/backend design, automated tests, AWS platform IaC, and a clear README.

## Working principles
- Keep scope minimal: one public directory screen, search, details/contact/directions, loading/empty/error states. No authentication, persistent entities, timers, extra datasets, or map widgets unless verified necessary.
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
