# GWA Credit Portal — Security Audit & Remediation Tracker

_Audit date: 2026-08-01. Six parallel reviews (auth/RBAC/tenancy, PII/crypto,
input/injection/endpoints, file/storage, config/headers/deps, FinanceIt API
readiness). This file tracks findings and their fix status._

## Overall posture

Strong foundation: server-side RBAC + tenant isolation with **no IDOR/cross-dealer
break found**, AES-256-GCM envelope encryption of PII, append-only audit log,
signed HttpOnly/Secure JWT sessions, bcrypt(12)+TOTP with password lockout,
strong CSP (nonce + strict-dynamic) + HSTS + clickjacking protection, no SQL
injection, no XSS sinks, no mass assignment, safely-bound admin impersonation.

Main gaps: **no rate limiting** (esp. MFA brute-force), **no session
revocation**, a **committed example encryption key + default admin password**,
and — for a lender API — **no webhook signature/idempotency/KMS** yet.

Status key: ✅ fixed · 🟡 in progress · ⬜ planned · 🔷 your action (Render/ops) · 📋 organizational

---

## Wave 1 — Critical / High (shipping now)

- ✅ **Committed working master-encryption key in `.env.example`** → replaced with a blank placeholder. **🔷 Rotate the real key in Render if it ever matched this value** and re-encrypt.
- ✅ **Default admin password committed** (`render.yaml`, `seed.ts`, `.env.example` = `ChangeMe!Admin123`) → removed; seed now generates a random one-time password (printed once to the deploy log) when unset, and the bootstrap admin is **forced to change it at first login**. `render.yaml` uses `sync:false`.
- ✅ **Unlogged decrypt + partial gov-ID disclosure** on the staff deal page (masked branch decrypted the ID and showed the last 3 chars with no audit) → masked branch no longer decrypts; shows dots by presence only. Full reveal stays audited.
- ✅ **CRON endpoint secret** accepted via query string + non-constant-time compare → header-only (`Authorization: Bearer`) with `timingSafeEqual`.
- ✅ **JWT verify algorithm not pinned** → pinned to `HS256` in session + middleware (defense in depth).
- ✅ **Announcement image route** missing `nosniff` and ignored the `active` flag → both fixed.
- ✅ **No rate limiting / MFA brute-force** → durable DB-backed rate limiter (`src/lib/ratelimit.ts`, holds across Render instances) applied to login (per-IP + per-email), MFA verify, reset, MFA resend/enroll, and push-test. **MFA now shares the 5-attempt/15-min lockout**, and a wrong email code is invalidated so it can't be re-guessed within its TTL.
- ✅ **Login user-enumeration (timing)** → dummy bcrypt compare on the no-user path so timing is equal.
- 🟡 **Outdated `next` (HIGH advisories)** — 14.2.35 is already the newest 14.x, so **no patch bump exists**. Fix requires a **major** upgrade (15/16) which makes `cookies()`/`headers()`/`params`/`searchParams` async — a real migration across many files (attempted + reverted; the app builds clean on 14.2.35). **Deferred as a dedicated, regression-tested upgrade.** Interim: the remaining prod advisory is mostly `next`'s bundled build-time `postcss` (not attacker-reachable here), and the app's nonce CSP + no user-supplied rewrites + full auth mitigate the runtime `next` advisories.

## Wave 2 — Medium

- ✅ **No session revocation** → `getSession` now checks the DB on every read: it rejects tokens for deactivated users and mismatched `tokenVersion`, and uses fresh role/dealer/name. `tokenVersion` is bumped on deactivate, admin user-edit, and password change/reset — killing live sessions immediately. (The user's own password change re-issues their current device so they stay signed in.)
- ✅ **Login user-enumeration** → dummy bcrypt on the no-user path (constant time) + a generic "Invalid credentials." message. (A distinct "temporarily locked" message remains, which is a deliberate UX trade-off.)
- ✅ **Plaintext sensitive fields** → **income** (annual, gross monthly, co gross monthly, monthly housing cost) and **secondary/employer address street lines** (mailing/previous/worksite/employer/co-employer) are now AES-256-GCM encrypted at rest (new `*Enc` columns; encrypt on write, decrypt-with-legacy-fallback on read; idempotent backfill in the seed nulls the plaintext). `city`/`postalCode` kept plaintext by design (lower sensitivity; search + journal use them; primary street already encrypted). Legacy plaintext columns are nulled by the backfill and will be dropped in a follow-up migration.
- 🟡 **KMS envelope encryption footgun** → docs/env now clearly say `KMS_KEY_ID` is **not yet supported — leave blank** (setting it would throw), so no one is misled into breaking encryption. Full KMS support needs the crypto path to go async (currently `encryptOptional` is sync everywhere) — **deferred as a dedicated refactor**. Weak-secret KDF fallback still noted (Render's generated key is high-entropy; require a proper 32-byte key when convenient).
- ✅ **Audit tamper-evidence (attribution)** → each audit row now stores an immutable `actorName`/`actorEmail` snapshot, so deleting a user no longer erases who did what. (Full WORM/hash-chain enforcement still a later option.)
- ⬜ **PII-decrypt audit is best-effort/after-the-fact** → await a hard audit write before decrypting on reveal/print.
- ✅ **Upload content-type trusted from client** → files are now magic-byte sniffed server-side; content that isn't a real PDF/JPEG/PNG/WEBP/HEIC is rejected regardless of the declared MIME.
- ✅ **ZIP route unbounded** → capped at 200 files / 200 MB of decrypted content, with the cap noted in the audit entry. (Full streaming still a later option; admin/reviewer-only.)
- ✅ **Push endpoint SSRF** → subscribe now rejects any endpoint not on a real push service host (fcm.googleapis.com / Mozilla / Apple / Windows), so the server can't be made to POST to an internal/link-local URL.
- ✅ **CSP `style-src 'unsafe-inline'`** → **accepted.** Tailwind's utility model and Next's injected styles need inline styles; script-src is already locked down with a per-request nonce + `strict-dynamic`, so this is a documented, low-risk acceptance.
- ✅ **PII in log-only email path** → recipient is masked and the body preview removed from the log-only line.
- ✅ **MFA can be disabled without re-auth** → disabling 2FA now requires re-entering the current password.
- ⬜ **`googleapis`/`uuid` moderate advisory** → deferred (bumping risks the live journal integration; low real-world severity — a bounds check in a transitive dep).

## Wave 3 — Low / hardening

- ⬜ Password minimum 8 → consider 12 for staff who can fund.
- ✅ `reveal=1` audited-decrypt link → `prefetch={false}` so Next never pre-triggers the reveal on hover; it decrypts only on a deliberate click.
- ⬜ `__Host-` cookie prefix; force `secure` in all deployed envs.
- ✅ `serverActions.bodySizeLimit` set to `15mb` to match the document-upload intent (default was 1 MB).
- ✅ **Mandatory two-factor authentication.** Enforced at login: an account with no second factor is routed to a forced `/setup-2fa` enrollment (email code or authenticator) before any session is issued. Policy is admin-configurable at Admin → Security (Everyone / Staff only / Optional; default Everyone).
- ⬜ Journal write: tag the address decrypt as `PII_DECRYPT`; document the cross-border transfer.
- ✅ Dealer self-advances a deal to APPROVED via a FinanceIt number at creation — **confirmed intended**; added a reviewer **"Verify financing number"** confirmation (audited, shown on the deal) to solidify the dealer-asserted approval.
- ⬜ **Encrypt income + secondary/employer addresses** (approved) — next dedicated change, with a data-backfill migration. Keeping `city`/`postalCode` searchable (lower sensitivity; primary street already encrypted). Encrypted values remain viewable to logged-in reviewers/admins.
- ⬜ Data retention / auto-purge of ID data after a window (already roadmap #48).

## FinanceIt API readiness (before processing real deals via API)

**Scaffolding built (dormant until FinanceIt's secret/endpoints/contract are set — see docs/FINANCEIT-API.md):**
- ✅ Inbound webhook `POST /api/webhooks/financeit` with **HMAC-SHA256 signature verification** (raw body + timing-safe compare).
- ✅ **Replay protection** (signed, recent timestamp; default ±5 min).
- ✅ **Idempotent processing** (`WebhookEvent` with unique `[source, eventId]` → retries recorded once, never re-processed).
- ✅ **Outbound client** (`src/lib/financeit.ts`): TLS on, 10s timeout, bounded backoff on GET, keys from env only, never logged.
- ✅ **Every delivery recorded + audited** (`WebhookEvent` + `FINANCEIT_WEBHOOK` audit action).
- ✅ **Rate limiting + 64 KB body cap** on the webhook (auth routes already rate-limited in Wave 1b).
- ⬜ **Event handlers** — `dispatch()` currently records unknown events as IGNORED (no deal mutation). Wire real approval/funding handlers once FinanceIt's event contract is confirmed.
- 🔷 **Production KMS** (`KMS_KEY_ID` in ca-central-1) implemented before real PII volume.
- 🔷 **Confirm Canadian data residency** for compute + DB (committed `render.yaml` says `oregon`; dashboard is source of truth — attest it).

**Strongly recommended:** reconciliation job, status-mapping module, security-event monitoring/alerting, secrets rotation policy, **third-party penetration test before go-live**.

## Organizational (not code) — go-live gates

- 📋 Designate a **privacy officer**, **breach-response process**, **retention schedule** (PIPEDA / Law 25).
- 📋 **Legal-reviewed consent wording** (confirm current text is final).
- 📋 **Third-party security review / pen test** before real customer deals.

---

## Confirmed strengths (leave as-is)

Tenant isolation (no IDOR), signed+bound admin "view as", reset-token handling
(hashed, single-use, expiring), document access control + audit, no public object
URLs, unguessable storage keys, path-traversal guards, `Content-Disposition`
encoding, AEAD crypto correctness, security headers/CSP, no SQL/XSS/mass-assignment,
data minimization (SIN/banking never stored), notification payloads carry no PII.
