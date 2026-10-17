# Security review: SG Family Support Finder (live app)

Date: 17 Oct 2026 (SGT 16:45–17:00). Target: https://personal-uu490uhn.outsystemscloud.com/SGFamilySupportFinder/ (OutSystems 11 Personal Environment).
Scope: non-destructive tests against the owner's own app only. Modules: SGFamilySupport_LIB, SGFamilySupport_CS, SGFamilySupportFinder (UI).

## Summary

| # | Check | Result | Severity | Status |
|---|---|---|---|---|
| 1 | Data returned by screen/data actions | Only public directory fields (centre name, address, postal code, public phone, public org email, lat/long, source label) and scheme text. No user data, no debug info. Internal record ids (`CentreId`, `LocationId`) are visible. | Info | Accepted (ids are not secrets; no action takes them as input) |
| 2 | XSS in inputs (income box, search) | Payload `<img src=x onerror=alert(1)>"'><script>…` typed into the income box: shown as plain text, no element created, no dialog. | None | Pass (platform escapes Expressions) |
| 3 | XSS / tampering via URL params | `FindSupport?NeedCategory=<payload>`, `FindCentres?q=<payload>`, `?CentreId=-1'`: ignored, page renders normally. Unknown URL goes to the platform's generic error page, no stack trace. | None | Pass |
| 4 | Tampered server request (`DataActionGetResults`) | XSS strings, SQL-style quotes (`' OR '1'='1`, `; DROP TABLE`), 200 KB strings, huge negative income: HTTP 200, empty or normal results, input not echoed, no stack trace. Wrong JSON types: HTTP 400 "Failed to parse JSON request content" (generic platform message). | None | Pass |
| 5 | CSRF | Same request without the `X-CSRFToken` header: HTTP 403. | None | Pass (platform) |
| 6 | Plain HTTP | `http://…/FindCentres` was served (200) with no redirect to HTTPS. | Medium | **Fixed** in module: app script redirects to `https://` before anything else runs. HSTS itself is platform-controlled. |
| 7 | Clickjacking | No `X-Frame-Options` / CSP `frame-ancestors` header. | Medium | **Fixed** in module (defence in depth): when the app is loaded inside a frame it hides itself and tries to open at top level. Verified live: framed copy shows nothing. The header itself is platform-controlled. |
| 8 | Referrer leakage | No `Referrer-Policy` header. | Low | **Fixed** in module: `<meta name="referrer" content="strict-origin-when-cross-origin">` added at start-up (verified live). |
| 9 | Security headers | Present: `X-Content-Type-Options: nosniff`. Missing: `Strict-Transport-Security`, `X-Frame-Options`, `Content-Security-Policy`, `Referrer-Policy`. | Low | Platform-controlled. On a paid environment set them in LifeTime → Environment → Security (Enable HSTS, Content Security Policy, Force HTTPS). Not available on a Personal Environment. |
| 10 | Browser storage | localStorage holds only platform values (locale, app manifest, `SESSION_USER_ID=0`, tracing=false) and the app's text-size / language choice. Income and household answers are not stored. Cookie `nr2Users` is the platform's anonymous session + CSRF cookie. | None | Pass |
| 11 | Income input | Free text box accepted letters. | Low | **Fixed**: `inputmode="numeric"`, `pattern="[0-9]*"`, `autocomplete="off"` (number keypad on phones; still optional). |
| 12 | Screens and roles | All 4 screens allow the Anonymous role (public directory, by design). No custom roles. Login / InvalidPermissions are template screens. | Info | By design |
| 13 | Entities | 5 entities in SGFamilySupport_CS, none Public; UI reads data only through server actions. No entity is reachable from the UI module directly. | None | Pass |
| 14 | Exposed APIs | No exposed REST/SOAP APIs in any module. CS consumes one REST API (`DataGovSG`, data.gov.sg open data, no secret key). | None | Pass |
| 15 | tel: / map links | Built from cached directory data, not from user input or URL params. | None | Pass |
| 16 | TrueChange security warnings | 3 "Security Warning" on FindCentres OnInitialize: server actions called from a client action, so each is a public screen-service endpoint. They return only public directory data. | Low | See O11 best-practice review (move to Data Actions). |

## How it was tested
- Playwright (Chromium, 390×844) against the live app; network responses captured for every screen-service call.
- Requests replayed from the same browser context (same cookies and CSRF token) with tampered bodies.
- Model checks through the Service Studio MCP: entity `Public` flags, screen roles, integrations, TrueChange messages.

## Not tested
- Load / denial-of-service, and anything outside this app (other apps on the environment, LifeTime, Service Center).
