# Security Remediation Status

Tracks the findings from the Abbott Cyber Consulting assessment (Aug 15, 2026)
against what has been done in the portal codebase. Owner column: **Dev** = web
developer (code), **Ops** = office / finance / IT (process or console).

Legend: ✅ done in code · 🔧 partially addressed · ⛔ needs an action outside code

## Priority 1 — Act now

| ID | Item | Owner | Status |
|----|------|-------|--------|
| R1 | Restrict + rotate the exposed Google Maps key | Ops (Google Cloud console) | ⛔ **Console task.** The key is `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, a *browser* Maps/Places key used by the address-autocomplete field — browser Maps keys are always visible by design, so the fix is to restrict it, not hide it. In Google Cloud Console: add an **Application restriction** (HTTP referrer → `portal.ghsbarrie.ca/*`), an **API restriction** (Maps JavaScript API + Places API only), rotate the key if it was ever unrestricted, and turn on **billing alerts + quotas**. The app already only loads it when configured. (A stronger option — proxying Places through a server route so the key never ships to the browser — is available if you want it; larger change.) |
| R2 | Verify banking-detail changes out-of-band | Ops (finance) | ⛔ **Process control.** Call a number already on file to confirm any changed void cheque / PAD form, second-person approval, record who confirmed. No code fix; this is the main "High" risk. |
| R3 | Enforce email anti-spoofing (DMARC) | Ops (DNS) | ⛔ **DNS change.** Move `_dmarc.ghsbarrie.ca` from `p=none` → `quarantine` → `reject`; confirm SPF ends with `-all`. |

## Priority 2 — Plan soon

| ID | Item | Owner | Status |
|----|------|-------|--------|
| R4 | Deal number alone must not open a file | Dev | ✅ **Already enforced.** Opening a deal checks the logged-in user's dealership (`canAccessAsDealer` / `canAccessApplication`), not just the id, and returns 404 otherwise. Customer search is rate-limited and audited. |
| R5 | Retention + limit download/export | Dev + Ops | 🔧 **Partly done.** Documents are encrypted at rest; downloads are access-controlled and audited (`DOC_DOWNLOAD`). Still to add: a retention period + purge job, and a policy on bulk export. |
| R6 | Suspicious-login alerting | Dev | ✅ **Added.** A sign-in from an IP the user has never used before now sends them an email + push alert (`src/lib/signinAlert.ts`). Recent sign-ins with source IP were already shown under My account. Step-up re-validation before a banking change is a further enhancement (overlaps R2). |
| R7 | Document that card data isn't stored | Ops | ✅ Confirmed with client; card data is not stored. PII/PFI protection continues under R5. |

## Priority 3 — Housekeeping

| ID | Item | Owner | Status |
|----|------|-------|--------|
| R8 | Nonce-based CSP (remove `unsafe-inline`/`unsafe-eval`) | Dev | ✅ **Already implemented.** Production CSP uses a per-request nonce + `strict-dynamic`; `unsafe-inline`/`unsafe-eval` for scripts appear only in dev (`src/middleware.ts`). The scan predates this — a retest should confirm. |
| R9 | Hide Server label; check `/api/version` | Dev | ✅/🔧 `x-powered-by` is off (`poweredByHeader: false`) and `/api/version` returns only a build id (no sensitive data). The `Server` header is added by the hosting edge (Render), not the app, so it can't be removed from code. |
| R10 | Pin the framework to a stable version | Dev | ✅ **Pinned.** `next` is now an exact stable pin (`14.2.35`, no caret). |
| R11 | Fix PDF flicker / re-fetch | Dev | ✅ **Addressed.** PDFs render as one server-rendered stacked-page image via `DocViewer` / `PdfPagesImage`; the source isn't re-fetched on redraw. |
| R12 | Confirm only required ports are open | Ops (hosting) | ⛔ **Hosting task.** Ports observed match Render's managed edge; confirm the origin behind the edge isn't independently reachable. |

## Out of scope in the assessment (for awareness)
Android app, related sites (mywatertest.ca, airrevitalizer.ca), internal network,
hosting infrastructure, source-code review, and phishing simulation.
