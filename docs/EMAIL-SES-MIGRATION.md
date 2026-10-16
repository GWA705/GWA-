# Move portal email to Amazon SES (off the hello@ Gmail mailbox)

**Why:** the portal sent all its transactional email by signing into the Google
Workspace **user mailbox** `hello@ghsbarrie.ca` over SMTP. A user mailbox has a
low daily sending cap (~2,000 external/day) and strict spam heuristics, so the
portal's volume (lead notifications, reminders, confirmations, digests — 30+ send
paths, several in loops) tripped Google's automatic spam suspension on
2026-10-15 (suspension came from the portal's own AWS IP, ASN 16509 — not a
breach). App email must not run through a human mailbox.

**Fix:** send from **Amazon SES** (built for app volume, proper bounce/complaint
handling, won't suspend your Google account). We're already on AWS. The code is
provider-agnostic SMTP (`src/lib/email.ts`), so this is **config, not code**.

## Target addressing (decided 2026-10-16)
- **From:** `gwadealerportal@ghsbarrie.ca` — a **Google Group** (not a user mailbox,
  so **no seat/cost**). SES sends it directly once the domain is DKIM-verified; the
  group also receives, so stray replies and bounce notices reach a person.
- **From name:** `Georgian Water & Air` (brand kit — never "GWA" alone in anything
  customer-facing).
- **Reply-To:** `gwadealerportal@ghsbarrie.ca` (the same group, so replies reach the
  whole team). Can be set to `hello@ghsbarrie.ca` instead in Admin → Email if
  preferred — it's a one-field change, no redeploy.
- `hello@ghsbarrie.ca` goes back to being a normal human mailbox and never sends
  automated mail again.
- (Optional best practice: send from a **subdomain** `mail.ghsbarrie.ca` to isolate
  sending reputation from the root domain. More DNS; skip for v1.)

## Steps

0. **Google Group** `gwadealerportal@ghsbarrie.ca` (done 2026-10-16): set **Who can
   post → anyone / external allowed** (so bounce notices + outside replies get in,
   not rejected) and **add members** (whoever should see replies). The address can
   only be one object in Workspace — it is a Group, not an alias.
1. **SES console → region `ca-central-1`** (same region as EB/RDS; keeps data in
   Canada for PIPEDA). → **Verified identities → Create identity → Domain** →
   `ghsbarrie.ca` → enable **Easy DKIM (RSA 2048)**.
2. **Add the 3 DKIM CNAME records** SES shows you, to `ghsbarrie.ca` DNS. Wait for
   SES to show the domain **Verified** (minutes–hours).
3. **SPF:** edit the `ghsbarrie.ca` SPF TXT record to also include SES — keep Google
   and add Amazon:
   `v=spf1 include:_spf.google.com include:amazonses.com ~all`
4. **DMARC:** already `p=quarantine`. SES Easy DKIM gives DKIM alignment for
   `@ghsbarrie.ca`, so SES mail passes DMARC — nothing else to change.
5. **Request production access** (SES → Account dashboard → **Request production
   access**). This removes the sandbox (otherwise you can only send to verified
   addresses). **Takes up to ~24h — start this first.** Describe the use case:
   transactional dealer-portal notifications, with STOP/opt-out not applicable
   (internal B2B), low bounce rate expected.
6. **Create SMTP credentials:** SES → **SMTP settings → Create SMTP credentials**
   (makes an IAM user with an SES SMTP username + password — different from your
   AWS access keys). Save them.
7. **Set these on Elastic Beanstalk** (Configuration → Software → Environment
   properties):
   ```
   SMTP_HOST       = email-smtp.ca-central-1.amazonaws.com
   SMTP_PORT       = 587
   SMTP_USER       = <SES SMTP username>
   SMTP_PASS       = <SES SMTP password>
   EMAIL_FROM      = gwadealerportal@ghsbarrie.ca
   EMAIL_FROM_NAME = Georgian Water & Air
   EMAIL_REPLY_TO  = gwadealerportal@ghsbarrie.ca
   ```
   Apply → environment restarts. (This also takes `hello@` out of the sending path.)
8. **Test:** Admin → Email → Send test email (works once out of sandbox, or to a
   verified address while still in sandbox).
9. **Bounce/complaint handling (recommended):** SES → the identity → configure an
   **SNS topic** for Bounces + Complaints, or a configuration set, so bad addresses
   are tracked/suppressed. High bounce rate is the other common way a sender gets
   flagged — SES manages this; a Gmail mailbox does not.

## After cutover
- `hello@ghsbarrie.ca`: remove its App Password / stop using it for SMTP entirely;
  it's a human mailbox again.
- Update `docs/EMAIL-SMTP.md` + the Operational status table in `docs/CHANGELOG.md`
  (email now via SES, sender `notifications@ghsbarrie.ca`).
- Consider a **daily send cap + per-minute rate limit** in `src/lib/email.ts` as a
  belt-and-suspenders guard so a future loop can't blast (separate follow-up).
