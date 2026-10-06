# HD Resolution — Gmail email link (Phase 3b-2) setup

The HD Resolution Centre can follow the Home Depot email chain for a case: you
link a case to its thread (by HD Ref # / case number, or from the **Email
inbox**), and new replies sync in automatically. It's **inert until configured**
— every case shows a "not set up" note and nothing is read from Gmail.

Everything reuses the **existing Google service account** (the same one that
writes the sales journal). No new password, read-only.

## What the portal reads

- **One mailbox**, impersonated read-only: `GMAIL_RESOLUTION_USER` (e.g.
  `sean@ghsbarrie.ca`).
- **One label** only: `GMAIL_RESOLUTION_LABEL` (default `HD Resolution`). The
  portal never reads anything outside that label.

## One-time setup

### 1. Apply a Gmail label to HD resolution emails
- In Gmail, create a label **`HD Resolution`** (or whatever you set as
  `GMAIL_RESOLUTION_LABEL`).
- Add a **filter** so HD resolution-centre emails get that label automatically
  (e.g. From contains the HD resolution address, or Subject contains the usual
  text) → "Apply the label: HD Resolution". Apply to existing matching mail too.

### 2. Google Workspace Admin — allow read-only Gmail for the service account
The service account already exists (used for Sheets). Grant it **domain-wide
delegation** for read-only Gmail:
- Find the service account's **Client ID** (numeric) — Google Cloud Console →
  IAM & Admin → Service Accounts → the portal's service account → "Unique ID",
  or in the service-account JSON as `client_id`.
- **Admin console** (admin.google.com) → **Security → Access and data control →
  API controls → Domain-wide delegation → Add new**.
  - **Client ID:** the number above.
  - **OAuth scopes:** `https://www.googleapis.com/auth/gmail.readonly`
  - Authorize.
- (The Gmail API must be **enabled** on the service account's Google Cloud
  project — APIs & Services → Library → Gmail API → Enable.)

### 3. Set two env vars on Elastic Beanstalk (`Gwa-portal-env`)
- `GMAIL_RESOLUTION_USER` = the mailbox to read (e.g. `sean@ghsbarrie.ca`) — this
  is the account whose **HD Resolution** label the portal reads.
- `GMAIL_RESOLUTION_LABEL` = `HD Resolution` (optional; this is the default).
- Redeploy / restart so the env is picked up.

### 4. (Already done for the journal) the 30-min sync
A GitHub Actions workflow **`resolution-email-sync.yml`** POSTs the sync endpoint
every 30 minutes, authenticated with the **same `CRON_SECRET`** the journal sync
already uses. Nothing extra to set if `CRON_SECRET` is already configured. You
can also run it on demand from the Actions tab, or press **Sync now** on a case.

## How to verify once set up
1. Open a case that has an HD Ref # → the **📧 HD email thread** section shows a
   **Link HD email** button. Click it; it should find and attach the thread and
   pull its messages.
2. The **Email inbox** button on the queue lists recent **HD Resolution**-labeled
   threads not yet linked; "Open as case" pre-links the thread to a new case.
3. If something's off, the case/inbox shows a plain "couldn't reach Gmail"
   message — re-check the delegation scope, the Gmail API being enabled, and
   `GMAIL_RESOLUTION_USER`.

## Privacy / safety
- **Read-only** scope; the portal can only read, never send or modify.
- Scoped to **one mailbox** and **one label** — nothing else in the inbox is
  ever read.
- Synced content is stored as short message summaries (sender, date, snippet)
  on the case; open Gmail for full messages.
