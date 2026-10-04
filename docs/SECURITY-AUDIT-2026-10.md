# GWA Dealer Portal — Security & Resilience Audit (2026-10-04)

A full read-only audit of the portal, run across four focused passes: **auth /
login**, **access control / tenant isolation**, **insider crash / DoS**, and
**injection / XSS / secrets / crypto**. Nothing was changed — this is the map;
fixes are a separate, approved step.

> **Keep this in the repo. Do not publish it.** It describes weaknesses in a live
> system that handles customer PII. It lives next to `RELIABILITY.md` and the
> other security docs.

## Bottom line (plain language)

- **The portal is, overall, well built for security.** Passwords are properly
  hashed (bcrypt cost 12), sessions are re-checked against the database on every
  request (so deactivating a user takes effect immediately), customer SIN / bank
  / DOB / ID are AES-256-GCM encrypted, every file download is permission-checked
  and audited, and the database is queried only through Prisma (no SQL-injection
  surface). None of the auditors found an open door for an outside attacker or a
  way for one dealer to read another dealer's customer data.
- **Do the login types hold? Yes — with two fixes worth making.** Dealer,
  reviewer, admin, Super Admin, both MFA methods, the password-reset and
  forced-enrollment flows are all sound. The two gaps are (a) a *scoped* admin who
  was granted only the "Users" section can reset a **Super Admin's** password and
  escalate, and (b) the MFA lockout can be reset by re-submitting the password.
- **Insider crash risk is real and matches the Oct-2 outage.** The biggest
  exposure is not an attacker — it's an automatic "unread messages" badge that, for
  a busy office, fires hundreds of parallel database queries every ~12–20 seconds
  and can exhaust the small connection pool. A handful of other heavy endpoints
  (PDF rendering, OCR on upload) have no per-user rate limit and can be scripted to
  wedge the single instance.

Nothing here is an emergency ("drop everything tonight"). The top items are worth
scheduling soon, especially the DoS ones given the recent outage.

---

## Remediation log

- **2026-10-04 — DoS batch 1 shipped:** #1 (chat unread single query + list cap),
  #2 (rate-limit the render/thumbnail endpoints), #6 (per-user upload throttle).
  See the CHANGELOG entry of the same date. Still open from the DoS set: #4
  (render memory), #9 (`full-export` streaming), and the Prisma `connection_limit`
  ops tweak. All other findings below are unchanged / open.

## Priority list (most to least urgent)

| # | Severity | Area | Issue | Fix effort |
|---|---|---|---|---|
| 1 | **High** | DoS | Chat "unread" badge fans out to hundreds of parallel DB counts on an auto-poll → connection-pool exhaustion (the Oct-2 class). | Medium |
| 2 | **High** | DoS | `/pages` + `/thumb` PDF-render endpoints have no per-user rate limit; scriptable to wedge request workers. | Small |
| 3 | **High** | Auth | A scoped "Users"-section admin can reset a Super Admin's password / change roles (privilege escalation); no "last Super Admin" guard. | Small |
| 4 | **Medium** | DoS | PDF stacked-render can allocate ~200 MB per call; OCR and PDF pools don't share a budget → RAM spike under a crafted burst. | Medium |
| 5 | **Medium** | Auth | MFA lockout is reset when the password is re-submitted, so the per-account second-factor lockout never fires. | Small |
| 6 | **Medium** | DoS | Every upload runs OCR synchronously with no per-user upload rate limit. | Small |
| 7 | **Medium** | AuthZ | Staff chat + `/api/chat/*` gated by role only, not the `review-queue` section → a scoped admin reads/posts every office's chat. | Small |
| 8 | **Medium** | XSS | Staff mail attachments trust the client-declared file type and are served inline → content-type confusion / same-origin HTML (prod CSP blunts script). | Small |
| 9 | **Medium** | DoS | `full-export` loads the entire Application table into memory (Super-Admin only). | Small |
| 10 | **Low** | Crypto | **Confirm the live `MASTER_ENCRYPTION_KEY` is a real 32-byte random value** — the fallback derivation is weak, and the KMS path is not wired. | Config check |
| 11 | **Low** | Auth | Email MFA code is 6 digits, static for 30 min, survives wrong guesses. | Small |
| 12 | **Low** | Auth | "Trust this device" MFA cookie is not cleared on logout (shared-computer risk). | Small |
| 13 | **Low** | Auth | TOTP codes can be replayed within their ~90s window (no single-use tracking). | Small |
| 14 | **Low** | Auth | Login reveals valid emails (distinct "locked" message + timing on archived-dealer path). | Small |
| 15 | **Low** | AuthZ | Journal/VOC report *actions* gated by role, not the `reports` section. | Small |
| 16 | **Low** | DoS | Nightly whole-DB in-memory backup (cron-secret gated; reliability, not insider-reachable). | Medium |
| 17 | **Low** | XSS | `renderEmail` injects `ctaUrl`/`bodyHtml` unescaped — safe today, a trap for future callers. | Small |
| 18 | Info | — | Middleware trusts JWT claims (mitigated — pages/actions re-check the DB); weak-ish password policy; one non-constant-time hash compare; SMS log masking. | — |

---

## Details

### 1. Chat "unread" fan-out → connection-pool exhaustion  — **High (DoS)**
`src/lib/chat.ts:229-245,255,317-326`, called from `src/app/(staff)/layout.tsx`
and polled by `ChatWidget` (every 12s/30s) and `TabUnreadNotifier` (every 20s).
The unread badge loads **all** of a dealer's conversations (one is auto-created
per deal) and runs **one COUNT query per conversation** in parallel — up to 300
for staff — on an automatic timer in every open tab. With the default Prisma pool
(~5 connections, no explicit `connection_limit`) a single busy office can saturate
the pool every few seconds; logins, the reviewer queue and uploads then block.
**No attacker needed** — a left-open tab for a large office does it. This is the
closest match to the Oct-2 resource-exhaustion outage.
*Fix:* replace the per-conversation loop with one grouped query
(`chatMessage.groupBy`), add a `take:` to the conversation list, cache the badge
~10s, and set an explicit Prisma `connection_limit`/`pool_timeout`.

### 2. Un-rate-limited PDF-render / thumbnail endpoints — **High (DoS)**
`src/app/api/documents/[id]/pages/route.ts`, `.../mail/attachments/[id]/pages`,
`.../resource-files/[id]/pages`, `.../documents/[id]/thumb`. These rasterize whole
PDFs (`renderPdfPagesStacked`) and have **no rate limit**, unlike the sibling file
routes. A render concurrency semaphore of 2 stops a hard OOM but **queues excess
calls forever**, each pinning a request worker for up to 120s. A dealer can upload
one 40-page PDF to their own deal and script a few hundred GETs to its `/pages` to
wedge the instance.
*Fix:* add `rateLimit` per user like the sibling routes; **cache** the rendered
image to S3 so it renders once; cap the render queue and fast-fail with 503 when
backed up.

### 3. Scoped "Users" admin can reset a Super Admin's password — **High (Auth / privilege escalation)**
`src/app/(admin)/actions.ts:333` (`updateUserAction` gated only by
`requireAdminSection('users')`), new-password `:402-407`, role change `:344-355`.
A scoped admin granted only the "Users" section can set a new password on **any**
account (including a Super Admin) and change **any** role (only self-demotion is
blocked), with **no "at least one Super Admin must remain" guard** — unlike the
correctly-gated `saveAdminAccessAction` (`:1581`, which has both
`requireSuperAdmin` and the last-super-admin guard). *Verified firsthand.*
*Fix:* require `requireSuperAdmin` to reset passwords / change roles of
ADMIN-or-Super-Admin targets, and add the same last-active-Super-Admin guard to
`updateUserAction`.

### 4. PDF stacked-render memory spike — **Medium (DoS)**
`src/lib/pdfThumb.ts:52-108` — up to 40 pages at 2× composited onto a canvas up to
~198 MB of raw pixels, 2 concurrent = ~400 MB peak, and the OCR pool is a
*separate* semaphore, so a crafted burst runs big PDF renders **and** OCR at once
on the 4 GB box. *Fix:* lower max pages/scale on the request path, render
page-by-page, and give OCR + PDF one shared "heavy work" budget. Ties to #2's
caching fix.

### 5. MFA lockout reset on password re-submit — **Medium (Auth)**
`src/app/(auth)/actions.ts:160-164` resets `failedLoginCount`/`lockedUntil` as
soon as the **password** verifies, before the MFA step; `verifyMfaAction`
(`:219-229`) increments that same counter. An attacker who has the password can
loop (re-login resets the counter) and keep guessing MFA codes; only the per-IP
throttle remains, which a distributed attacker sidesteps. *Verified firsthand.*
*Fix:* track MFA failures in a counter that password success does **not** reset
(or move the reset into `finishLogin`, after MFA), and enforce a per-account MFA
attempt lock.

### 6. OCR on every upload, no per-user upload throttle — **Medium (DoS)**
`src/lib/upload.ts:97` → `src/lib/ocr.ts`. Uploads run PDF conversion + OCR +
image processing synchronously; the dealer upload actions have no per-user rate
limit, so a dealer can fire many uploads back-to-back and tie up workers.
*Fix:* add `rateLimit('upload:${userId}', ~30, 60)`; consider moving the card-scan
OCR off the request path.

### 7. Staff chat not gated by the `review-queue` section — **Medium (AuthZ)**
`src/app/(staff)/staff/conversations/*` and `src/app/api/chat/*` check only
`role` (`ADMIN`/`REVIEWER`); `canAccessConversation` (`src/lib/chat.ts:41-44`)
returns true for any internal user. A scoped admin granted an unrelated section
(e.g. `support-contacts`) can still read and post in **every** office's deal/
support chat. The nav hides it, but the pages/endpoints don't enforce the section.
*Fix:* gate the pages with `requireStaffSection('review-queue')` and add the same
check in `canAccessConversation`/the chat routes.

### 8. Mail attachment content-type confusion — **Medium (XSS)**
`src/app/(staff)/staff/mail/actions.ts:100,133-141` stores the client-declared
MIME type without the allowlist + magic-byte sniff used for application documents;
`src/app/api/mail/attachments/[id]/route.ts:62-69` serves it `inline`. A staff
account could attach an HTML/SVG file that renders on the portal's own origin in a
dealer's logged-in session. Production CSP blocks inline scripts, so the residual
risk is same-origin HTML phishing; in dev/preview CSP is weaker. *Fix:* validate
against the same allowlist + `sniffMime` as `upload.ts`; force
`Content-Disposition: attachment` / `application/octet-stream` for anything not a
known-safe image/PDF.

### 9. `full-export` loads the whole Application table — **Medium (DoS)**
`src/app/api/admin/full-export/route.ts:33` — unbounded `findMany` with the heavy
`loanApplication` include, built into a CSV in memory. Super-Admin only, but a
clean OOM as the table grows. *Fix:* stream / cursor-paginate the CSV.

### 10. Confirm the encryption key is strong — **Low (Crypto) — action for Sean**
`src/lib/crypto.ts:37-43` — if `MASTER_ENCRYPTION_KEY` isn't a base64 32-byte
value, any secret ≥16 chars is accepted and stretched with a single unsalted
SHA-256 (weak against an offline brute-force of a leaked DB). The documented KMS
path (`KMS_KEY_ID`) is **not implemented** (`:75-90` throw), so production relies
on the env key. *Action:* confirm the live `MASTER_ENCRYPTION_KEY` on Elastic
Beanstalk is a true `openssl rand -base64 32` value. If it is, this is a non-issue;
the code should still reject the weak fallback in production.

### 11–17. Lower-severity hardening
- **11 Email MFA code** (`src/lib/mfa.ts:11`, `mfa-email.ts:30-48`): 30-min TTL,
  static across resends; shorten to ~5–10 min and invalidate after N wrong tries.
- **12 Trusted-device cookie** (`src/lib/session.ts:142-163,269-275`): not cleared
  on logout (≤90 days); clear it in `destroySession` or shorten the window.
- **13 TOTP replay** (`src/lib/mfa.ts:30,47-53`): record the last-used step per user
  and reject reuse.
- **14 User enumeration** (`src/app/(auth)/actions.ts:136-143`): run the dummy
  bcrypt on every early return and use the generic message for locked accounts.
- **15 Report actions** (`src/app/(staff)/staff/reports/actions.ts`): gate the
  journal write-mode / import / VOC actions by section (or Super Admin), not bare
  role.
- **16 Nightly whole-DB backup** (`src/lib/backup.ts:43-70`): materializes the
  whole DB in heap; stream to S3 or rely on the RDS automated backups already on.
- **17 `renderEmail`** (`src/lib/email-templates.ts:18,37`): escape `ctaUrl`
  (validate http/https) and treat `bodyHtml` as trusted-only — safe today, a trap
  for a future caller.

### 18. Info / notes
Middleware authorizes route groups from JWT claims without a DB re-check — not
exploitable today because every page/action re-resolves identity via `getSession`
(which does re-check the DB), but keep calling a `requireX` in every new handler.
Password minimum is 8 chars with a tiny common-password list; `emailCodeMatches`
uses `===` rather than a constant-time compare (not practically exploitable); SMS
log masking leaves first-two/last-two digits (log-only mode).

---

## What's holding well (verified, so we know what's solid)

- **Auth:** bcrypt cost 12; JWT sessions with a mandatory `typ:'session'` claim so
  intermediate cookies can't be replayed; `getSession` re-reads role/active/
  tokenVersion from the DB every request (instant revocation); httpOnly + secure +
  SameSite=Lax cookies; password reset uses a hashed single-use token, generic
  responses, throttling, and revokes sessions on completion; MFA secrets are
  encrypted; forced MFA enrollment / password rotation can't be skipped.
- **Access control:** central guards used consistently; **every dealer action
  re-fetches the row and checks ownership** (no IDOR found); all document / mail /
  file downloads are auth + scope gated, audited, and `no-store`; tenant queries
  fail **closed** (a mis-provisioned dealer sees nothing, not everything);
  cross-office customer search returns routing info only, never PII; the full PII
  export is Super-Admin only + audited; impersonation keeps the real role and
  confines the admin to that one dealer.
- **Injection / crypto:** Prisma parameterized everywhere (no raw-SQL injection);
  React auto-escaping (one static `dangerouslySetInnerHTML`); customer emails
  escape interpolated values; AES-256-GCM with a fresh key + IV per value and an
  auth tag; no decrypted PII or secrets logged; no user-controlled URL reaches a
  server-side fetch (no SSRF); strong CSP / HSTS / nosniff / frame headers in prod.
- **Resilience already in place:** a DB-backed rate limiter on most hot endpoints;
  a concurrency semaphore capping OCR and PDF work; `take:` caps on nearly all
  list queries; file-size + ZIP caps with magic-byte sniffing; a 5-min journal
  cache; immutable EB deploys with auto-rollback; RDS 16-day automated backups.

---

## Suggested order of work

1. **DoS first (protects uptime):** #1 chat fan-out, #2 rate-limit the render
   endpoints, #6 upload throttle, #4 render memory, #9 stream `full-export`.
2. **The privilege-escalation fix:** #3 (small, high impact).
3. **Auth hardening batch:** #5 MFA lockout, then #7, #8, and the Low auth items
   (#11–14) together.
4. **Config check now, no code:** #10 — confirm the production encryption key.

Most of these are small, self-contained changes. They should go out in small,
validated batches (not one big push), each with the local checks green, given the
single-instance deploy.
