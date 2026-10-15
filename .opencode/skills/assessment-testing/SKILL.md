---
name: assessment-testing
description: Use for automated Playwright testing and verification of the published O11 Family Support Finder assessment application.
---

# assessment-testing

1. Write small deterministic Playwright tests: real-data load, case-insensitive search, no results, contact/details, directions link.
2. Mock only targeted failure scenarios; label mocked tests. Never present mocked records as live-data evidence.
3. Keep credentials and environment URL configurable; do not commit secrets.
4. Run tests after user-approved publish and capture actual pass/fail results. If inaccessible, mark blocked rather than passed.
5. Document execution commands and CI assumptions in README.
