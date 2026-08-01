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

- ⬜ **No session revocation**: deactivating/demoting a user or logout doesn't end a live session for up to 8h. Add a `tokenVersion` (bumped on deactivate/role-change/logout) checked in `getSession`/middleware, or re-read `active`/`role` from DB.
- ⬜ **Login user-enumeration** (timing: no bcrypt on unknown user; distinct "locked" message) → dummy bcrypt on no-user path + generic message.
- ✅ **Plaintext sensitive fields** → **income** (annual, gross monthly, co gross monthly, monthly housing cost) and **secondary/employer address street lines** (mailing/previous/worksite/employer/co-employer) are now AES-256-GCM encrypted at rest (new `*Enc` columns; encrypt on write, decrypt-with-legacy-fallback on read; idempotent backfill in the seed nulls the plaintext). `city`/`postalCode` kept plaintext by design (lower sensitivity; search + journal use them; primary street already encrypted). Legacy plaintext columns are nulled by the backfill and will be dropped in a follow-up migration.
- ⬜ **KMS envelope encryption stubbed** (`wrapDek`/`unwrapDek` throw if `KMS_KEY_ID` set — operational footgun) + weak KDF fallback (unsalted SHA-256 for short secrets). Implement KMS (`@aws-sdk/client-kms` already present) or fix docs; require a 32-byte key.
- ⬜ **Audit tamper-evidence**: table is append-only by convention only; deleting a user nulls `actorId` (loses attribution). Snapshot actor name/email; restrict DELETE/UPDATE.
- ⬜ **PII-decrypt audit is best-effort/after-the-fact** → await a hard audit write before decrypting on reveal/print.
- ⬜ **Upload content-type trusted from client** → sniff magic bytes server-side; structurally validate PDFs. (Mitigated today by `nosniff` on all file routes.)
- ⬜ **ZIP route builds whole archive in memory / no file-count cap on upload** (REVIEWER/ADMIN only) → stream + cap total bytes and file count.
- ⬜ **Push endpoint SSRF** (stores any `endpoint`, `/api/push/test` triggers a server POST) + subscription upsert keyed only on endpoint → allow-list push hosts; scope upsert to the user.
- ⬜ **CSP `style-src 'unsafe-inline'`** → move to hashes/nonce or document as accepted.
- ⬜ **PII in log-only email path** (recipient + body preview) → redact.
- ⬜ **MFA can be disabled without re-auth** → require current password/OTP.
- ⬜ **`googleapis`/`uuid` moderate advisory** → bump `googleapis`.

## Wave 3 — Low / hardening

- ⬜ Password minimum 8 → consider 12 for staff who can fund.
- ⬜ `reveal=1` is a GET (prefetch/bookmark could trigger an audited decrypt) → consider POST / confirm non-prefetched.
- ⬜ `__Host-` cookie prefix; force `secure` in all deployed envs.
- ⬜ `serverActions.bodySizeLimit` set to match the 15 MB upload intent.
- ⬜ Journal write: tag the address decrypt as `PII_DECRYPT`; document the cross-border transfer.
- ✅ Dealer self-advances a deal to APPROVED via a FinanceIt number at creation — **confirmed intended**; added a reviewer **"Verify financing number"** confirmation (audited, shown on the deal) to solidify the dealer-asserted approval.
- ⬜ **Encrypt income + secondary/employer addresses** (approved) — next dedicated change, with a data-backfill migration. Keeping `city`/`postalCode` searchable (lower sensitivity; primary street already encrypted). Encrypted values remain viewable to logged-in reviewers/admins.
- ⬜ Data retention / auto-purge of ID data after a window (already roadmap #48).

## FinanceIt API readiness (before processing real deals via API)

**Must-have (not built yet):**
- ⬜ Inbound webhook with **HMAC signature verification** (raw body + `timingSafeEqual`).
- ⬜ **Replay protection** (signed timestamp + stored nonce/event-id).
- ⬜ **Idempotent processing** (unique provider event id in the same tx as the state change; funding/payout idempotent).
- ⬜ **Outbound client** (`src/lib/financeit.ts`): TLS verified, timeouts, bounded ret/backoff, keys from env only, redacted logging.
- ⬜ **Audit every API interaction** (in/out) with a redacted record; add a SYSTEM actor.
- ⬜ **Rate limiting + request-size caps** on the webhook and auth routes.
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
