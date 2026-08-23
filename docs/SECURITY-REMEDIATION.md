# Security Remediation Status

Tracks the findings from the Abbott Cyber Consulting assessment (Aug 15, 2026)
against what has been done in the portal codebase. Owner column: **Dev** = web
developer (code), **Ops** = office / finance / IT (process or console).

Legend: ✅ done in code · 🔧 partially addressed · ⛔ needs an action outside code

## ▶ Still to tackle (quick checklist)

**Owner actions (no code — do in a console/dashboard):**
- [ ] **R2** — Banking-change call-back habit: confirm any changed void cheque / banking form by phoning a number already on file; second person approves; log who checked. *(finance — biggest risk, free)*
- [x] **R3** — DMARC: Done (2026-08-23). `_dmarc.ghsbarrie.ca` set to `p=quarantine` (verified live in DNS); domain is SPF + DKIM authenticated through Google Workspace, so legit mail is unaffected. *(Consider `p=reject` later. `georgianwaterandair.ca` is still `p=none` and has a second sender — GoDaddy email marketing — so verify its auth before tightening.)*
- [x] **R12** — Done (2026-08-23). Production web service `gwa-portal` serves only its app port (10000) behind Render's HTTPS edge — no stray ports. Found and fixed the real gap: the Render **staging** Postgres `gwa-staging-db` had its inbound IP allow-list open to `0.0.0.0/0`; removed it so all internet traffic to the DB is blocked (verified allow-list now empty). Staging connects over the internal hostname, unaffected. **Still to verify (AWS, outside Render):** production RDS in ca-central-1 has *Publicly accessible = No* and its security group for port 5432 is not `0.0.0.0/0`.
- [x] **R1 follow-up** — Done (2026-08-22). New server-only `GOOGLE_MAPS_API_KEY` created in the `gwa-portal-504012` project, restricted to **Places API** with Application restrictions **None**; set in Render and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` deleted; the code fallback to the public var was removed; and the OLD leaked public key (HTTP-referrer key in the "My First Project" / `disco-name-504012-r1` project) was deleted. Fully closed.

**Code work we can pick up when ready (deferred by choice):**
- [ ] **R5 retention** — document retention period + auto-purge job (e.g. delete interior install photos N days after funding).

**Settled:** R1 (code), R4, R5 (download limits + bulk gate), R6, R8, R9, R10, R11, and the master-encryption-key protection (key set, backed up, no Blueprint to regenerate it).

---

## Priority 1 — Act now

| ID | Item | Owner | Status |
|----|------|-------|--------|
| R1 | Restrict + rotate the exposed Google Maps key | Dev ✅ + Ops | ✅ **Fixed in code.** Address autocomplete now runs entirely through server routes (`/api/places/autocomplete`, `/api/places/details`, `src/lib/googlePlaces.ts`); the key is read server-side only and is no longer sent to the browser. **Ops follow-up:** move the value from `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to a server-only `GOOGLE_MAPS_API_KEY` in Render (and delete the public one), API-restrict the key to the Places API, rotate it if it was ever unrestricted, and set billing alerts/quotas. The CSP was also tightened (no external Google origins needed anymore). |
| R2 | Verify banking-detail changes out-of-band | Ops (finance) | ⛔ **Process control.** Call a number already on file to confirm any changed void cheque / PAD form, second-person approval, record who confirmed. No code fix; this is the main "High" risk. |
| R3 | Enforce email anti-spoofing (DMARC) | Ops (DNS) | ⛔ **DNS change.** Move `_dmarc.ghsbarrie.ca` from `p=none` → `quarantine` → `reject`; confirm SPF ends with `-all`. |

## Priority 2 — Plan soon

| ID | Item | Owner | Status |
|----|------|-------|--------|
| R4 | Deal number alone must not open a file | Dev | ✅ **Already enforced.** Opening a deal checks the logged-in user's dealership (`canAccessAsDealer` / `canAccessApplication`), not just the id, and returns 404 otherwise. Customer search is rate-limited and audited. |
| R5 | Retention + limit download/export | Dev + Ops | 🔧 **Mostly done.** Documents are encrypted at rest; downloads are access-controlled and audited (`DOC_DOWNLOAD`), and now **rate-limited per user** (150/min) so a compromised account can't bulk-download the store. Any future "download all"/ZIP export is gated to Super Admins via `canBulkExport()`. **Deferred by choice:** the retention period + auto-purge job (e.g. delete interior install photos N days post-funding). |
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

## Operational must-do (not from the assessment, but critical)
The master encryption key must never be regenerated on the live service.
`render.yaml` now sets `MASTER_ENCRYPTION_KEY` to `sync: false` so Render can't
auto-generate it. **Ops action:** confirm the value is set in the Render dashboard
and back it up outside Render — see `docs/ENCRYPTION-KEY.md`.

## Out of scope in the assessment (for awareness)
Android app, related sites (mywatertest.ca, airrevitalizer.ca), internal network,
hosting infrastructure, source-code review, and phishing simulation.
