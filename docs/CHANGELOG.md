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

## 2026-09-04
- **Card-number redaction in chat.** Card numbers typed into chat are stripped
  enforced server-side (never stored) with an instant client warning. Uses
  length + Luhn so real cards are caught but the portal's own numbers (HD
  Customer #, financing #, phones) are not. `src/lib/cardGuard.ts` (+ tests).
- **Chat polish.** Fixed the chat auto-scroll stealing the whole page (it now
  scrolls only the message list, and only when you're already at the bottom).
  Removed the redundant inline "Chat with the Reviewer" section from the dealer
  deal page — the corner bubble covers it (the reviewer deal page keeps its
  inline chat).
- **Live chat (Phase 1 — polling).** Corner chat bubble on the dealer side
  (deal-aware + a General support thread, unread badge) and a reviewer
  **Conversations inbox** (`/staff/conversations`), plus a **Chat** nav item with
  an unread badge. Unified `Conversation`/`ChatMessage`/`ConversationRead` model
  (backfilled from existing dealer-facing deal notes); the deal page's inline
  chat (both sides) now reads/writes the same conversation, so bubble, inbox and
  deal page are one thread. Reviewer names show as "Reviewer" to dealers. Deal
  messages still fire the existing new-message notification. Near-real-time via
  polling; SSE + Postgres LISTEN/NOTIFY is the planned Phase 2 upgrade (no UI
  change). API: `/api/chat/{summary,messages,send,read}`. See
  `scratchpad/live-chat-architecture.md`.
- **Reviewer names hidden from dealers.** Dealer-facing surfaces now show
  **"Reviewer"** (with the timestamp) instead of an individual GWA staff name —
  review decisions, the deal chat/notes, the confirmation line, and mail
  (sender + staff replies). One shared constant `REVIEWER_DISPLAY` +
  `isInternalRole()`; `NoteThread`/`ConfirmationView` gained an `anonymizeStaff`
  prop (staff pages still show real names). Mail replies previously said "GWA" →
  now "Reviewer" too (unified).
- **"Review cycle times" admin report** (Reports → Review cycle times): time
  between each pipeline milestone from the status history — median/avg/90th %
  per task, GWA vs Dealer vs Total, selectable window.
- **New deal progress bar.** `DealProgress` is now variant-based: dealers see a
  **segmented progress bar** (Option 1 — filling segments, shimmer on the active
  stage, big % / step-of count); reviewers see a **milestone timeline** (Option 2
  — stage icons, completion dates from the status history, and a live "what's
  happening now" detail strip with an Auto-advances cue). Same real stages
  (Submitted → Approved → Docs uploaded → Confirmation → In for funding → Funded
  → Paid); off-path flags (Problem/Declined/Withdrawn) preserved. Motion respects
  `prefers-reduced-motion`.

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
