# Go-live security checklist (Render)

The code-side hardening is done and deployed. These remaining items are things
**only you can do** in the Render dashboard (or as an organization). Work top to
bottom; nothing here needs a code change.

## 1. Scheduled jobs — set the secret + create the cron jobs

The reminder/alert engines only fire when a scheduler calls them. They no-op
outside business hours, so running every ~15 min all day is fine.

1. **Set `CRON_SECRET`** (Render → your service → Environment): a long random
   string. Save (Render redeploys).
2. **Create two Render Cron Jobs** (New → Cron Job, same repo/region), each every
   `*/15 * * * *`, with the header `Authorization: Bearer <the CRON_SECRET>`:
   - Reviewer 2-hour alert:
     `curl -fsS -X POST https://portal.ghsbarrie.ca/api/cron/attention-alerts -H "Authorization: Bearer $CRON_SECRET"`
   - Dealer idle reminders:
     `curl -fsS -X POST https://portal.ghsbarrie.ca/api/cron/dealer-reminders -H "Authorization: Bearer $CRON_SECRET"`

   (Set `CRON_SECRET` on each cron job's env too, or inline the value.)
   Verify: Admin → Email → "Run the 2-hour check now", and Admin → Dealer
   reminders → "Run the reminder check now".

## 2. Two-factor authentication (now enforced in code)

- 2FA is **required for everyone** by default. Users are prompted to set it up
  at their next sign-in (email code — no app needed — or an authenticator app).
- Change the policy anytime at **Admin → Security** (Everyone / Staff only /
  Optional). That page also shows how many users still need to set it up.
- **You (admin) should enroll first** so you're not the last to do it.

## 3. Push notifications (phone/desktop) — VAPID keys

If push isn't working, generate a VAPID key pair once (`npx web-push
generate-vapid-keys`) and set in Render: `VAPID_PUBLIC_KEY`,
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` (same value), `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT` (a mailto:). See `docs/PUSH-NOTIFICATIONS.md`.

## 4. Accounts & secrets

- **Retire placeholder logins.** Create real named accounts for you and your
  team; deactivate any seeded `@gwa.example` accounts. Confirm the bootstrap
  admin's one-time password was changed.
- **Confirm secrets are set and strong** in Render: `SESSION_SECRET` (32+ random
  bytes), `APP_ENCRYPTION_KEY` (the PII master key — never the value from
  `.env.example`), `DATABASE_URL`. Leave `KMS_KEY_ID` **blank** (not yet
  supported).
- If any secret ever matched a value committed to git history, **rotate it**.

## 5. Organizational (not software) — before real customer data

- Designate a **privacy officer** and a **breach-response process** (PIPEDA /
  Quebec Law 25).
- Approve a **data-retention schedule** (see roadmap item #48 — auto-purge of ID
  data after payment; we can build it when you set the window).
- Consider an **independent security review / penetration test** before
  processing real applications at volume.

---

### What's already handled in code (for reference)
- AES-256-GCM encryption of PII; append-only audit log; RBAC + tenant isolation.
- Login brute-force lockout + per-IP/email rate limits; timing-safe, no email
  enumeration; MFA on the second factor too.
- Strict security headers + CSP (per-request nonce + `strict-dynamic` in prod).
- Session revocation (token version), secure/httpOnly/sameSite cookies.
- Cron endpoints are secret-protected (header-only, constant-time compare).
- Upload magic-byte sniffing + size caps; signed, access-logged document links.
