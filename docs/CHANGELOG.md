# GWA Dealer Portal — Changelog & operational status

The running record of **what's been shipped** and **what operational config is
live**, newest first. This is durable project memory: Claude reads it (and
`BUILD-FACTS.md`) at the start of work and appends to it when shipping, so past
work and go-live steps aren't forgotten between sessions.

Dates are the day the work landed on the production branch
(`claude/pci-credit-application-portal-vi7d6r`). Git history is the authoritative
source of truth; this file is the human-readable index.

> **How to keep this useful:** when a change ships, add a dated bullet. When an
> integration goes live or an env var / external config changes (Render, DNS,
> Google, S3, a third-party API), update the **Operational status** table below
> with the date and who confirmed it — that's the stuff that otherwise only
> lives in a dashboard and gets forgotten.

## Operational status (live integrations & external config)

| Thing | Status | Notes |
|---|---|---|
| Sales journal (Google Sheets) | ✅ Connected in Render | `JOURNAL_SHEET_ID` + Google service-account creds set. Auto-writes on approval and whenever deal numbers change. Confirmed live in Render 2026-09-03 (Sean). |
| Email (SMTP) | ✅ Live | Sends from `hello@ghsbarrie.ca`. |
| Domain email auth (SPF / DKIM / DMARC) on `ghsbarrie.ca` | ✅ Set | SPF `include:_spf.google.com`; DKIM authenticating (Google Workspace); DMARC `p=quarantine`. Confirmed 2026-09-03 (Sean). |
| Guusto gift-card API | ⏳ Parked | Awaiting `GUUSTO_API_TOKEN` in Render + exact field names (test at `/admin/guusto-test`) + office→reason mapping. |
| Bell Total Connect voicemail | 📝 Documented, not built here | Guide delivered for the **booking site** (voicemail-to-email + IMAP). Not part of this portal. |

## 2026-09-03
- **Deal numbers pin while the HD Customer # is missing.** When an approved deal
  still needs its HD #, the Review & decide step collapses but keeps the Deal
  numbers card pinned below it (Flow layout), so it can be finished without
  expanding the whole step; it disappears and the step collapses fully once the
  HD # is saved. (`ReviewerWorkspace` gained a `pinned` slot shown only while a
  phase is collapsed.)
- **Reviewer deal page — Decision moved into the tab.** Removed the right-hand
  Decision column; the decision, approval fields, and status controls now live at
  the top of the **Review & decide** tab (`ReviewerWorkspace` renders full-width
  when no rail is passed).
- **Sales journal auto-sync.** Shared best-effort `syncApplicationToJournal()`
  helper. Writes the journal row the moment a deal is **approved**, and re-writes
  the **same row** whenever the deal numbers change — so an HD Customer # added
  after approval fills in automatically. Manual "Write to Journal" button remains
  as a fallback/re-sync.
- **HD Customer # no longer blocks approval.** Approve on finance company + loan
  number; add the HD # afterward (it writes to the journal when added).
- **Rule: HD # required before install paperwork.** An HD-program deal must have
  its HD Customer # recorded before paperwork can be sent to the dealer (enforced
  in `uploadReviewerPaperworkAction`; the Produce-documents step shows an "add the
  HD Customer # first" notice until it's in).

## 2026-09-02
- **New-dealer intake → office directory.** Attaching an intake to a dealer (and a
  new "Fill directory" backfill on past intakes) now builds/refreshes that
  dealer's directory profile — office info, each person as a contact card, and the
  logo — non-destructively. Added `OnboardRequest.attachedDealerId`.
- **Website field on the intake form**, flowing through to the directory profile.
- **WhatsApp teaser flyers** (design canvas) — three "coming soon" portal-blue
  teasers with the `/request-access` link + code `GWA2026`.

## Earlier (pre-changelog — see git history + `BUILD-FACTS.md`)
- Leads Map (Leaflet + OpenStreetMap, background geocoding, admin store-location
  override); content end-dates + "ending soon" ribbon; public `/request-access`
  dealer intake (shared access code, office details, logo upload); go-live data
  reset (deals + mail, keep users); Dealer Portal invite email (portal-blue,
  mobile-responsive).
