# Assessment checklist

The brief is the last page of `docs/Low Code Engineer JD.pdf` ("Application process and assessment"). Each line below is one of its asks, with where it is met. Checked on **17 Oct 2026, about 20:30 SGT**, against the live app and the features merge (PR #3). Updated 18 Oct 2026 for the reviewer login and test results.

Live app: https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/

## High-level requirements

| # | Ask in the brief | Where it is met | Status |
|---|---|---|---|
| 1 | Retrieve and integrate data from a data.gov.sg dataset | Three MSF datasets come through data.gov.sg's poll-download API: FSC 55, SSO 24, SFP 15, so **94 records**. They are integrated in CS (`SGFamilySupport_CS`), cached in entities and refreshed daily at 03:00 SGT by a timer. Browse shows "Showing 1–10 of 94 found · Updated …". Specs: `real-records`, `directory`, `persistence-refresh`. | ✅ |
| 2 | Present the data through a clear, user-friendly interface | SGDS-style look (flat, 4px radius, one primary and one secondary button). Works at 390 and 1280 px with no horizontal overflow (`ux-responsive`, 320–1440 px). 4 languages, a bigger-text switch, 48px+ tap targets, and a keyboard-only focus ring. Screens: `ux-centres-p2-1280.png`, `ux-centres-p2-390.png`, `ux-wizard-1280.png`, `ux-results-1280.png`. | ✅ |
| 3 | Let users explore and interact with the data | **Browse:** search, Service type and Sort by dropdowns, OutSystems UI Pagination, and a details drawer with map and directions. **Find Support:** 3-step wizard (7 questions, 5 dropdowns on Static Entities) leading to ranked schemes. **Nearest 3 centres by postal code** (OneMap), WhatsApp share and print. Specs: `directory`, `search`, `centre-details-panel`, `findsupport`, `dropdowns`, `nearest`, `share-print`. Screens: `feat-1-dropdowns.png`, `feat-2-nearest.png`, `feat-3-share.png`. | ✅ |
| 4 | Sound frontend and backend design | **4 layers:** LIB (shared integration and utility layer) → CS (entities, Static Entities, server actions, timer, `CentreAdmin` role) → UI. **Blocks** talk to screens through parameters and events (`WizardStep2Household`, `WizardStep3Results`, `NearestCentres`, `CentreDetailsPanel`). Aggregates load At Start. The new server and screen logic has exception handlers with friendly messages. **Server-side authorisation:** `CheckCentreAdminRole()` in `Centre_CreateOrUpdate` / `Centre_SetActive`. **TrueChange (18 Oct 2026):** UI 0 errors / 4 warnings (all by design: 3 public read-only directory fetches on an anonymous screen, and one On Ready data access); CS 0/0; LIB 0/0. **Audit:** every admin save, hide or show (and every failed save) writes an `AuditLog` row. | ✅ |
| 5 | Infrastructure as Code (AWS) to deploy and operate the OutSystems platform | `infra/`: Terraform for self-managed OutSystems 11 on AWS (VPC, ALB + WAF, IIS front-ends, Deployment Controllers, RDS SQL Server, Amazon MQ, LifeTime, KMS, AWS Backup, CloudWatch), plus `bootstrap/` for remote state. **Re-checked locally on 18 Oct 2026 with `scripts/check-all.sh`:** fmt clean, init + validate pass (root and bootstrap), tflint 0 issues, **checkov 323 passed / 0 failed / 15 skipped** (9 fixed, 15 accepted with reasons inline), **`terraform test` 10 passed / 0 failed** (offline, mocked AWS). The tests caught and fixed a first-plan failure on the LifeTime rules. Evidence: `docs/test-evidence/local-run-2026-10-18.txt`. | ✅ written and tested offline. ⚠️ Never planned or applied in a real AWS account (none available), and the README says so. |
| 6 | Appropriate automated testing | Playwright end-to-end suite in `tests/` against the live app, plus `terraform test` for the infrastructure, all run by `scripts/check-all.sh` on a local machine (not GitHub Actions). **Latest run 18 Oct 2026, 16:20–16:29 UTC (00:20–00:29 SGT on 19 Oct): Playwright 59 passed, 0 failed, 1 skipped; terraform test 10/10.** The skipped test was the logged-in admin flow. **Re-run with the reviewer login, 16:42–16:53 UTC: 60 passed, 0 failed, 0 skipped** (`docs/test-evidence/reviewer-run-2026-10-18.md`). | ✅ |

## Submission

| # | Ask | Where | Status |
|---|---|---|---|
| S1 | Access to the OutSystems environment | Personal Environment `personal-uu490uhn`. Public screens need no login. Staff screen `/CentreAdmin` needs a user with the `CentreAdmin` role. A `reviewer` login with the `CentreAdmin` role only exists; credentials are provided separately in the submission email. | ✅ |
| S2 | Complete IaC, automated tests and README in a Git repo, with access | `infra/`, `tests/`, `README.md` (what the app does, architecture, data sources, design trade-offs, testing, infrastructure, assumptions, known limitations), `docs/SERVICE_STUDIO_CHANGES.md` (every Service Studio change). | ✅ Public repository: https://github.com/dausros/sg-family-support-finder |

## Assessment criteria (how it will be judged)

| Criterion | Evidence to point at |
|---|---|
| Overall quality | Live app, the screenshots named above, 60 passed, 0 failed, 0 skipped live tests (with the reviewer login), 10/10 terraform tests |
| Engineering practices | 4-layer modules, Static Entities, blocks with events, exception handlers, server-side role checks, TrueChange 0 errors, one local script that runs every check (`scripts/check-all.sh`), changelog |
| Technical decision-making and trade-offs | README "Design decisions and trade-offs"; `infra/README.md` (each checkov exception); `docs/O11_BEST_PRACTICES_REVIEW.md`; `docs/SECURITY_REVIEW.md` |

## Extra features

| Feature | Status |
|---|---|
| F1 Category questions as dropdowns on Static Entities | ✅ live, `dropdowns.spec.ts` |
| F2 Postal code → 3 nearest centres with distance | ✅ live, `nearest.spec.ts` |
| F3 Share on WhatsApp + print view | ✅ live, `share-print.spec.ts` |
| F4 Admin screen, CentreAdmin role checked server-side | ✅ live and locked (logged-out redirect tested); logged-in add/edit/hide/show passed with the reviewer login (18 Oct 2026) |
| F5 Visual polish (SGDS look, 390/1280) | ✅ live |
