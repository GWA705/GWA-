# Go-live hardening checklist

A single place to confirm everything built is **tightened up and switched on
correctly** in production (**portal.ghsbarrie.ca** — the live portal host; if an
`office.ghsbarrie.ca` alias is also used, point it at the same deployment, don't
run a second copy). Dates are when the feature shipped to the production branch.

How to use: work top to bottom, tick each box once verified in production. Items
marked **YOU** need a human/console action; **CODE** already shipped and just needs
confirming; **LEGAL** needs counsel.

---

## 1. Lead auto-text (SMS)

Shipped 2026-10-10/11: personalization, spacing, editable templates + AI assist,
working-days, CASL pieces, and a performance report.

- [ ] **CODE** Each message reads well — open **Admin → Lead auto-text → Messages**,
      review Confirmation / Day-1 / Missed-window / Reactivation in EN + FR. Watch the
      **segment count** (keep to 1–2 where possible; use ✨ Make shorter).
- [ ] **YOU** Set the **working days** (Admin → Lead auto-text → Settings) and tick
      **"Only send reminders on working days"** so weekends don't nudge customers.
- [ ] **YOU** **Twilio carrier registration** (toll-free verification / A2P 10DLC) is
      complete — without it, texts to Canadian numbers may send but not arrive. Use the
      `/sms` and `/privacy` URLs where the form asks for program/opt-in info.
- [ ] **YOU** Confirm Twilio env on Elastic Beanstalk: `TWILIO_ACCOUNT_SID`,
      `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. Send a test text (Admin → Email).
- [ ] **YOU** Point the **Twilio inbound webhook** at `https://portal.ghsbarrie.ca/api/sms/inbound`
      so STOP/HELP and reply tracking work. (Signature verification is enforced.)
- [ ] **YOU** Set `APP_URL=https://portal.ghsbarrie.ca` on EB so the `/book` and `/sms`
      links in texts are correct.
- [ ] **YOU** **Flip live only when ready:** turn the feature **on** and **turn Test mode OFF**
      — until then every text goes to your test number, which is the safe default.
- [ ] **CODE** Reply tracking + performance report (Admin → Lead auto-text → Performance):
      reply content auto-purges after 90 days; booking rate works on existing data.

## 2. CASL compliance

- [x] **CODE** Sender identified in every message; STOP opt-out; HELP auto-reply; `/sms` page.
- [x] **CODE** Implied-consent window respected (150-day reactivation cap).
- [ ] **YOU** Keep consent records (lead source + date — captured; confirm retention).
- [ ] **YOU** Only ever text people who inquired — no bought/scraped lists.
- [ ] **LEGAL** Counsel sign-off on consent wording (and express opt-in if you ever text
      beyond the 6-month window).
- [x] **YOU** Home Depot OK on the "Home Depot Home Services" name (confirmed 2026-10-11, brand kit).

## 3. Privacy (PIPEDA)

- [x] **LEGAL** **Privacy policy finalized** at `/privacy` (2026-10-11) — paralegal-approved; all
      `[TO CONFIRM]` passages resolved (effective date, consent, retention, cross-border wording),
      draft banner removed.
- [x] **YOU** **Privacy Officer named** — Sean Jaiko (Owner), info@georgianwaterandair.ca,
      1-866-840-2789; published on `/privacy`.
- [x] **CODE** **Data retention** — lead-text reply content purges after 90 days; old text
      records after ~13 months (runs daily from the sweep).
- [x] **CODE** **Access/erasure tool** — Admin → Security → Customer data requests (logged).
- [x] **CODE/YOU** **Breach-response plan** drafted — `docs/BREACH-RESPONSE-PLAN.md`. Fill in the
      `[TO CONFIRM]` roles/contacts and have counsel review.
- [ ] **YOU** Define the **retention schedule** for the other stores (leads, deals, documents).

## 4. HD Resolution (case file + email watching)

Shipped 2026-10-11: full customer-file case page, watch extra emails, calls/texts.

- [x] **CODE** Gmail resolution link live & verified (see Operational status).
- [ ] **YOU** For a demo/review, use a case **linked to its deal** so the deal/financing,
      install photos and verified-documents checklist show.
- [x] **CODE** Watched-email addresses are strict-validated and quoted in the Gmail query (hardened 2026-10-11).
- [x] **CODE** Install photos/documents still stream through the authenticated, audited routes (no IDOR).
- [x] **CODE** Link-to-deal search also finds customers in the **sales journal** and can
      materialize a journal-sourced deal to populate the case (2026-10-11). These deals are flagged
      `journalSourced`, kept out of pipeline/reports, and never written back to the journal.
- [ ] **YOU** For journal-link to work, the journal must be readable by the service account
      (same `GOOGLE_SERVICE_ACCOUNT_JSON` + `JOURNAL_SHEET_ID_<year>` the reporting area uses —
      already live). If a reviewer sees no journal matches, confirm the sheets are shared with the
      service-account email (Admin → journal connection).

## 5. Marketplace

- [x] **CODE** New Arrivals auto-rotates weekly (Admin → Marketplace → New Arrivals showcase).
- [ ] **YOU** Confirm the showcase count + "new" window suit your catalogue.

## 6. Confirmation calls

- [x] **CODE** Redesigned worklist (KPI tiles + cleaner cards). No config needed.

## 7. Security & infrastructure (from docs/COMPLIANCE.md self-audit)

- [x] **CODE** Session security audit of this session's features — 2 fixes shipped
      (verified inbound-SMS writes; Gmail query hardening). No critical/high issues.
- [ ] **YOU** `SESSION_SECRET` + `MASTER_ENCRYPTION_KEY` strong and in a secrets manager.
- [ ] **YOU** Production uses **AWS KMS** (`KMS_KEY_ID`) with the KMS integration wired up.
- [ ] **YOU** `STORAGE_DRIVER=s3` with an **SSE-KMS** bucket in `ca-central-1`.
- [ ] **YOU** **All staff accounts have MFA** enabled (Admin → Security shows who doesn't).
- [ ] **YOU** RDS automated backups on (confirmed 2026-10-04); monitoring/alerting in place.
- [ ] **YOU** `CRON_SECRET` set so the scheduled endpoints (`/api/cron/*`) stay protected.
- [ ] **YOU** An **independent security review / penetration test** before relying on it at scale.
- [ ] **YOU** **Fix the `gwa-doc-expiry-reminders` Render cron build** (2026-10-11). It is set to
      `npm install; npm run build` on a 512 MB box and **randomly runs out of memory** (JS heap OOM),
      which fires a "build failed" email on most commits. The cron's start command is just a `curl`
      to the portal — it never needs the build. Dashboard → **gwa-doc-expiry-reminders → Settings →
      Build Command** → change to **`echo skip`** (matches the other five crons). The daily reminder
      keeps running; this only stops the wasted rebuild + failure emails. (Not an outage — the
      13:00 UTC run on 2026-10-11 completed successfully.)

---

_This file is a living checklist — update it as items are completed or new features
ship. It is an operational aid, not legal advice; privacy/consent wording and the
breach plan need a Canadian privacy lawyer._
EOF
echo "created docs/GO-LIVE-HARDENING.md"