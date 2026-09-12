# Security audit — 2026-09-12

Full-site review of the GWA Dealer Portal across three domains: authentication &
sessions, authorization & object-level access (IDOR), and injection / input /
data exposure. Read-only sweeps + verification. This file is the running
remediation record — check items off as they're done.

**Overall verdict:** strong, defense-in-depth. Encryption of PII (AES-256-GCM
envelope), parameterized SQL throughout (no injection), document/mail IDOR
protections, tenant isolation on deals, strong CSP/headers, constant-time cron
auth, solid password-reset tokens, no privilege-escalation / mass-assignment.
One critical bug (fixed) and a handful of medium/low items remain.

---

## ✅ Fixed 2026-09-12

- **[CRITICAL] MFA-bypass via token confusion.** `getSession` accepted any
  validly-signed cookie carrying a `userId`. Intermediate cookies
  (`gwa_mfa_pending`, `gwa_mfa_trust`, `pwchange`, `enroll`) are signed with the
  same key and have no `tv`, so copying one into `gwa_session` granted a full
  session without completing MFA/rotation. **Fix:** session tokens now carry
  `typ:'session'` (`createSession`) and `getSession` requires it
  (`src/lib/session.ts`). Side effect: existing sessions were invalidated on
  deploy (one-time re-login).
- **[MEDIUM] Cross-office lead PII leak.** `/api/leads/lookup` skipped the store
  scope check when a dealer had zero HD stores linked, exposing any office's HD
  lead (name/phone/email/address) by enumerating booking numbers. **Fix:** fail
  closed — deny unless the lead's store is in the dealer's set
  (`src/app/api/leads/lookup/route.ts`).

---

## ⚠️ Outstanding — needs a decision or ops action

### Encryption key / KMS  — highest remaining priority
- **[HIGH]** All PII/TOTP encryption depends on one env-derived key; the intended
  AWS KMS path is unimplemented (`wrapDek`/`unwrapDek` throw when `KMS_KEY_ID`
  set — `src/lib/crypto.ts:75-90`), and `getLocalMasterKey` accepts any ≥16-char
  string and derives the KEK via `sha256()` (`crypto.ts:24-44`).
  - **Actions:** (1) confirm the production `MASTER_ENCRYPTION_KEY` is a real
    32-byte random value (e.g. `openssl rand -base64 32`), not a short phrase.
    (2) Require a 32-byte base64 key and drop the short-string sha256 fallback.
    (3) Finish the KMS integration before scaling PII volume. Do NOT change key
    handling without confirming the current key, or existing data becomes
    unreadable.

### Auth / login hardening (tradeoffs — confirm before changing)
- **[MEDIUM] Card-scan fails open** (`src/lib/upload.ts:96-111`): if the "no card
  numbers" scan throws, the upload is allowed. Fail closed is safer but may block
  legit uploads when OCR errors. Decision needed.
- **[MEDIUM] Login rate-limiter fails open** on DB error
  (`src/lib/ratelimit.ts:42-45`). Fail closed for auth keys is safer but a DB
  blip could lock everyone out; consider an in-memory strict fallback + alert.
- **[MEDIUM] Account-lockout DoS + enumeration**
  (`src/app/(auth)/actions.ts:141-158`): anyone can lock a known email (5 bad
  tries / 15 min), and the distinct "locked" message reveals the account exists.
  Prefer IP/device-scoped throttling + backoff; use the generic
  invalid-credentials copy even when locked.
- **[MEDIUM] Temp invite password emailed in cleartext**
  (`src/app/(admin)/actions.ts:1450-1479`) and echoed to the admin on send
  failure. Prefer a single-use, short-TTL set-password link (reuse
  `passwordResetToken`).

### By design — confirm intent, assign sparingly
- **[MEDIUM] Cross-office customer search** for granted dealers returns other
  offices' customer name/phone/address (not SIN/banking); grant-gated,
  rate-limited (30/min), audited (`src/lib/customerSearch.ts`). Audit `detail`
  stores the raw query (customer names/phones) into `AuditLog`.
- **[SENSITIVE] `canViewAllLeads`** is the only grant that gives an external
  dealer user cross-office data (leads only). Correctly scoped; assign
  deliberately.

---

## Low / informational (safe to defer)

- **[LOW] `logLeadCallAction` has no lead-ownership check**
  (`src/lib/leadCallActions.ts`): a dealer can attach a call log/note to any
  lead. Write-only integrity issue, no data returned. Fix: resolve the lead by
  key and verify store membership (mirror `leadNoGoodActions.ts`).
- **[LOW] Chat conversation row** created for another dealer's application before
  the 403 (`src/lib/chat.ts:44-53`). No message posted, no disclosure; optionally
  check app access before create.
- **[LOW] Middleware trusts JWT claims** (`src/middleware.ts`) — no `tv`/`active`
  recheck. Authoritative check is `getSession` on the page, so it's defense-in-
  depth only; consider requiring `typ:'session'` in middleware too.
- **[LOW] `disableMfaAction` doesn't bump `mfaTrustVersion`**
  (`src/app/(account)/actions.ts`): trusted devices stay trusted after MFA off.
- **[LOW] Admin-only SSRF** via `guustoRequest` `baseOverride`
  (`src/lib/guusto.ts:34-54`) — reachable only from the super-admin Guusto test
  harness; allowlist the host.
- **[LOW] `.env.example` ships a placeholder `SESSION_SECRET`** — leave it empty
  and document generation (middleware fails closed on empty, not on placeholder).
- **[COSMETIC] "Super Admin" badges** on some report cards overstate the real
  gate (a specific grant / any admin), which can mislead whoever assigns access.

---

## Verified solid (no action)

Parameterized SQL (all `$queryRaw` tagged-template; no `*Unsafe`); AES-256-GCM
envelope encryption with per-value DEK+IV and auth tag; document/mail/file APIs
authorize via `canAccessApplication` / dealer scope + audit + rate limit;
uploads use magic-byte sniffing, size caps, MIME allowlist (no SVG), random
storage keys, encrypted at rest, safe content-disposition; strong CSP with
per-request nonce + `strict-dynamic`, HSTS, nosniff, frame/referrer/permissions
policies; cookies httpOnly/secure/SameSite=Lax; cron + FinanceIt webhook +
HD-remittance ingest correctly authenticated (constant-time bearer / HMAC +
replay + idempotency); password reset tokens crypto-strong, single-use, 60-min,
non-enumerating; bcrypt cost 12; view-as impersonation admin-only, bound,
audited, cannot escalate; no privilege-escalation / mass-assignment
(self-service profile writes only name/phone/notify; grants set only behind
`requireAdminSection('users')` with allow-listed fields + self-demotion guard);
no hardcoded secrets in `src/**`; no PII in logs; email templates HTML-escape
user values.

---

## Suggested order when resuming
1. Confirm the production `MASTER_ENCRYPTION_KEY` strength (ops).
2. Fail-closed the card-data scan.
3. Temp-password → single-use set-password link.
4. Auth hardening: generic lockout copy + IP-scoped throttle; rate-limiter
   fail-closed for auth keys.
5. Finish AWS KMS integration.
6. Low items batch.
