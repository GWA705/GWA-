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
| Sales journal (Google Sheets) | ✅ Live on AWS EB | `JOURNAL_SHEET_ID_<year>` (2024/2025/2026/2027) + the test `JOURNAL_SHEET_ID` set on EB. Auto-writes on approval and whenever deal numbers change. The Google **service-account JSON is sourced from SSM Parameter Store** (`/gwa-portal/GOOGLE_SERVICE_ACCOUNT_JSON`), not plain-text env (2026-10-02). Write row-selection: next-empty-line + duplicate guard (see BUILD-FACTS). |
| Texting / SMS (Twilio) | ✅ Connected on EB (2026-10-02, Sean) — ⚠ carrier registration pending | `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` (`+12494449591`) set on EB. Powers the customer review-request text. **Delivery to Canadian numbers needs toll-free verification / A2P 10DLC in Twilio before it's reliable** — until then a text may "send" but not arrive. Admin → Email: status badge + send-test-text + cost meter. |
| Email (SMTP) | ✅ Live | Sends from `hello@ghsbarrie.ca`. |
| RDS database backups (`gwa-portal-db`) | ✅ Confirmed (2026-10-04, Sean) | Automated backups **Enabled, 16-day retention** (point-in-time restore), nightly window 06:24–06:54 UTC, copy-tags-to-snapshots on, stored in ca-central-1. Manual `gwa-before-rebuild` snapshot retained from the 2026-10-02 outage. Single-AZ (Multi-AZ not enabled — a future failover upgrade). See `RELIABILITY.md`. |
| EB deploy safety (immutable + health alerts) | ✅ In repo (2026-10-04) — applies on deploy | `.ebextensions/01_resilience.config`: **Immutable deploy policy** (auto-rollback on failed health, fresh disk every deploy), `/api/health` check, EB health-change email to sean@ghsbarrie.ca (⚠ confirm the SNS subscription email), managed updates. `.platform/hooks/postdeploy/01_docker_prune.sh` prunes old images. Deploy workflow `wait_for_deployment: true`. Pending console follow-ups in `RELIABILITY.md`: t3.medium + 50 GB disk, external uptime monitor. |
| Domain email auth (SPF / DKIM / DMARC) on `ghsbarrie.ca` | ✅ Set | SPF `include:_spf.google.com`; DKIM authenticating (Google Workspace); DMARC `p=quarantine`. Confirmed 2026-09-03 (Sean). |
| Guusto gift-card API | ⏳ Parked | Awaiting `GUUSTO_API_TOKEN` on EB + exact field names (test at `/admin/guusto-test`) + office→reason mapping. |
| Bilingual UI toggle (EN/FR) | ✅ **Live in production** (2026-09-06, Sean) | `NEXT_PUBLIC_I18N_ENABLED=1` set as a build arg (GitHub) on the EB image. Visible to ALL dealers on portal.ghsbarrie.ca. fr-CA coverage (draft) now spans the **full dealer app AND the full staff/reviewer app** — including the report views, reviewer decision/funding forms, and the deal "what's needed" items + funding-doc type labels (all translated 2026-09-06). Still English **by design**: the internal admin console; the in-app Tutorial (on hold); the verbatim Consumer Protection Act consent text (Québec team supplies the FR); and a few low-traffic residual staff strings (staff gift-cards page, the mail-attachment viewer, one or two report-wrapper labels). Set the var back to `0` (and redeploy) to hide the toggle again. |
| AI support assistant (chat) | ✅ **Live** (2026-09-07, Sean) — `ANTHROPIC_API_KEY` set on EB | Always-on Claude assistant on the General support thread (`src/lib/ai.ts`). Dedicated Anthropic key "Portal.ghsbarrie.ca" (Default workspace) so its cost tracks separately from the booking site's `gwa-booking` key. Model = default `claude-sonnet-5` (override with `ANTHROPIC_MODEL` — `claude-haiku-4-5` to cut cost, `claude-opus-5` for max capability). Assistant stays quiet for 30 min after a human reply; falls back to the static after-hours note if the key is ever removed/out of quota. |
| DeepL translation (user content) | ✅ Live (2026-09-06) — `DEEPL_API_KEY` set on EB (free "API Developer" key) | Powers (a) the on-demand Translate control and (b) the **automatic** FR→EN conversion of chat, deal-conversation and gift-card threads, and dealer free-text notes on the reviewer side (`<AutoTranslate>`). **Free fallback:** if DeepL is missing or out of quota, translation auto-switches to MyMemory (free, no account; set `MYMEMORY_EMAIL` to lift its daily cap). **Usage meter:** Admin → System health shows DeepL characters used / limit. |
| Google Maps / Geocoding (address autocomplete + postal fill) | ✅ Live (2026-09-30, Sean) | `GOOGLE_MAPS_API_KEY` on EB is a key in the **"GWA Portal"** Google Cloud project — **not** the "Booking" project's Maps key (they're separate). Powers server-side Places **autocomplete** and the scanned-lead **postal-code fill** (Geocoding API). **Gotcha fixed 2026-09-30:** postal fill returned `REQUEST_DENIED` for every lead because the **Geocoding API wasn't enabled/allowed on this key's project** — Places *was*, so autocomplete kept working while geocoding failed. Fix: in the **GWA Portal** project, enable **Geocoding API** (APIs & Services → Library) and add it to the key's API restrictions (the key now allows Places + Geocoding). If postal fill breaks again, check *this* key/project, and remember the admin tool now prints Google's exact status. |
| Bell Total Connect voicemail | 📝 Documented, not built here | Guide delivered for the **booking site** (voicemail-to-email + IMAP). Not part of this portal. |
| Hosting / runtime (AWS) | ✅ **Live on AWS** (cutover 2026-09-06; single t3.medium since 2026-10-04) | App runs on **Elastic Beanstalk** (`Gwa-portal-env`, Docker on AL2023, **single t3.medium / 4 GB** + 50 GB gp3) behind **CloudFront + WAF**; RDS Postgres + S3 in `ca-central-1`; DNS `portal.ghsbarrie.ca` → CloudFront. |
| Render (old host) | ✅ **Decommissioned 2026-10-05 (Sean)** — ~$31/mo saved | Portal fully on AWS. Done in the Render dashboard: `gwa-portal` web service **suspended** (standard ≈ $25/mo), `gwa-staging-db` Postgres **deleted** (basic_256mb), `gwa-portal-staging` **deleted** (free). **Still running (by design):** the 6 cron jobs — `GWA-new-leads` (10-min), `gwa-doc-ocr` (30-min), `gwa-doc-expiry-reminders` (daily), `gwa-weekly-funding-report` (Mon), `gwa-db-backup-weekly` (Sun), and `gwa-journal-paid-sync` (every 2h, **added 2026-10-05**) — they `curl` scheduled endpoints on the live AWS site. These 6 are the only thing left on Render; migrate to AWS EventBridge to leave Render entirely. Workspace `tea-d9hr2f715fvs739nkkq0`. |
| Auto-deploy (GitHub → EB) | ✅ **Live** (2026-09-11, Sean) | Every push to the branch builds the image to ECR **and auto-deploys to Elastic Beanstalk** (deploy step in `.github/workflows/build-ecr.yml`, bundles `Dockerrun.aws.json` + `.platform/` nginx fix). IAM user `github-ecr-push` has `AdministratorAccess-AWSElasticBeanstalk`. `wait_for_deployment: false` (the single-instance env flaps Yellow on low traffic, which false-failed the step). No more manual ZIP uploads. |
| Desktop/phone push notifications | ✅ Keys set (2026-09-11, Sean) — confirm with a test | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` set on EB. The client fetches the public key at **runtime** (`GET /api/push/key`) so it survives rebuilds. Reviewers get push on new dealer docs / activity. iOS needs the app installed to the Home Screen. **To confirm:** Account → Enable desktop notifications → Send a test. |
| HD Resolution ↔ Gmail email link | ✅ **Live & verified** (2026-10-07, Sean) | Read-only Gmail via the existing service account (`gwa-journal-writer@gwa-portal-504012…`, project **"GWA Portal"** `gwa-portal-504012`, Unique ID `100470797238569934976`), impersonating `sean@ghsbarrie.ca` + the `HD Resolution` label. All switches done: Gmail API enabled, Workspace domain-wide delegation (`…/auth/gmail.readonly`), `GMAIL_RESOLUTION_USER=sean@ghsbarrie.ca` on EB. **Verified end-to-end** — the Email inbox lists real HD threads and "Open as case" links the thread + auto-fills. 30-min sync `resolution-email-sync.yml` (reuses `CRON_SECRET`). Steps/facts: `HD-RESOLUTION-EMAIL.md`, `BUILD-FACTS.md`. |
| Booking-site lead push (scanned leads → bookers) | ⏳ Ready, not switched on | Code shipped (`src/lib/bookingPush.ts`, hooked in `scanActions.ts`). Turn on by setting `BOOKING_INTAKE_URL` (`https://gwa-booking-staging.fly.dev/api/intake/portal`) + `PORTAL_INTAKE_TOKEN` (shared secret, matches the booking app) on EB, then redeploy. Inert until both are set. |

### Document viewer: tap outside the file to close it (2026-10-09)
- In the full-screen document viewer (deal docs, mail attachments, resource files,
  the HD waiver — anything opened with `DocViewer`), **clicking/tapping the dark
  area around the document now closes it**, in addition to the Close button and
  Esc. Clicks on the document itself or the header bar don't close (they stop the
  click from bubbling to the backdrop).

### Fix: HD waiver "View" stranded you on the PDF on mobile (2026-10-09)
- Tapping **View** on the auto-attached Home Depot waiver opened the raw PDF in a
  new tab — in the installed app / on mobile there was **no way back**. View now
  opens the in-app **DocViewer** overlay (full-screen, with a Close button that
  clears the iOS notch), the same viewer the deal documents use. It shows a
  rendered page image (`public/hd-customer-approval-waiver.png`, generated from the
  PDF with the app's own `pdf-to-img` renderer) so it displays reliably on iOS;
  **Download** still hands over the printable PDF.

### Fix: header showed two bell icons (Mail link used the Bell icon) (2026-10-09)
- The top bar rendered the notification bell and, right beside it, the **Mail**
  link — but the Mail link was drawn with the **Bell** icon, so it looked like two
  notification bells. Swapped the Mail link to the **envelope (Mail) icon** in both
  `StaffShell` and `DealerShell` (each already imported `Mail` for its nav). The
  mail unread badge and `/…/mail` link are unchanged.

### HD Customer Approval Waiver attached automatically to HD deals (2026-10-09)
- Per Sean: the **Home Depot Customer Approval Waiver** is the same standard form
  on every HD deal with **nothing to fill in**, so the portal now **attaches it
  automatically** instead of the dealer uploading it each time. On any HD-program
  deal (`programType === 'HD'`) a **Home Depot Customer Approval Waiver** card
  shows with **View / Download** — on the dealer's deal page **and** the reviewer's
  deal page (so the GWA review team sees it's attached). The PDF is bundled as a
  static asset (`public/hd-customer-approval-waiver.pdf`, same pattern as the
  FinanceIt loan-application PDF).
- **Removed the manual "Home Depot waiver" upload** from the funding checklist.
  `HD_WAIVER` is no longer a dealer upload item on any deal (it was required on HD
  deals before), so dealers never upload it and reviewers never count it missing.
  The `HD_WAIVER` document type is kept for historical uploads. Updated
  `fundingDocumentTypesFor` + `tests/fundingDocTypes.test.ts`.

### Zoom recordings → dealer portal (auto-sync + review/publish) — OFF by default (2026-10-09)
- GWA's Zoom cloud recordings **auto-sync** into the portal and land in a **review
  queue**; an admin **publishes** the ones that go live, and **all dealers** see
  them under a new **Recordings** tab with a **Watch/Download** link (opens Zoom)
  + passcode. No more sending recordings out one by one. Dealers never see pending
  or hidden ones; the tab appears only once something is published.
- **Delivery = link to Zoom** (share URL + passcode; video stays on Zoom, no
  storage cost). Admin can edit the dealer-facing title/description/passcode and
  hide/unpublish.
- New `ZoomRecording` model (migration `20261009020000`), `src/lib/zoom.ts`
  (server-to-server OAuth + list recordings), `zoomSync.ts`, cron
  `/api/cron/zoom-sync`, admin page (new `zoom-recordings` section) + dealer page,
  tests. **Dormant until Zoom creds are set** — create a Zoom Server-to-Server
  OAuth app (`recording:read:admin`) and set `ZOOM_ACCOUNT_ID` / `ZOOM_CLIENT_ID`
  / `ZOOM_CLIENT_SECRET` on EB, then add the cron. Full steps:
  `docs/ZOOM-RECORDINGS.md`.

### New-lead customer auto-text (MMS + SMS) — built, OFF by default (2026-10-09)
- When a new lead comes in (in-store scanned card, mail-in card, or online HD
  Leads Log), the customer gets **one** text: "Home Depot Home Services (serviced
  by Georgian Water & Air) — we received your in-home water assessment request; a
  team member will call within 24–48 hrs. Reply STOP to opt out." **MMS with a
  branded image first, SMS fallback.** Deduped (one per lead, same leadKey as the
  push sweep), sent only within the customer's **local daytime window** (8am–9pm
  by province), **French** to Quebec.
- **Off by default + test mode** (texts only a test number) so it can't blast real
  customers. Admin → **Lead auto-text**: enable, test mode + number, EN/FR preview,
  MMS image URL, per-province sender map, daytime window, recent sends + opt-outs,
  and a "send sample" button.
- New `LeadTextOutbox` + `SmsOptOut` models (migration `20261009010000`),
  `src/lib/leadText.ts`, MMS support in `sms.ts`, enqueue wired into
  `scanActions` + `leadNotify.sweepNewLeads`, cron `/api/cron/lead-text-sweep`,
  inbound STOP webhook `/api/sms/inbound`, 11 tests. **To go live:** verify a
  toll-free number for Canada, set the Twilio env + webhook + cron, add the MMS
  image, then flip test mode off. Full steps: `docs/LEAD-AUTOTEXT.md`.

### Reviewer: HD waiver card moved to "Produce install documents" (2026-10-09)
- The auto-attached Home Depot Customer Approval Waiver card was showing under
  step 4 "Review signed documents" on the reviewer side; it belongs under step 2
  **"Produce install documents"** (where the reviewer sends the dealer their
  paperwork). Moved it there, as an info card ("attached automatically — no need
  to upload/send it"). Removed from the review-signed step.

### Fix: E-Transfer deals couldn't submit; journal "How they paid" now fills every method (2026-10-09)
- **E-Transfer (and Finance company) deals were blocked** on submit with
  "Payment type — required": the main `applicationSchema.paymentMethod` enum was
  missing `E_TRANSFER` / `FINANCE_COMPANY` (the other two payment schemas had
  them). Added both; regression test covers every method the UI offers.
- **Journal "How they paid" column now reflects every payment option.** It was
  left blank for Cash / Cheque / E-Transfer and for finance companies without a
  known short code. Now: FinanceIt keeps `HDFINIT`/`GHSFINIT`, Enercare/UEI keep
  their coded form, cards keep `HDCC`/`CCHD`, **Cash→"Cash", Cheque→"Cheque",
  E-Transfer→"E-Transfer"**, and a **different finance company → that company's
  name**. `journalPayCode` in `src/lib/payments.ts` (+ tests). The reviewer deal
  page already shows the exact method in its "Payment" row.

### Reviewer queue: revert Approved-attention change; in-progress sorts recent-first (2026-10-09)
- Earlier today Approved deals were made to count as a reviewer to-do ("Produce
  documents") so they'd sit in the Attention band. Per Sean this wasn't the
  wanted behaviour, so it was **reverted** — `needsAttention` / `actionFor` /
  `activityFor` in `src/app/(staff)/staff/page.tsx` are back to the original:
  Approved is **"Awaiting install"** and sits in the in-progress lane as before.
  (Do not re-introduce the APPROVED→attention change.)
- Instead, per Sean's actual ask: a deal he just handled should land at the **top**
  of the in-progress list, not the bottom. The **In funding** lane now sorts
  **most-recently-touched first** (`byRecentActivity`, matching the priority view's
  "In progress" band) instead of longest-waiting-first.

### Dealer snapshot: show City & Postal code for HD/photo deals (2026-10-09)
- City and Postal code showed "—" on HD/photo deals because the snapshot read
  them only from the typed loan application. Now they fall back to the
  `Application.applicantCity` / `applicantPostal` fields (plaintext, same source
  the journal/search use) so they display. No reveal gate — the dealer already
  sees the street address, phone and email on their own customer.

### Dealer deal page: customer street address back in the snapshot (2026-10-09)
- Per Sean: the **street address is shown again** in the dealer-facing **Customer
  snapshot** (on `/dealer/applications/[id]`). It had been left out, which made it
  hard to recall/route a customer from the snapshot. Now a full-width **Address**
  row sits above City/Province/Postal. Sourced from the encrypted
  `applicantAddressEnc` via `decryptOptional` (same field the HD case card and
  journal sync already read); shows "—" when none is on file. Dealer only sees
  their own office's deals (unchanged `canAccessAsDealer` guard) — this just
  un-hides a field on deals they already have access to. EN/FR label added.

### HD Resolution: link-to-deal control + contacts auto-follow; product picker − N + stepper (2026-10-08)
- **Link an existing case to a deal, from the case page.** The *Notify office* and
  *Documents & resources* sections said "Link this case to the customer's deal…"
  but there was **no way to actually do it** once a case existed unlinked — a dead
  end. New **"🔗 Link to a deal"** card (shown only when a case isn't linked):
  auto-suggests the customer's deals (matched by **phone** + **name**), plus a
  search box to find any deal by name/phone. Linking backfills the office, HD Ref #
  and phone, so Notify office + the deal's documents switch on immediately.
  New `findDealsForCaseAction` / `linkCaseToDealAction` / `unlinkCaseFromDealAction`
  + `LinkDealControl`.
- **Contacts follow the customer.** Opening a new case for a customer we've dealt
  with before **pre-fills the contact card** (email, address, spouse, HD rep,
  extra contacts) from their most recent prior case, matched by phone. Saves
  re-typing the same numbers on every new HD case for a repeat customer.
- **Product picker now shows a proper `− N +` stepper** on each selected tile
  (minus, count, plus) — matching the approved mock-up. The earlier build only
  showed a count badge + a single `−` (tap-the-tile to add more), which wasn't
  obvious. Tapping the tile still adds one; the hidden-input-per-unit + journal
  UNITS logic is unchanged.

### HD Resolution: contact card, read-full-email, decoded snippets (2026-10-08)
- **Contact card at the top of every case** — two panels, both editable inline:
  **Customer** (name, phone, email, address, spouse name/phone) and **Home Depot
  contact** (the rep on the case — Brooke/Sandra/Dennis — with phone + email). Plus
  an **"＋ Add contact"** list for ad-hoc numbers given on a call (e.g. the spouse's
  cell). Phone/email are tap-to-call / tap-to-email, and the customer name links to
  their file. Customer email/address default from the linked deal; everything saves
  on the case (`updateCaseContactAction`). New fields on `ResolutionCase`
  (migration `20261008020000_resolution_contact_card`).
- **"Read full message"** on each HD email — pulls the whole email from Gmail on
  demand (not just the snippet). `fetchMessageText` + `fetchEmailBodyAction` (guarded
  so only a message already synced to that case can be fetched).
- **Decoded email text** — Gmail snippets/subjects were showing raw HTML entities
  (`you&#39;re`, `Hi Sean &amp; JJ`). Now decoded everywhere they're shown (thread,
  inbox, case title) via `decodeEntities` (+ `tests/htmlEntities.test.ts`).

### New application: products sold now support quantity (two of the same) (2026-10-08)
- The "Product(s) sold" picker lets you sell **two or more of the same product**.
  Tap a product to add it, tap again for another — a **×N badge** shows the count
  and a small **−** removes one. The 23-item grid stays as compact as before (no
  per-row steppers), and it works one-tap on a phone. Search + "Other" unchanged.
- The journal **UNITS** count is now correct (it's the total quantity). Each unit
  posts as its own `productsSold` value; `mergeProductsSold` keeps duplicate picks
  (the quantity) while still de-duping the free-text "Other" field. Shared
  `ProductPicker` so the dealer new-deal form AND the reviewer edit form both get it.

### HD Resolution: ✨ AI "Draft reply to HD" from case notes (2026-10-08)
- New **"✉️ Draft reply to HD"** card on a resolution case: one click turns the
  case's **notes** (+ HD's latest email when the thread is linked) into a
  professional, ready-to-send reply you **review and edit**, then copy into Gmail.
  Nothing is sent from the portal (Gmail access is read-only) — a "send from the
  portal" path would need a Gmail send scope, a later add-on.
- `draftHdReply` in `ai.ts` (metered as `ai_resolution_reply`),
  `fetchLatestInboundText` in `gmailResolution.ts` (HD's most recent message, not
  our replies), `draftHdReplyAction`, and the `HdReplyDrafter` client card. The
  reply uses notes written on the case, which already log who wrote them + when.

### Direct sale locked to Georgian Water internal team only (2026-10-08)
- Per Sean: Direct sale is used **only at Georgian Water, nowhere else** — **no dealer
  should ever have it.** `canEnterDirectSale` is now **internal-staff-only**
  (REVIEWER/ADMIN), with no per-user grant path and impersonation excluded. The
  dealer-portal nav entry and the **Admin → Users "Direct sale access" grant were
  removed entirely**, so there is no way to turn it on for a dealer. The
  `User.canEnterDirectSale` column is kept but **deprecated/unread** (no destructive
  migration).

### Fix: Direct sale leaked into "view as dealer" + no way back (2026-10-08)
- **Tenant-isolation fix.** When an admin was "viewing as" a dealer (impersonation),
  the Direct sale tool still treated them as internal — because impersonation keeps
  the admin's role and only swaps the scoped dealer. That showed "Direct sale" in the
  dealer's nav and listed ALL direct sales (incl. Georgian Water's) in the dealer
  view. `canEnterDirectSale` now returns false while `impersonating`, and the
  `/direct-sale` pages exclude impersonation from the internal check (defense in
  depth). An admin viewing-as-dealer now sees exactly what that dealer sees.
- **"No way back" fix.** The standalone `/direct-sale` page had no portal chrome;
  added a **← Back to portal** link (to /staff or /dealer).

### Direct sale: lands "In funding" + GWA office default; blank journal payout note (2026-10-08)
- **Direct sale now enters "In funding" (`FUNDING_REVIEW`)**, not straight to
  Funded + Paid. The flow is: enter the sale (bill of sale + payment source still
  required) → it seeds the journal row (pending `PE/OK`) and lands **In funding** →
  staff press **✓ Mark Funded** on the deal (the existing funding-step button) →
  it turns **Paid** when the journal shows OK + Date Paid (the read-back). So the
  deal progresses through the normal funnel instead of being auto-completed.
- **Office defaults to Georgian Water & Air.** The new-sale form pre-selects the
  GWA office (matched by name) since it's the only office that enters direct sales
  (still changeable). The Direct sales list now shows a **Status** column
  (In funding → Funded → Paid).
- **Journal-sourced payouts no longer carry a note.** The paid-sync used to stamp
  "Auto-filled from the sales journal (Pay to dealer)" on each auto-created payout;
  it now leaves the Notes blank (the journal auto-fill is still in the audit log).
  One-time migration `20261008010000_blank_journal_payout_note` clears the note on
  payouts already written.

### Direct sale — Georgian Water & Air walk-in entry (2026-10-07)
- **New screen at `/direct-sale`** for entering a Georgian Water & Air in-store
  walk-in sale and completing it **straight to Funded + Paid** — no docs/funding
  round-trip. Enter the customer + sale, pick how it was paid, attach the **bill
  of sale** (required), and "Complete direct sale" sets the deal **FUNDED**, the
  **paid date = the sale date**, and writes the sales-journal row as **settled**
  (Result **"OK"** + **Date Paid**, UNITS = product count) so it matches the paid
  read-back immediately.
- **Scope: the GWA team only — never dealers.** Internal staff (Reviewer/Admin)
  get it automatically (link in the staff nav). A new per-user grant
  **`canEnterDirectSale`** (Admin → Users → "Direct sale access") lets you hand it
  to a specific Georgian Water office person — even a store login — **without
  opening it to dealers generally**; a granted store login gets a Direct sale tab
  in their own portal. It is deliberately **not** on the shared dealer new-deal
  form. The route guards itself (`requireDirectSaleAccess`) so a direct URL can't
  bypass the grant.
- Payment source gate matches funding: a GWA-program cash sale needs no reference
  numbers; an HD-program sale needs the HD Customer #; a financed sale needs the
  finance company + financing deal number (surfaced as a friendly error).
- `EntryMethod.DIRECT` + `User.canEnterDirectSale` (additive migration
  `20261007020000_direct_sale`); shared journal writer extracted to
  `src/lib/journalSync.ts` (now writes Date Paid + "OK" for an already-paid deal);
  new `directSaleSchema`, `src/lib/directSaleAccess.ts`, `/direct-sale` pages +
  `createDirectSaleAction`; `tests/directSale.test.ts`. Journal "Date Paid" write
  is inert for every other deal (only written when a deal carries a paid date).

### HD Resolution: Gmail link LIVE + smart case pre-fill from the email (2026-10-07)
- **The Gmail email link is live and verified** (see Operational status). Read-only,
  one mailbox (`sean@ghsbarrie.ca`), one label (`HD Resolution`).
- **"Open as case" now pre-fills the whole case from the HD subject.** HD subjects
  are structured — `CASE #08210415 ON DUPRE 7133 LEAD #800254246 WATER TREATMENT…`
  — so `parseHdSubject` pulls the **case #, customer last name, store #, and HD Ref #
  (the 800… lead)** and fills the new-case form (name + HD Ref # + case #), on top of
  the existing title + thread link.
- **Auto-matches an existing deal.** The parsed HD Ref # is looked up against
  Applications; on a match the case is **linked to that deal** (its office +
  documents come with it) and the customer name/phone fill from the deal. A green
  "✓ Linked to …'s deal" banner shows, with an **Unlink** toggle.
- **Everything stays editable.** The pre-filled name/phone/HD Ref # are normal
  inputs (no locked card) so staff can correct them; `createCaseAction` now treats
  a linked deal's values as **fallbacks** (typed edits win) instead of overwriting.
- `parseHdSubject` in `gmailResolution.ts` (+ `tests/gmailResolution.test.ts`);
  `new/page.tsx` HD-Ref deal lookup; `NewCaseForm` always-editable + linked-deal
  banner; `inbox` "Open as case" passes the parsed fields.
- **Phone + name also fill from the JOURNAL ARCHIVE.** When there's no live portal
  deal, the new-case page falls back to `JournalRecord` (matched on the HD Ref #)
  for the customer's phone + name — so older HD customers who predate the portal
  still auto-fill. Fill-only (no deal to link).
- **✨ "Summarize the HD email" button** on the new-case form (shown when a thread
  is linked and AI is configured). Reads the FIRST email's full body (`fetchFirstMessageText`
  — strips quoted history) and has Claude write a short, bulleted problem statement
  into the Problem box (`summarizeResolutionEmail` in `ai.ts`, metered under the new
  `ai_resolution_summary` service). On-demand (one click) so AI tokens are only spent
  when wanted; the Problem field is editable after. Action: `summarizeEmailAction`.

### HD Resolution: match emails by HD Case # + "awaiting your reply" flag (2026-10-07)
- **Match by HD's CASE #, not just the HD Ref #.** HD's resolution emails are keyed
  by a **CASE #** (e.g. `CASE #08210415 ON …`), which is the reliable thing in the
  subject line — the HD customer/LEAD # isn't always present. A case now carries an
  optional **HD Case #** (new field on the new-case form), and linking the email
  thread searches by **HD Case # → HD Ref # → portal case #** in that order. Opening
  an unlinked email as a case **auto-fills the HD Case #** parsed from its subject.
- **"⏳ Awaiting your reply · N days".** Each synced email is tagged **inbound** (from
  HD) vs. ours (from `ghsbarrie.ca`). When the **latest** email on a case is from HD,
  the case shows an "awaiting your reply" flag — **amber**, turning **red at ≥5 days**
  to match HD's own 5-day reminder. Shown on both the queue rows and the case header,
  so an unanswered HD email can't quietly sit.
- `ResolutionCase.hdCaseNumber` + `ResolutionEmail.inbound` (additive migration
  `20261007010000_resolution_email_reply`); `parseHdCaseNumber` / `isInbound` /
  `ourMailDomain` in `gmailResolution.ts` (override the domain with
  `GMAIL_RESOLUTION_OUR_DOMAIN`); `awaitingReplyDays` on the queue + case detail;
  `tests/gmailResolution.test.ts`. Still inert until the Gmail link is switched on.

### Dashboard hero: special occasions can run "until turned off" (2026-10-04)
- A special-occasion hero (e.g. a GIF) no longer requires a date window. **Leave
  both dates blank** and it runs **until you turn it off** (matches how the login
  screen already works). Set both dates to schedule a window as before; one date
  without the other is rejected.
- While a special is live it still **takes over the time-of-day rotation**; when a
  dated window ends it **falls back on its own** to the normal Morning→Night
  heroes. A scheduled (dated) special in its window beats a standing always-on one.
- `specialIsLive` (no dates → always on), `createSpecialHeroAction` (dates
  optional), `SpecialHeroForm`, the admin list ("Always on"), and
  `tests/dashboard-hero.test.ts`.

### Journal → Paid: self-heal stale tab pointers (2026-10-05)
- **Root cause found for "no deal ever advanced to paid":** many deals carried a
  stored journal pointer to a month tab that no longer exists in the LIVE sheet
  (e.g. `Sep.2026` — renamed/recreated by the office, or written to the test sheet
  while the read is live-only). The read failed with *"Unable to parse range:
  'Sep.2026'!A1:BZ60"* and there was **no fallback**, so every such deal errored
  and nothing advanced.
- **Fix:** when a **stored** tab/row fails to read, `syncApplicationFromJournal`
  now **drops the dead pointer and re-finds the deal by identity** against the
  journal's CURRENT tab names, then reads again; if it still can't locate it, the
  stale pointer is cleared so the next run matches fresh. (`src/lib/journalPaidSync.ts`.)
- After deploy, the 2-hourly sweep (or a manual Render "Trigger Run") will
  re-walk the settling backlog and advance any deal the journal shows OK + paid.

### Journal → Paid sweep is now actually scheduled (2026-10-05)
- The automatic journal→paid back-check (`/api/cron/journal-paid-sync`,
  `sweepJournalPaid`) existed but **had no scheduler** — only the per-deal "↻ Check
  journal now" button ever ran it, so paid deals never auto-advanced on their own.
- Added the missing cron **`gwa-journal-paid-sync`** (Render, every 2h) — confirmed
  running (first successful run 02:03). Deals showing journal **Result "OK" + Date
  Paid** now auto-advance to **Funded & Paid** without anyone clicking.
- Also: **Render decommissioned** (gwa-portal suspended, staging DB + staging web
  deleted) — ~$31/mo saved; the 6 crons stay. See Operational status table.

### Funding report: break out "In for funding" (2026-10-05)
- The funding report lumped everything not-yet-paid into one **"Awaiting payment"**
  number (approved + docs + in-for-funding + funded). Offices actually need the
  **in-for-funding** figure on its own. Split the pipeline by stage:
  **In for funding** (`FUNDING_SUBMITTED` + `FUNDING_REVIEW`) and **Funded,
  awaiting payout** (`FUNDED`), alongside the overall total.
- **Dealer report** now shows four tiles (Deals paid · Paid to you · **In for
  funding** · Funded awaiting payout) **plus a list of exactly those pending
  deals** (customer, HD #, stage, in-since date, value), oldest first so the
  longest-stuck float up. **Staff report** gains the same In-for-funding /
  awaiting-payout tiles. Weekly email summary now names the in-for-funding count.
- `buildFundingReport` returns `inForFunding` / `awaitingPayout` / `pending`
  (`src/lib/reporting/fundingReport.ts`); bilingual labels added. No data model
  change — reads existing statuses + payouts.

### Fix deal status tracker label overlap (2026-10-04)
- In the reviewer timeline (and the dealer bar), the step labels (Submitted,
  Approved, Confirmation, …) rendered at their natural width centred on each icon
  and **overlapped** neighbours on tighter widths. Bounded each label to its
  column (`block w-full` + `break-words`) so it wraps inside the column instead of
  spilling. `src/components/DealProgress.tsx`. No logic change.

### Fix noisy cron "failure" emails — 504 on long runs (2026-10-04)
- Render was emailing "Cron job failure … Exited with status 22" for **doc-ocr**
  (and would for **db-backup** / **weekly-funding-report**). Root cause: those
  endpoints **awaited** their work before responding, and a long run exceeds the
  **30s CloudFront origin-response timeout** → the gateway returns **504** →
  `curl -f` exits 22 → "failure" email. The work itself usually still completed on
  the EB server (maxDuration 120–300s); runs with nothing to do returned instantly
  and succeeded. So: false failures, not real breakage.
- Fix: made those three endpoints **fire-and-forget** — kick off the work and
  return `{ ok, started: true }` immediately, so the 30s gateway timeout is never
  hit. This is the **same pattern `new-leads` and `doc-expiry-reminders` already
  used** (two of five crons had it; three were missed). Work still runs to
  completion on the server; OCR docs stay `ocrPending` until processed.
- Note: the cron now reports "started", not the result — check server logs (or the
  outcome: a written backup, a sent report, OCR'd docs) to confirm completion.
  Applies regardless of scheduler, so it still holds after the crons move to AWS.

### All costs in one place — the Costs hub (2026-10-04)
- `Admin → Outside costs` is now **`Admin → Costs`**: a single page that totals
  **every** running cost for the month, not just Google + fixed bills.
- **One grand total (CAD)** now includes the metered services that bill in USD:
  **AI (Anthropic)** — assistant + lead-card reader, from real token usage — and
  **texting (Twilio SMS)**. A new editable **USD→CAD rate** (default 1.37) folds
  them in; each line shows the original USD and the rate.
- The detailed meters that used to live elsewhere are **gathered on this page**:
  the AI spend meter (was System health), the Twilio balance/spend card (was Email
  settings), DeepL translation usage, and the storage meter. The originals keep a
  one-line link here so nothing's lost. Twilio's live total is best-effort — if the
  API call fails the page still renders and the line shows "unavailable".
- `src/lib/costs.ts` gains `usdToCad` + `usdToCadAmount`/`amountInCad` helpers
  (unit-tested); `tests/costs.test.ts`. Section renamed in `ADMIN_SECTIONS`.

### Cost calculator → AWS (Render removed) (2026-10-04)
- The **Outside costs** calculator (`Admin → Outside costs`) priced hosting as
  **"Render hosting"** — stale since the move to AWS. Replaced the fixed-bill lines
  with the real setup: **AWS app hosting (EC2 8 GB + 50 GB disk)**, **CloudFront
  CDN + WAF**, S3, RDS (ca-central-1), email, domain. New editable keys `awsCompute`
  / `awsCloudfront` (the `render` key is gone); starting estimates ≈ $73 compute +
  $8 CDN/WAF (admins still enter their real bill). `src/lib/costs.ts`,
  `CostsForm.tsx`, `saveCostsAction`, `tests/costs.test.ts`.
  - Instance is **8 GB** (per Sean) — i.e. a **t3.large** (t3.medium is only 4 GB).
    ⚠️ `RELIABILITY.md` still records the 2026-10-04 bump as t3.medium/4 GB; confirm
    the actual instance type in the AWS console and reconcile the two.
- Render decommission recorded in the Operational status table above — what to
  shut down vs. the cron jobs to keep.

### Deployed: login screen + hero batch (2026-10-04)
Pushed and deployed live the batch below (11 commits: dealer-banner GIF, dashboard
hero GIF + overnight, Halloween sign-in skin, Oct-18 start, **dashboard hero
manager**, **login screen manager**, the new moonlit Halloween background, clearer
"starts on / back to original on" date labels, and the login front-door hardening).
- **Deploy call:** done **live during the day**. The env is single-instance
  (Immutable policy), so a deploy has a few-second cutover where one in-flight
  request can blip; sessions survive, migrations here are additive (two new empty
  tables: `DashboardHero`, `LoginTheme`), and EB auto-rolls-back if boot fails.
  Judged low-risk and accepted. See `RELIABILITY.md` for the zero-downtime
  (load-balancer) option we discussed and deferred.
- **Front-door hardening:** `activeLoginTheme()` wraps its DB query in try/catch so
  a transient DB error (or a not-yet-applied migration) on the public sign-in page
  can never break login — it falls back to the built-in look. (`src/lib/loginTheme.ts`.)
- Nothing changes visually for dealers on deploy day: the Halloween skin is
  date-gated to **Oct 18**, and both managers are admin-only pages.

### Login screen manager — upload a sign-in look + schedule occasions (2026-10-04)
- **New admin page `/admin/login-screen`** (grantable section `login-screen`) to
  set the sign-in page's background (and accent colour) from the portal — the same
  idea as the dashboard hero manager, for the login screen.
  - Upload a background (GIF fine), name it, pick an accent colour (drives the
    title word, the sign-in button and the field focus ring).
  - **Optional dates:** set both and it shows only in that window (Toronto date)
    and reverts on its own; leave both blank for an always-on look you switch on
    and off. A scheduled look in its window beats an always-on one.
- The sign-in page now resolves in order: an active admin login theme →
  the built-in Halloween skin (spooky season) → the normal login. The Halloween
  skin was generalised into `SeasonalLogin` (accent-parametrised via a CSS var +
  `color-mix`, so any colour reads right); `SpookyLogin` is now a thin preset of it.
- New `LoginTheme` model + additive migration `20261004160000_login_theme` (empty
  table; the built-in looks keep working until a theme is added). Served through a
  **public, per-IP rate-limited** route (`/api/login-theme/[id]/image`) — the
  sign-in page is pre-auth — via the shared image helper (GIFs untouched so they
  animate). `src/lib/loginTheme.ts` resolves the live theme; tests in
  `tests/login-theme.test.ts`.

### Halloween sign-in skin — full-bleed night look (2026-10-04)
- The sign-in page gets a full seasonal reskin during the spooky season (Oct 18 →
  Oct 31, reverts Nov 1 — all decided server-side from the Toronto date, so no
  flicker and no manual switch): a full-bleed night background
  (`public/halloween-login-bg.webp`), a glass card, and an orange accent on the
  last word of the title.
- It only reskins the **chrome**. `SpookyLogin` wraps the real `<LoginForm>`
  untouched, so the sign-in action, validation, error messages, MFA and the EN/FR
  toggle all keep working exactly as before — every Halloween style is scoped to
  `.spooky-login` so nothing leaks to the normal login the rest of the year.
- Replaces the earlier subtle `SpookyDecor` overlay on the login page.
  `login/page.tsx`: `if (isSpookySeason()) return <SpookyLogin />;` else the normal
  login. Responsive + honours `prefers-reduced-motion`.

### Dashboard hero manager — upload heroes + schedule special occasions (2026-10-04)
- **New admin page `/admin/dashboard-hero`** (grantable section `dashboard-hero`)
  so heroes are managed in the portal instead of committing files. Two parts:
  - **Time of day:** upload an image/GIF for any slot (Morning … Night). An
    uploaded hero overrides the built-in `public/hero-*.webp` default for that
    slot; "Remove" reverts to the default.
  - **Special occasions:** upload a hero (GIF fine), name it, set start/end dates
    and *whole-day* or *nights-only* — it takes over the dashboard between those
    dates and **reverts on its own** (Toronto-date window). Turn any on/off manually too.
- New `DashboardHero` model + additive migration `20261004150000_dashboard_hero`
  (empty table; file-based heroes keep working until a slot is overridden).
- Served through an authenticated route (`/api/dashboard-hero/[id]/image`) via the
  shared image helper — GIFs untouched so they animate. `src/lib/dashboardHero.ts`
  resolves live slot images + the active special; `src/lib/heroSlots.ts` holds the
  shared slot list; `HeroBackdrop` now takes resolved slot images + a special
  override. Tests in `tests/dashboard-hero.test.ts`.

### Dealer banner (portal sign) supports animated GIF (2026-10-04)
- The announcement banner upload (Admin → Dealer portal sign) now accepts
  **animated GIF**, and it keeps animating on the dealer dashboard. The upload
  already stored the original bytes; the two blockers were the MIME allowlist and
  the shared image-serving helper flattening it.
- `setAnnouncementImageAction` accepts `image/gif` (a banner-specific list — GIF is
  deliberately NOT added to the deal-document allowlist). File picker updated.
- `resizedImageResponse` (`src/lib/imageResponse.ts`) now detects a GIF by its
  magic bytes and serves the original untouched instead of running it through
  sharp (which would flatten it to one frame) — this also avoids heavy
  multi-frame rasterization on the single instance. Benefits any caller that
  serves a stored GIF. Still 15 MB max; smaller GIFs load faster for dealers.

### Journal → Paid sync now works for hand-typed rows (2026-10-04)
The read-back (journal shows **Result "OK" + a Date Paid** → portal marks the deal
**Funded & Paid**) had never fired in practice. Two reasons, both fixed:
- **It only worked for deals the portal itself wrote to the journal** (it relied
  on a stored tab + row). The office types deals straight into the sheet, so there
  was no stored row and the sweep skipped them entirely. Now the portal **finds
  the deal's row by identity** — HD Customer # → loan # → an unambiguous
  name — on the sale-month tab (HD/loan deals also scan the year's other months),
  remembers the row, and reads its Result/Date Paid. Matching is conservative: a
  reference match must also agree on the last name, and a name-only match must be
  the single row with that name, so "paid" can't land on the wrong customer.
  (`findRowInLayout` / `findDealRowByIdentity` in `src/lib/journal.ts`, with
  `tests/journalIdentityMatch.test.ts`.)
- **The read followed the Test/Live write toggle.** "Paid" only ever happens in
  the live journal, so the read-back now always uses the **live per-year** sheet
  (`liveOnly`), independent of the write mode — the same way reporting reads do.
  Leaving the portal in Test mode used to silently point the paid check at the
  sandbox sheet.
- The scheduled sweep (every 2h) now includes deals with no stored row (settling
  statuses, capped per run; rows are remembered so later runs are cheap). The
  per-deal **"↻ Check journal now"** button now shows on In-funding and Funded
  deals too (not just "In for funding"), and prints exactly what it found — so a
  reviewer can confirm a single deal instantly and read the reason if it's not yet
  marked paid.

### Security fix — admin privilege boundary (audit #3) (2026-10-04)
Closes the privilege-escalation path from the audit: a scoped "Users"-section
admin could reset a **Super Admin's** password (then sign in as them) or change
privileged roles, and nothing guarded the last Super Admin from this screen.
- `updateUserAction`/`createUserAction` (`src/app/(admin)/actions.ts`): only a
  Super Admin may edit an administrator account, reset its password, or promote
  anyone to administrator. Reviewers/dealers stay fully manageable by a scoped
  Users admin.
- Last-active-Super-Admin guard added to `updateUserAction` (mirrors
  `saveAdminAccessAction`), so neither screen can orphan the back end; demoting an
  admin now also strips its Super-Admin + section grants.
- Same boundary applied to `toggleUserActiveAction` (can't archive an admin / the
  last Super Admin) and `signOutUserEverywhereAction` (can't force an admin off
  their devices) — both were `requireAdminSection('users')` only.
- No behaviour change for a Super Admin or for managing non-admin users.

### Security hardening — insider DoS batch 1 (2026-10-04)
From the 2026-10-04 security audit (`docs/SECURITY-AUDIT-2026-10.md`), the
highest-impact uptime risks (the Oct-2 class: one insider/accidental action
exhausting the single instance). No behaviour change for normal use.
- **Chat unread badge no longer fans out (audit #1).** `unreadCounts`
  (`src/lib/chat.ts`) did one `COUNT` query per conversation in parallel — on an
  auto-polled badge that meant hundreds of queries per load and could exhaust the
  DB connection pool. Replaced with a single grouped query (parameterized raw
  SQL, same semantics). Added a `take: 200` cap to the dealer conversation list.
- **Heavy render endpoints are rate-limited (audit #2).** Per-user `rateLimit` on
  the PDF-page and thumbnail routes (`documents/[id]/pages`, `.../thumb`,
  `mail/attachments/[id]/pages`, `resource-files/[id]/pages`) — these rasterize
  whole PDFs and had no cap, so a scripted burst could wedge request workers.
- **Dealer uploads are throttled (audit #6).** Per-user `rateLimit` on the three
  dealer upload actions (OCR + image processing run on the request path).
- Deferred to later batches (documented in the audit): render memory/stream
  (#4), `full-export` streaming (#9), and an explicit Prisma `connection_limit`
  (an ops/env tweak, noted for Render/EB).

### Morning catch-up digest (reviewer) (2026-10-04)
- **A "what happened since you were last here" briefing at the top of the Deals
  queue** (`/staff`). Reads the same live signals as the rest of the staff area
  and summarises, since the reviewer last cleared it: **office replies on flagged
  confirmation issues**, **new deals submitted**, **funding packages returned**,
  and **pending cancellation requests** — four count tiles plus two action lists
  ("Replies waiting on you", "Needs a decision"), each linking into the deal.
- **Weekend-proof by design.** `User.catchUpSeenAt` (new nullable column,
  migration `20261004140000_catch_up_seen`) only advances when the reviewer hits
  **"Mark caught up"**, so leaving Friday and returning Monday shows everything
  since Friday — no special-casing. Defaults to a 24h look-back before the first
  clear, capped at 7 days. `src/lib/catchUp.ts` (+ `tests/catch-up.test.ts`) and
  `markCaughtUpAction`.
- Renders nothing when there's nothing new. This is the third piece of the
  follow-up design, now reading from the same confirmation/follow-up signals as
  the `/staff/confirmations` worklist, so all three work together.

### Confirmation calls worklist (reviewer) (2026-10-04)
- **New reviewer worklist at `/staff/confirmations`** so the confirmation call
  stops falling through. Deals keep advancing (into funding, even Funded) before
  the call is made, so the ones still owed a call scattered out of view with no
  way to find them. This page pulls them all together in one place.
- **Four work-states, derived — no dealer-facing change, no enum migration.**
  `src/lib/confirmationWork.ts` computes a per-deal state from data that already
  exists: **Needs a call** (reached the review/signed-docs stage but not started),
  **In progress** (call started — shows which of the six checks are left, "3 of 6"),
  **Issue · follow-up** (a flagged confirmation issue), **Confirmed** (completed
  today). Eligibility reuses `currentPhaseIndex >= 4` from `reviewerFlow`, the same
  gate the deal page uses, so the worklist and the deal never disagree.
- **The follow-up queue is folded in.** The "Issues · follow-up" state is the
  weekend follow-up queue — a flagged issue where the office replied last (so it's
  waiting on a reviewer) surfaces here, aging to red after 2 days. One list, so
  office replies over a weekend don't get lost.
- **Three views, like the Deals queue:** Worklist (urgency bands + overdue
  callout), Tabs (state chips + live search by name/office/HD ref), Stacked.
  Choice remembered per reviewer. Everything links into the customer's deal, where
  the call is made and the history lives — the page is an index, not a new store.
- **Nav + discovery:** a "Confirmation calls" item in the staff nav with an
  outstanding-work dot (`src/lib/confirmationQueue.ts`, cheap count), a quick link
  on the Deals header, and a new grantable admin section `confirmations`.
- Unit tests in `tests/confirmation-work.test.ts`.

### Twilio Voice — call-recording groundwork, OFF (2026-10-04)
- **Prepared, not live.** Lays the groundwork to record confirmation calls the way
  the booking site does, without turning anything on — same safe pattern as SMS
  (present in code, inert until configured). Nothing dials, records, or reaches
  Twilio yet.
- `src/lib/voice.ts` — `voiceEnabled()` / `voiceRecordingEnabled()` /
  `voiceConfig()`, gated on new env vars and reusing the **same Twilio account as
  SMS**. `voiceEnabled()` is false until `TWILIO_VOICE_CALLER_ID` +
  `TWILIO_TWIML_APP_SID` are set.
- New additive `CallRecording` table (`20261004130000_call_recording`) hanging off
  `Application`, so a recording lives **on the deal / customer profile**. Empty and
  unused until voice is switched on — safe to ship.
- A "Call recording" panel on the staff deal page shows the inactive state so the
  home is already there. Turn-on steps (webhooks, consent notice, player) are
  documented in `docs/VOICE.md` — a later, deliberate build.

### Booking-site lead push (2026-09-29)
- **Confirmed scanned leads now push to the booking system.** When a scanned
  lead card is saved (`createScannedLeadAction` in
  `src/app/(dealer)/dealer/leads/scanActions.ts`), the portal POSTs it to the
  booking app's `/api/intake/portal` endpoint so it lands on a booker's calling
  screen — no retyping between the two systems. Keyed by the scanned lead's id,
  so a re-save never double-creates the customer on the booking side.
- New `src/lib/bookingPush.ts` — fire-and-forget, fail-safe (a booking outage or
  slow response never blocks the portal save) and **inert until configured**.
- **To switch on:** set `BOOKING_INTAKE_URL` + `PORTAL_INTAKE_TOKEN` on Elastic
  Beanstalk, then redeploy. Until both are set it does nothing.

### French lead parsing — reference script synced (2026-09-07)
- **French Home Depot lead parsing (Québec/French leads).** The portal only
  *reads* the "HD Leads Log" Google Sheet; HD lead emails are parsed into it by
  Sean's **external Apps Script** (`scripts/hd-leads-automation.gs`, reference
  copy kept in sync). Updated to Sean's running version: the Gmail search matches
  the EN subject "New Home Services Customer Lead" OR the FR subject "Nouveau
  prospect pour les Services" (sender info@homedepot.ca), `parseLead()` is
  bilingual for every field (Identifiant du rendez-vous, Nom du service, Magasin,
  Renseignements sur votre client, Emplacement du projet, S'agit-il d'une
  urgence, Détails du service, Renseignements supplémentaires) with Emergency
  Non/Oui → No/Yes; French leads report `formatDetected = "Format C (French)"`.
- **Portal ↔ sheet contract verified (2026-09-07).** No portal code change was
  needed for the French parser: the reader (`src/lib/leads.ts`) maps columns by
  HEADER NAME, and the No-Good write-back (`src/lib/leadsWrite.ts`) targets fixed
  columns O/P/Q by position — both match the unchanged 18-column layout, so
  French leads flow through exactly like English ones. Same spreadsheet on both
  sides (`HD_LEADS_SHEET_ID` == the script's `LEADS_LOG_ID`). **To go live:** set
  the script's `TEST_MODE:false` so rows land in the "Leads Log" tab the portal
  reads (not "TEST - Leads Log"), keep the 18 headers unrenamed, and run
  `testSingleLead()` on a French lead first. Portal display auto-translates lead
  free-text via DeepL.

## 2026-10-06
- **HD Resolution ↔ Gmail email link (Phase 3b-2) — code shipped, inert until
  configured.** A case can follow its Home Depot email chain: **Link HD email**
  (searches the configured Gmail label for the case's HD Ref # / case number and
  attaches the thread), new replies **sync** in (a per-case *Sync now* button +
  a **30-min** GitHub Actions cron, `resolution-email-sync.yml`), and an **Email
  inbox** lists recent **HD Resolution**-labeled threads not yet linked ("Open as
  case" pre-links the thread). Reuses the **existing Google service account**,
  **read-only**, impersonating **one mailbox** and reading **one label** only
  (domain-wide delegation). New `gmailThreadId` on `ResolutionCase` + a
  `ResolutionEmail` table (additive migration), `src/lib/gmailResolution.ts` /
  `resolutionEmailSync.ts`, the cron endpoint, and the case/inbox UI.
  **⏳ Inert until set up** — see `docs/HD-RESOLUTION-EMAIL.md`: apply the Gmail
  **HD Resolution** label (+ a filter), a Workspace admin grants the service
  account the `gmail.readonly` scope (domain-wide delegation), and set
  `GMAIL_RESOLUTION_USER` (+ optional `GMAIL_RESOLUTION_LABEL`) on EB. **Not yet
  tested against a live mailbox** — verify together once configured.
- **Resolution case files & links (Phase 3b-1).** An HD resolution case can now
  hold its **own documents and resources**, not just the linked deal's. Staff can
  **upload files** (PDF / images — encrypted at rest, MIME-sniffed, 15 MB cap,
  served through an access-controlled, rate-limited, audited route) and **add
  resource links** (e.g. a resource-library manual URL), each removable. New
  `ResolutionAttachment` table (additive migration), `newResolutionStorageKey`,
  the `/api/resolutions/attachments/[id]` serve route, upload/link/delete actions,
  and the `CaseAttachments` component on the case detail page. *(Phase 3b-2, the
  Gmail email-thread link, is next — it needs the Workspace delegation + the
  "HD Resolution" label.)*
- **HD Resolution Centre (Phase 3 core).** A new **"HD Resolution"** area in the
  staff nav — a queue for Home Depot resolution-centre problems so they don't get
  lost. Visible to **all internal staff** (reviewers + admins). Each case:
  - links to a **customer** (and the deal when there is one) and the **owning
    office**, and shows up **on the customer's Find-customer page** (two-way), with
    an **"Open HD case"** button there to create one pre-linked;
  - moves through **Open → In progress → Waiting on office → Escalated to HD →
    Resolved**, plus **Closed**; status changes are logged to the activity thread;
  - **ages amber at 3 days / red at 7 days** (open cases only);
  - shows the linked deal's **documents & resources**, an **activity thread**
    (notes), **assign-to**, and a one-way **"Notify office"** (in-portal + email,
    reusing the proven note/notify path).
  New `ResolutionCase` + `ResolutionCaseNote` tables and `ResolutionStatus` enum
  (additive migration), `src/lib/resolutionCases.ts` / `resolutionStatus.ts`, the
  queue / new / `[id]` pages, and `CaseControls`. *Deferred to Phase 3b: direct
  file uploads to a case, resource-library links, and the Gmail email-thread link
  (needs a Google Workspace admin action).*
- **Call log forward-to-office (Phase 2).** Each logged call that hasn't been
  forwarded now has a **"↗ Forward to {office}"** button in the call history, so
  staff can hand a call to the owning office **after the fact** (Phase 1 only
  forwarded at log time). It reaches the office by in-portal notification **and
  email** (reuses `notifyNewNote`), stamps the call as forwarded (so the snapshot
  count updates), and is idempotent. Card-data-guarded. `forwardCustomerCallAction`.
- **Customer call log (Phase 1 of the calls/resolution build).** On the staff
  **Find customer** view, a new **📞 Call log** section: a **"Customer called"**
  button logs a short, **auto-dated** note, and a snapshot shows **how many times
  this customer has called** (counted across all their deals by normalized phone),
  **how many were forwarded to their office**, and the last call date. A checkbox
  lets you **also notify the office** in the same step — reusing the existing
  office-notify path (dealer-visible note + notification). New `CustomerCall`
  table (additive migration), `src/lib/customerCalls.ts`, `logCustomerCallAction`,
  and the `CustomerCallLog` component. Internal/admin only. *(Phase 2 = richer
  forward-to-office; Phase 3 = the HD Resolution Centre queue — see the design
  mockup.)*
- **Recorded two production-hardening reminders** (at Sean's request) at the top
  of `RELIABILITY.md`: (1) change AWS to production settings, and (2) enable RDS
  **Multi-AZ** failover on `gwa-portal-db`. Both are AWS console actions, no
  deadline set — tick them off in that doc when done.
- **Gift-card notes are now always viewable — including after a card is sent.**
  Before, staff could see a request's note thread only while it sat in the
  pending queue; once sent it dropped into History, which showed no notes. Now
  **every row in the gift-card History has a "💬 notes" button** that opens the
  full two-way thread (and lets staff reply) on any card, no matter how old.
  Two companion fixes so a dealer note on an **already-sent / old customer**
  surfaces for review and doesn't get lost: (1) the staff-unread flag is **no
  longer blanket-cleared on page load** — only pending cards clear; a note on a
  sent card stays in **"Needs attention"** (and shows a red "new" marker in
  History) until staff actually open its thread, reply, or hit the new **"Mark
  reviewed"** button; (2) a staff reply now also clears the flag. Dealers could
  already message/correct a sent card (`addGiftCardNoteAction` isn't gated by
  status) — this makes sure the team always sees it. (`HistoryNotesButton`,
  `markGiftCardReviewedAction`, `giftCardNotesVM`.) *Note: in-store lead-generator
  corrections that come through the booking site are a separate system; this
  covers the portal's gift-card note thread.*
- **Owner reports now available on the admin side (all admins).** The four
  owner-only tools that used to live only on the dealer side — **Sales forecast,
  Sales reps, Custom report builder, and Accounting export** — now have
  admin-side pages under **Staff → Reports**, each with an **office picker** (any
  office, or all offices where it makes sense). They reuse the exact same report
  components and data. Gated to admins (`isAdmin` + reports access). The
  accounting CSV endpoint was extended to let an internal admin export any office
  via `?dealerId=` (owners still export only their own). Cause: the owner reports
  were coded to a dealer-owner login (`canViewOwnerPricingReport`), so no
  internal/admin account — super admin included — could open them.
- **Store re-routing now moves already-scanned leads too.** When a Home Depot
  store is re-pointed to another dealer (Admin → Store routing: reassign, add
  mapping, or sheet-apply), the **leads already scanned** for that store number
  are reassigned to the new dealer, not just future scans and the live-attributed
  reports. Scanned leads snapshot their dealer at scan time, so without this they
  were left behind — the "all its leads moved with it" message is now actually
  true. Each move reports how many scanned leads were reassigned and is audited.
  (`moveScannedLeadsForStore` in admin actions.) This is what lets e.g. **all of
  store 7030's leads move to Swift** in one reassignment.
- **One-time UNITS back-fill tool (Admin → Overview).** A two-step maintenance
  button (`BackfillUnitsButton`) fills the journal **UNITS** column on existing
  rows the portal already placed, using each deal's product count (the same
  number the live writer now stamps). **Preview** is a dry run — it reads the
  sheet, matches portal deals to their recorded tab+row, and shows exactly what
  it would write without changing anything; **Apply** then writes. It only ever
  fills a **blank** UNITS cell and re-verifies the row's Last Name first, so it
  can never overwrite a value or land on the wrong customer. Rows the portal
  didn't write (pure manual entries with no matching deal) are left as-is.
  Admin-only; each apply is audited (`backfillJournalUnits` in `journal.ts`,
  `backfillJournalUnitsAction`).
- **Journal now seeds UNITS + Deal Result on write.** When the portal writes a
  deal to the sales journal it now fills two columns the office used to type by
  hand: **UNITS** (column P) = the number of products on the deal (e.g. a water
  softener + city-water deal writes `2`), and **Deal Result** (column Q) = the
  pending code **`PE/OK`**. Both match on the journal's two-row header
  (`FIELD_SPECS` in `journal.ts`), and like every other portal write they only
  fill a blank cell — a value the office already typed is never overwritten.
  `PE/OK` is deliberate: the paid-sync's "OK" test excludes `pe`, so the row
  still reads as *not yet paid* until the office changes it to `OK` + Date Paid.
- **Bolder, meaning-mapped status chips.** The old palette gave a near-unique
  colour to each of twelve statuses, mostly in the same blue-green zone, so a
  quick scan couldn't tell them apart. New shared `chipStyle.tsx` maps every
  status (and every reviewer-queue tone) to one of **seven meaning buckets** —
  urgent / new / on-your-desk / with-the-dealer / money-stage / done / closed —
  each a distinct, bolder hue. The reviewer-queue **action chip** is now a loud
  **solid tag with a meaning icon** (System A); **status badges** across the app
  (`StatusBadge`: dealer, staff, dashboard, search) are a **soft left-bar chip**
  (System B). Colour carries meaning, the label carries the exact stage, and an
  icon/shape keeps it readable for colour-blind viewers and in sunlight. (Chosen
  from the design mockup.)
- **Dealers can add a co-applicant to an existing deal (no re-submitting).** Co-
  applicant data was only capturable at new-deal creation, so a dealer who needed
  to add one had to start over as a new customer. New "Co-applicant" section on
  the dealer deal page: shows the one on file, or an **"Add a co-applicant"** form
  (same fields as the new-deal form; SIN/DOB/address/ID encrypted) available on
  any live deal that isn't funded/declined/withdrawn. Because a co-applicant
  changes the credit application, adding one on a post-decision deal sends it
  **back to "In review"** and alerts staff to **re-check credit** (new
  `notifyCoApplicantAdded` → email + push + feed). New `addCoApplicantAction`
  (upserts the loan record) + `addCoApplicantSchema`.
- **Notifications feed — a durable home for the alerts you get (bell + page).**
  Until now a phone/web push was fire-and-forget: once dismissed it was gone, with
  nowhere in the portal to look it up. Added a per-user `Notification` model
  written alongside every alert (`recordNotifications` in `notifications.ts`,
  called from `notify.ts`, `leadNotify.ts`, `sla.ts`), a **bell icon with an
  unread badge** in both the staff and dealer headers (dropdown grouped by
  customer, mark-one / mark-all read), a **full Notifications page**
  (`/staff/notifications`, `/dealer/notifications`), and a polled
  `/api/notifications` endpoint. Per-item read state (like a phone); bundled by
  customer so bursts collapse; respects the same category prefs as email; pruned
  to 60 days opportunistically so the table stays bounded. For everyone — staff
  and dealers. (Phase 2: fold a few email-only alerts in, and surface the feed
  inside the staff Catch-up page.)
- **Store routing is now editable in the portal (Admin → Dealers → Store
  routing).** The HD store → dealer mapping was hardcoded (seed-only) with no way
  to reassign a store; now there's a screen that lists every store grouped by the
  office it routes to, with a per-store "move to [office]" control (including a
  "＋ New office…" inline create), an "add a store" form, and activate/deactivate.
  Because lead attribution is computed live from this mapping, moving a store to a
  different dealer moves ALL of that store's leads — past and future — to the new
  office at once (no per-lead migration). New actions: `reassignStoreAction`,
  `addStoreMappingAction`, `setStoreActiveAction`.
- **Store routing — Google Sheet backup & reviewed two-way control.** On the Store
  routing screen: **"Back up to sheet"** writes the live mapping to a "Dealer ↔ HD
  Store Routing" sheet in Drive (one row per store: Store # · City · Office ·
  Active), and **"Pull from sheet (preview)"** reads sheet edits and shows every
  change — e.g. "Store 7030 (Newmarket): Georgian → Swift" — that you confirm
  before anything applies (portal stays the live master; removals deactivate,
  never hard-delete). New `storeRoutingSheet.ts` (service-account read/write, same
  as the journal) + pure, unit-tested `storeRoutingDiff.ts`. Setup: share the
  sheet with the service account and set `MAPPING_SHEET_ID` (same pattern as the
  journal sheets).
- **Root-cause fix: funding packages now submit themselves when complete.** Deals
  were stranding at "Documents sent" because the whole flow depended on the dealer
  remembering to press a separate "Submit funding package" button — upload
  everything and walk away (or miss the small "serial required" warning) and the
  deal silently stalled with nobody notified. Now, the moment every required
  funding document is uploaded AND all serials are entered, the deal advances to
  "Submitted to finance company" on its own (from the funding upload or the serial
  save). The manual Submit button stays as a fallback for sending a partial
  package early. New pure, unit-tested `fundingPackageReadyToSubmit`; the
  reviewer "why it's stuck" banner stays as the safety net for the rare deal that
  genuinely can't auto-submit (e.g. a serial still missing).
- **Gift-card queue: the "Notes" link now opens in view.** Clicking Notes on a
  card rendered the note thread at the very bottom of the page, so on a long queue
  it looked like nothing happened. It now opens as a centered overlay wherever you
  click. Fixes both the staff and admin gift-card pages.
- **Reviewer now sees WHY a deal is stuck before funding — no more mystery.** When
  a `DOCS_SENT` deal has its signed package back but hasn't moved on, the deal
  shows an amber banner explaining exactly why, mirroring the dealer-side submit
  gate: either a **serial number is missing** for a product (which silently
  blocks the dealer's "Submit funding package" when their finance company
  requires one per product — it names the product), or the dealer **uploaded the
  docs but never pressed Submit** (with a one-click "Move to In for funding"). New
  pure `diagnoseFundingSubmit` helper (`fundingSubmitStatus.ts`), unit-tested.
  Also broadened `advanceDealToInForFundingAction` to accept `DOCS_SENT` so the
  banner's button works. Follow-up worth doing: make the dealer's Submit button
  say what's missing instead of silently bouncing.
- **Fixed deals stranding at "Review signed documents" with no way to advance.**
  A deal whose signed funding package came back while it was still `DOCS_SENT`
  (uploaded to the wrong box, or added by staff — so the status never flipped to
  `FUNDING_SUBMITTED`) reached the "Review signed documents" step and could have
  every document + funding check confirmed, yet showed **no "Move to In for
  funding" button** — because that button (and `moveToInForFundingAction`) only
  accepted `FUNDING_SUBMITTED`. The deal sat there with nothing to click.
  Fix: the "Move to In for funding" button now also shows for a `DOCS_SENT` deal,
  and the action accepts it (same guard — every uploaded funding document must be
  confirmed first). Immediate workaround for any already-stuck deal: the manual
  **Change status** control on the deal moves it to In for funding (or Funded).

## 2026-10-05
- **Find Customer bug fixed — stop showing the wrong person's phone/email for a
  journal row.** Find Customer showed the same customer with a different phone,
  address, and even email on each search (e.g. a Riaz deal surfacing
  mehrdad.smn@gmail.com). Root cause in `customerSearch.ts`: a journal row is
  linked to its portal deal by the stored tab+row, but that pointer isn't unique
  (a duplicate deal, or a pointer the journal self-heal moved, can land two deals
  on one row). The link (a) did no name check — so a mis-pointed deal attached
  ITS email + contact-override to the row — and (b) used an unordered query with
  a last-wins Map, so a *different* wrong deal could win each request (hence
  "different number every time"). Fix: new pure `customerSearchLink.ts`
  (`pickLinkedApp`/`normLastName`, unit-tested) links a journal row only to a
  deal whose **last name matches** the row, and picks **deterministically**
  (newest first) among duplicates. A row with no matching portal deal now shows
  the journal's own contact info and nothing borrowed. Does not touch journal
  data; if a customer genuinely has duplicate journal rows, those still need
  cleaning in the sheet.
- **Remittance reconciliation — recover missed Home Depot payments.** A
  remittance line is matched to a deal by HD # at the moment it's ingested; if
  the deal wasn't in the portal yet (entered later, or its HD # filled in
  afterwards), the line stayed UNMATCHED forever — the HD money came in but never
  advanced the deal. Added `reMatchUnmatchedLines()` (`src/lib/hdRemittance.ts`),
  which re-runs the HD-# match for every stored unmatched, non-chargeback line
  against the deals in the portal *now*, funds any that have since appeared
  (reusing the split-payment cumulative rule so a split deal only funds once its
  total HD payout is reached), and records a status event + audit entry. The
  staff **Remittances** page now has an "Unmatched lines — reconciliation"
  section: it shows the total unmatched $ outstanding, a **dry-run preview** of
  exactly which unmatched lines would now match a deal (and which would fund),
  and a **"Re-check unmatched against current deals"** button to apply it.
  Idempotent (recovered lines become MATCHED and aren't re-examined); chargebacks
  are left alone. This closes the gap behind "some deals match and some don't" —
  the misses were payments that arrived before their portal deal existed.

## 2026-10-04
- **Reliability hardening so the 2026-10-02 outage can't repeat.** Root cause: a
  single small EB instance filled its disk from piled-up Docker images across a
  day of deploys and wedged, with no auto-healing, and a manual Rebuild then
  broke on the DB security-group dependency. Version-controlled fixes (apply on
  next deploy): **Immutable deploy policy** (a bad build auto-rolls-back with the
  old instance still serving; fresh disk every deploy) + **app-aware health check
  at `/api/health`** + **EB health-change email alert** to sean@ghsbarrie.ca +
  **disk-cleanup postdeploy hook**, all in `.ebextensions/01_resilience.config`
  and `.platform/hooks/postdeploy/01_docker_prune.sh`; the deploy workflow now
  **waits for a healthy deploy** (`wait_for_deployment: true`) so a bad one fails
  loudly. New **`docs/RELIABILITY.md`** (postmortem + the console checklist still
  to do: confirm the SNS email, bump to t3.medium / 50 GB disk, verify RDS
  backups, add an external uptime monitor on `/api/health`). ⚠ After the first
  deploy with this, click the AWS "Confirm subscription" email or alerts won't
  arrive.
- **Dealer Mail: confirmation-issue messages now show the FULL customer name + an "Open deal" button.**
  When a confirmer flags an issue to the dealer, the portal Mail used to read
  "Action needed: confirmation issue — Sean K." (first name + last initial), with
  no way to tell which customer or to jump to the deal. Now: the subject carries
  the **full customer name** (the deal is the dealer's own customer, so no masking
  is needed), and the dealer's Mail view shows a prominent **"Open {name}'s deal"**
  button that deep-links to that exact customer's deal — mirroring the reviewer
  chat side. Added an optional `Mail.applicationId` link (migration
  `20261004120000_mail_application_link`, `ON DELETE SET NULL`); the flag-issue
  action sets it; the dealer mail page renders the button, guarded so a mail can
  only ever link to a deal belonging to the viewing dealer. New i18n keys
  (`mail.openCustomerDeal`, `mail.openDeal`). (`src/app/(staff)/actions.ts`,
  `src/app/(dealer)/dealer/mail/[id]/page.tsx`, `prisma/schema.prisma`.)

## 2026-10-02
- **Journal Test/Live write-mode toggle actually takes effect now.**
  The admin Test/Live toggle (`/staff/reports/connection`) could "save" but not
  change where deals wrote — the button showed one mode while the status line
  showed the other. Cause: `getJournalWriteMode()` read from the shared
  module-level settings cache, and in production Next.js serves renders/actions
  from separate worker processes that each hold their own cache, so flipping the
  toggle only cleared the cache in one worker. Fixes: (1) `getJournalWriteMode()`
  now reads straight from the DB (never the per-worker cache), so the toggle takes
  effect everywhere immediately; (2) the toggle button syncs to the saved server
  mode after each refresh, so it can never show a mode that isn't actually live.
  (`src/lib/settings.ts`; `WriteModeToggle.tsx`.)
- **Journal row-selection: judge "free line" by the DEAL columns only (fixes deals landing below the totals in the live journal).**
  Confirmed with Sean and by reading the live sheet: the live journal has **formula
  columns** (Net / TAX / Balance, the product-code legend, the Province/Tax-rate
  helper, status columns) that render a value — `$0.00`, `-`, `AB`, a formula
  result — on **every** row, including the blank pre-numbered lines. The earlier
  `$0.00`-only fix wasn't enough because the values weren't all zeros. Row-selection
  now decides whether a pre-numbered line is free by looking **only at the deal
  columns** (`DEAL_OCCUPANCY_KEYS`: Last Name, First Name, HD Ref #, Loan #, Cash
  amount, Financed amount) and **ignores every other column**. A deal or totals row
  fills a name/amount so it's still never landed on; a blank line has all deal
  columns empty regardless of its formulas, so new deals land on the first blank
  numbered line above the totals. (The test journal has no such formulas, which is
  why it always worked there.) `src/lib/journal.ts` (`rowHasDeal`, `lastContentRow`,
  `planRow`); `tests/journal.test.ts` rewritten to model the real sheet.
- **Upload-package ZIP: dealer's FINAL copies only + HD waiver naming convention.**
  Two fixes to the "Download upload package (ZIP)" on the staff deal page
  (`src/app/api/applications/[id]/upload-package/route.ts`):
  1. **Dealer finals only.** The ZIP included both FUNDING-stage docs (the dealer's
     returned signed copies) *and* REVIEWER-stage docs (the blank paperwork/agreements
     GWA staff upload *for* the dealer to complete). It now includes **FUNDING stage
     only** — the dealer's final copies — so the staff templates no longer double up
     the package. (APPLICATION-stage intake was already excluded.)
  2. **HD waiver filename.** The HD waiver now downloads named to Home Depot's
     required convention: **`#WAIVER#<HD Ref #>`** (the literal `#WAIVER#` tag then
     the 800-series HD reference, no brackets, e.g. `#WAIVER#800255027.pdf`), instead
     of the generic "Lastname_Firstname - Home Depot waiver". Falls back to the
     generic name if a deal has no HD reference.
- **Journal next-blank-line fix: ignore formula zeros so deals stop landing below the totals row (live journal).**
  Root cause of the "writes below the totals row" bug — found after the re-place
  button still landed deals on row 237. The **live** journal's pre-numbered blank
  rows carry **formula columns** (Net / TAX / Balance / Pay-to-dealer …) that render
  **`$0.00` / `-`** on every row, and the row-selection code counted any non-empty
  cell as "occupied" — so it thought *every* line was taken and appended each deal
  below the month's totals. (The **test** journal has genuinely empty blank rows,
  which is why it always worked there.) Fix: "is this row a free slot?" now treats
  `$0.00` / `0` / `-` / blank as empty (`isBlankish`), while real text (notes rows)
  and non-zero dollar sums (totals rows) still count as occupied and are never
  landed on. New regression test covers the formula-zero case.
  (`src/lib/journal.ts`; `tests/journal.test.ts`.)
- **Journal "Move to the correct line" — re-place a deal the old writer stranded below the totals row.**
  Deals written *before* the next-blank-line fix went live were appended below the
  month's totals row, and the portal **remembers** that spot — so pressing "Update
  journal" re-writes the deal in place (by design, to avoid duplicates), keeping it
  stuck there (e.g. the "Deleon" deal at October row 237). Added a one-click **Move
  to the correct line** control on the staff deal page: it clears that deal's old
  (misplaced) row in the sheet — guarded by a last-name match so it never wipes the
  wrong customer — forgets the stored position, then re-writes the deal, which lands
  it on the next blank numbered line (above the totals). Brand-new deals already
  place correctly; this is the cure for the handful of old stragglers.
  (`src/lib/journal.ts` `clearJournalRow`; `replaceJournalRowAction` in staff
  `actions.ts`; `WriteToJournalButton.tsx`.)
- **Gift-card bulk import: accept Excel (.xlsx) + drag-and-drop + catch wrong columns.**
  The "Add several at once (spreadsheet)" uploader only accepted `.csv`, so a sheet
  filled in Excel and saved as `.xlsx` was silently rejected. It now parses `.xlsx`
  too (client-side via JSZip, lazy-loaded; reuses the VOC-import approach) and is a
  proper **drag-and-drop** zone (still click-to-choose). Added a guard that flags a
  **numeric "Customer name"** (e.g. a store number pasted into the name column) in
  the preview, plus clear "unsupported file" / "couldn't read" messages.
  (`GiftCardBulkImport.tsx`; new i18n keys.)
- **Texting went live + Google credential moved to SSM (infra, Sean + Claude).**
  Twilio keys added on EB so SMS is connected (see the Operational status table).
  Adding them hit EB's **4 KB plain-text env limit**, so the ~2 KB
  `GOOGLE_SERVICE_ACCOUNT_JSON` was moved to **SSM Parameter Store** (SecureString
  `/gwa-portal/GOOGLE_SERVICE_ACCOUNT_JSON`; EB row Source = "Parameter Store";
  read via `aws-elasticbeanstalk-ec2-role` + inline policy `gwa-ssm-google-sa`).
  Permanent headroom; nothing deleted. **Still pending (Sean): Twilio carrier
  registration (toll-free / A2P 10DLC) for reliable Canadian delivery.**
- **Docs refreshed to current reality.** `BUILD-FACTS.md` (hosting = AWS EB not
  Render; env vars on EB; SSM for big secrets; Twilio; journal write behavior),
  the CHANGELOG **Operational status** table (journal on EB + SSM, new Texting/SMS
  row, Render→EB wording), and `OPEN-QUESTIONS.md` (SMS done; near-term loose ends).
- **Review card: change/add the customer phone inline (like email).** The review-request
  card now has a **"change" / "add number"** link next to "Also text …", so staff can fix
  a wrong or incomplete number (e.g. a truncated one) or add a missing one without leaving
  the deal. Validated as a real number and stored tidily (XXX-XXX-XXXX); the "Also text"
  box stays disabled until a valid number is on file. (`setCustomerPhoneAction`;
  `ReviewRequestCard`.)
- **Admin: Twilio cost meter.** New "Texting spend" panel on Admin → Email showing SMS
  spend **this month** and **today** (with text counts) plus the account **balance**,
  pulled live from Twilio's usage API using the existing credentials (read-only, with a
  Refresh button). Figures use whatever currency the Twilio account reports.
  (`lib/twilioUsage.ts` + `parseUsageRecord` tests, `getTwilioUsageAction`, `TwilioUsageCard`.)
- **Journal (live): duplicate guard — never duplicate or overwrite a manually-entered deal.**
  Live writes now recognise a deal that is already on the sheet (e.g. a staff member
  typed it in) by its unique reference number (HD Ref # / Loan #): instead of appending
  a second row, it reuses that row and **fills only the blank cells** — never overwriting
  what a human entered. If the same reference number is on a row under a different name,
  or on several rows, it's flagged as a **conflict** and nothing is written, so a human
  reconciles it (no corruption, no duplicate). The "Write to Journal" button now reports
  exactly what happened ("Added…", "Updated…", "Already on … filled N blanks, left M as
  entered", or the conflict). (`planRow` + fill-blanks/conflict handling in
  `lib/journal.ts`; `syncApplicationToJournal`/`writeToJournalAction` surface it; new
  unit tests for match/conflict/multi-row.)
- **Admin: Texting (SMS) status + send-a-test-text.** New card on Admin → Email with a
  Connected/Not-set-up badge and a "Send test text" button (mirrors the email test), plus
  in-page instructions for the Twilio env vars. (`sendTestSmsAction`, `TestSmsForm`.)
- **Journal (live): write to the next available line, not below the totals row.** A
  live-journal write chose its row by appending below *all* content (added Sep 19 to
  stop deals clobbering human notes rows). Side effect: because a month tab has a
  **totals row** partway down, new deals landed *beneath* it instead of filling the
  pre-numbered blank lines — so deals ended up split between the top and the very
  bottom of the sheet. Fix: in live mode, write to the **first truly-empty line**
  (every cell blank except the pre-printed "No."), scanning top-down. This fills the
  blank numbered rows that sit above a totals row, while still never landing on a
  deal, a notes row, or a totals/subtotal row (any of which has content) — so the
  Sep 19 notes-row protection is preserved. Falls back to append-below when there's no
  empty slot. (`chooseRow` live branch in `lib/journal.ts`; 2 new unit tests for the
  totals-row cases.) NOTE: this fixes future writes; deals already written below the
  totals row in a month tab are a one-time manual cleanup in the sheet.

## 2026-10-01
- **Email manuals/brochures of any size: big files now go as secure 30-day download
  links instead of erroring.** The "Email a brochure/manual" sender used to hard-stop
  with "over 20 MB — too large to email." Now it attaches what fits (≤20 MB keeps the
  message deliverable) and sends anything larger as a secure, expiring download link in
  the same email — so large Aerus manuals actually reach the customer. Links are
  tamper-proof, time-limited tokens (encrypted with the app key, no new table/secret),
  served by a new public route `GET /d/[token]`; expired/altered links show a friendly
  "invalid or expired" message. New `lib/docLink.ts` (+ tests), `app/d/[token]/route.ts`;
  `buildDocsEmail` now renders an attached list and/or download buttons;
  `emailDocumentsToCustomerAction` splits files into attach-vs-link.
- **Flagged issues show at a glance in the dealer's deal lists + a more urgent email.**
  Any deal with an unacknowledged confirmation issue now carries a red
  "Issue — acknowledge" flag in the dealer dashboard's Recent Applications and in the
  full Applications workspace (all views), with a red row accent — so the office sees
  it without opening each deal. The flag clears automatically once someone at the
  office acknowledges. The email notification is now visibly urgent: "⚠ ACTION
  REQUIRED" subject + heading, a red alert box, and an "Open & acknowledge now" button
  (push notification likewise). ("Unacknowledged" is computed from the issue mail's
  receipts in one batch query per list.) Files: `RecentApplications.tsx`,
  `ApplicationsWorkspace.tsx`, dealer `page.tsx` + `applications/page.tsx`,
  `notifyConfirmationIssue` (`lib/notify.ts`); new i18n key `dashboard.issueFlagged`.
- **Flag-an-issue, upgraded: portal Mail with required acknowledgement, a top-of-deal
  banner, and an email alert.** Flagging an issue now (1) posts to the deal chat as
  before, (2) sends the office a real portal **Mail** with `requireAck: true` — it
  lands in `/dealer/mail` with the "Ack required" badge and forces the "I have read
  this" button; staff can see who acknowledged at `/staff/mail/<id>`, (3) shows a
  prominent **banner at the top of the deal** (both staff + dealer pages, styled like
  "what's needed from the dealer") that's red while awaiting acknowledgement and turns
  green once the office confirms, and (4) emails + push-notifies **every active user at
  the office** (action-required, so it overrides the routine "new notes" preference).
  The mail's id is stored on the deal (`Application.confirmationIssueMailId`, new
  nullable column — migration `20261001130000_confirmation_issue_mail`) so the banner
  can show the live ack state. New: `notifyConfirmationIssue` (`lib/notify.ts`),
  `lib/confirmationIssue.ts`, `components/ConfirmationIssueBanner.tsx`; rewired
  `flagDealerIssueAction`. Fixes the earlier report that a flagged issue "vanished" and
  sent no reliable mail (the old dealer-facing Note wasn't rendered on the staff page).
- **Review email now lists multiple products naturally.** "A and B" for two,
  "A, B, and C" for three+ (Oxford comma), using the full product names off the deal
  (never the journal abbreviations). (`buildReviewEmail` now takes a `string[]`.)
- **Confirmation step: "⚠ Flag an issue to the dealer" button.** Under the review
  button on a deal's Confirmation section. When a confirmer finds the customer has
  a question/concern on the call, it expands to a message box; sending posts a
  dealer-visible note on the deal (so it lives in the portal, on the customer's
  file), marks the confirmation as an ISSUE, and emails + push-notifies the office's
  users via the normal note plumbing. The dealer sees it on their copy of the deal
  and replies there, which notifies staff back — so the whole exchange is tracked
  in the portal. Reuses the existing Note / ConversationThread / notifyNewNote
  system (no new tables). (`flagDealerIssueAction` in `(staff)/actions.ts`;
  `FlagDealerIssueCard.tsx`; card added under the review card in the deal page.)
- **HD Leads: new "All leads" view — scanned + parsed together in one list.** For
  booking, staff wanted every lead for a store in one place instead of the two
  separate sections (scanned "HD Mail In Test" cards + the HD Leads Log). Added a
  fourth view option (List / Grouped / Map / **All leads**) that merges both
  sources into one searchable list, each row tagged **"Mail in"** (scanned) or
  **"Store"** (HD Log). Reuses each source's native row (`ScannedLeadRowItem` /
  `StoreLeadRow`), so call-logging / booking still work; client-side search,
  source filter (All / Mail in / Store), status filter, and sort (newest / oldest /
  name / by store). Respects the office filter. (`CombinedLeadsView.tsx`; view
  wiring in `(staff)/staff/leads/page.tsx`; "All leads" added to the LeadsView
  toggle.)
- **Gift-card queue: pending cards grouped by office, then by day uploaded.** When
  staff pay out water-test gift cards they send them office by office, but the
  pending list was one flat table mixing offices/days, so a batch could be "one or
  two from one location, then one from another." Now the pending queue renders a
  section per **office** (alphabetical), each split into **day-uploaded** sub-groups,
  with a per-office **"Select only this office"** button and an office/day select-all
  — so Copy emails / Copy CSV / Mark sent act on exactly that office's batch. The
  existing location filter is kept (relabelled "Location"). (`GiftCardQueue.tsx`;
  `giftCardQueueData.ts` now returns the raw request date for day-grouping.)
  Note: the History search already matches office name, so "search by location"
  works there by typing the office.
- **Reviewers can now see the HD Leads tab (all offices).** The Leads tab was
  admin-only (super admin or the `leads` admin section), and reviewers never hold
  admin sections — so a reviewer couldn't open it at all. Now *viewing* leads is
  open to every reviewer (plus leads-section admins / super admins), same model as
  the Deals and Mail tabs — so anyone handling a customer call (e.g. Alyssa) can
  search all offices to confirm whether a store received a lead. *Managing* leads —
  the bulk "Fill postal codes" and "Send existing scans to booking" tools, which
  write to the DB / push to the external booking feed — stays restricted to
  leads-section admins and is hidden from reviewers (the action guards are
  unchanged, defense-in-depth). (nav in `(staff)/layout.tsx`; page gate + button
  visibility in `(staff)/staff/leads/page.tsx`.)
- **Staff HD Leads: selecting an office now scopes the scanned-cards section too.**
  On `/staff/leads`, picking an office correctly filtered the parsed HD Leads Log
  list, but the scanned-cards ("HD Mail In Test") section always showed every
  office's cards — so an admin "viewing as" an office saw all scanned leads mixed
  in. Now the scanned section is scoped to the selected office's `dealerId` (none
  selected = all offices, unchanged), matching exactly what that office's own users
  see (`listScannedLeads` filters a dealer to their own `dealerId`). The office
  column is hidden when a single office is selected. (`(staff)/staff/leads/page.tsx`.)
- **Customer review request from the confirmation step.** New "Ask the customer
  for a review" card in the deal's Confirmation section: one click emails the
  customer a friendly, on-brand (greyscale + logo, "Georgian Water & Air") email
  with a big "Leave a quick review" button linking to a configurable review link
  (e.g. a Google-review landing page). Supporting pieces:
  - **Inline "add customer email"** right on the card — deals often have no email
    on file, so staff can add/correct `applicantEmail` without leaving the page.
  - **Review link is an admin setting** (`review.link`, set inline by an admin the
    first time; feature stays dormant until set).
  - **Texting is scaffolded, not yet live.** The portal had no SMS provider, so a
    new `src/lib/sms.ts` (Twilio via REST, inert until `TWILIO_ACCOUNT_SID` /
    `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` are set) is ready to flip on. The
    "Also text …" option shows but is disabled with "texting not set up yet" until
    a provider is configured. SMS copy drafted (short, link, STOP opt-out).
  - **Records the last send** on the deal (`reviewRequestSentAt` / `Via` / `ByName`,
    new nullable columns — migration `20261001120000_review_request`) so staff see
    it went out and can resend.
  - New files: `src/lib/reviewRequest.ts` (email + SMS content), `src/lib/sms.ts`,
    `ReviewRequestCard.tsx`; actions `sendReviewRequestAction` /
    `setCustomerEmailAction` / `setReviewLinkAction` in `(staff)/actions.ts`.
  - **Still TODO (external):** an SMS provider to enable texting (Twilio etc. —
    account, a Canadian number, A2P/toll-free registration), and the actual review
    link to paste into the setting.

## 2026-09-30
- **Reviewer flow: "Sent — awaiting install" (step 3) no longer looks like a
  duplicate of "Produce install documents" (step 2).** Both steps rendered the
  full four-box paperwork uploader + the sent-docs list, so once a deal was past
  them they read as identical carbon copies (a reviewer flagged the confusion).
  Step 3 is really a *waiting* step, so it now leads with the "Mark my paperwork
  complete" button, the waiting note, and what's already been sent — and tucks the
  uploader behind a collapsed **"＋ Send more paperwork"** disclosure (native
  `<details>`, closed by default). Reviewers can still send additional documents;
  it just no longer mirrors step 2. Step 2 is unchanged. (Behaviour/flow logic in
  `reviewerFlow.ts` untouched — display only, in the staff deal page.)
- **"Fill missing postal codes" now shows *why* a lookup failed.** When every lead
  came back "couldn't be looked up," the tool gave no reason — it collapsed every
  Google error into one blank message. Now the first failure's Google status +
  message is carried back and shown as a plain-English cause + fix (e.g.
  REQUEST_DENIED → "the Geocoding API isn't enabled on the key's project, or the
  key's API restrictions don't include Geocoding — enable it and rerun"). This is a
  diagnostics fix: an all-rows failure is a Google Cloud **config** issue (Geocoding
  API not enabled / key restriction / billing), not a portal bug — the message now
  points straight at it. (`googlePlaces.ts` carries status+error_message on throw;
  `postalFill.ts` adds `failReason`; `PostalFillButton.tsx` explains it. Also dropped
  the misleading "— run it again" from the failure count.)
- **"Download upload package (ZIP)" button on the reviewer deal page.** A second
  download button (next to "Download all documents") that grabs only the docs a
  reviewer sends OUT to the funder / Home Depot — the FUNDING-stage signed package
  (signed contract, HD document, HD waiver, void cheque/PAP, install photos) and
  the REVIEWER-stage paperwork (HD agreements, certificate of completion/COC,
  financing paperwork) — as one flat ZIP, cleanly named
  `Lastname_Firstname - <doc type>.pdf`. APPLICATION-stage intake is excluded (it's
  internal, not uploaded to the funder). This is the *general* (un-curated) version;
  the *curated* per-funder subset (e.g. HD+Enercare → Enercare application +
  certificate of completion + HD contract + HD waiver, others adding install pics
  etc.) will layer on once those per-funder parameters are set. Reviewer/admin only,
  audit-logged (`DOC_DOWNLOAD`), memory-bounded (200 MB / 200 files), blob download
  so it works in the installed PWA. (`src/app/api/applications/[id]/upload-package/route.ts`,
  button in the staff deal page.)
- **"Download all documents (ZIP)" now works in the installed PWA.** It was a plain
  `<a href>` that dead-ended the reviewer on the archive inside the standalone app;
  swapped for the blob `DownloadButton`. (Endpoint unchanged.)
- **Document preview fix: multi-page PDFs now render instead of "Couldn't render
  a preview."** The in-app viewer (reviewer *and* dealer side) rasterizes a whole
  PDF into one tall scrollable image. That image was encoded as **WebP**, which
  has a hard **16,383px** dimension ceiling — so any PDF past ~11 letter pages
  produced an image too tall to encode, the render threw, and the viewer showed
  "Couldn't render a preview" (with only open-in-new-tab / download as fallback).
  Short docs worked, long ones never did — which is why "some documents load and
  some don't." Switched the stacked render to **JPEG** (65,535px ceiling) and
  added a running-height guard (`SAFE_MAX_H = 60,000px`) so even legal-size or
  very dense PDFs stay under the ceiling (overflow pages fall back to download).
  Verified: 3/12/26/40-page letter PDFs all render as valid JPEG; 40-page legal
  capped safely at 58,418px. (`src/lib/pdfThumb.ts`; Content-Type set to
  `image/jpeg` on all four `/pages` routes — deal documents, resource files, mail
  attachments, content library. First-page thumbnails stay WebP — they never
  approach the limit.)

## 2026-09-29
- **Out-of-band detection fix: "install docs sent" now means the deal reached
  DOCS_SENT, not merely that reviewer docs exist.** A reviewer can *produce* the
  install documents and hand them over another way (email) without the deal ever
  being *sent* in the portal — status stays Approved. The previous check treated
  any reviewer-stage doc as "sent," which wrongly excluded exactly those deals
  (e.g. Darcy Culshaw) from the out-of-band banner and the Funding queue. Now only
  the status history (ever reached DOCS_SENT/FUNDING_*/FUNDED) decides it.
  (`outOfBandReturn.ts` — `installDocsEverSent`/`isOutOfBandReturn` no longer take a
  reviewer-doc count; callers in staff/dealer updated.)
- **Out-of-band (stuck-at-Approved) deals can now be moved to funding.** These
  weren't in the admin Funding queue (which only listed *In-for-funding submitted*)
  and had no move button, so a deal like an emailed-docs return sat at Approved with
  nowhere to go. Now: (1) the admin **Funding queue** includes out-of-band
  Approved/Conditional deals (tagged "Approved · out-of-band"), (2) the one-click
  bulk advance moves them too when their docs are confirmed, and (3) the red banner
  on the deal has a **"Move to In for funding"** button (enabled once the uploaded
  docs are confirmed). All still cap at In for funding — never Funded — and log each
  move. (`(staff)/actions.ts` `advanceDealToInForFundingAction` + shared candidate
  loader, `AdvanceToFundingButton.tsx`, staff `page.tsx`, admin `page.tsx`.)
- **Out-of-band banner/alert false positive fixed.** The "dealer sent paperwork
  before install docs were sent" banner (and its reviewer email) fired on any
  Approved/Conditional deal that had a package-return doc — even ones whose install
  documents *were* sent through the portal and were simply moved back to
  Approved/Conditional. It now only fires when install docs were **never** sent:
  no reviewer-stage (install) documents AND the deal never reached DOCS_SENT or
  beyond. Logic extracted to `lib/outOfBandReturn.ts` (`isOutOfBandReturn` /
  `installDocsEverSent`) with unit tests; wired into the staff deal banner and the
  dealer upload notification. (`outOfBandReturn.ts`, staff `page.tsx`,
  `(dealer)/actions.ts`.)
- **Admin "Funding queue" — list of stuck deals + one-click bulk advance.** The
  admin overview now lists every deal sitting at *In-for-funding submitted* (oldest
  first, each linking to the deal) with why it's stuck — green = ready, amber = N
  docs to confirm, red = no docs. An **"Advance N ready deals → In for funding"**
  button moves, in one click, every deal whose uploaded docs are already confirmed
  (the move a reviewer would make by hand) to FUNDING_REVIEW. It never marks
  anything Funded (that stays with the reviewer / journal), touches only
  docs-confirmed deals, and logs each move (status history + audit); dealer
  notifications are skipped so a backlog sweep doesn't flood them. Guard:
  `requireAdminSection('overview')`. (`(staff)/actions.ts` `listStuckFundingDeals` /
  `advanceReadyFundingDealsAction`, `(admin)/admin/AdvanceReadyDealsButton.tsx`,
  admin `page.tsx`.)
- **Reviewers are now alerted when signed paperwork comes back out-of-band.** If a
  dealer uploads a signed-package document (signed contract / HD docs / HD waiver /
  install photo) while the deal is still **Approved/Conditional** — i.e. its install
  documents were never sent through the portal (handled another way, e.g. emailed
  because the dealer couldn't log in) — reviewers now get an email + push
  ("paperwork uploaded before install docs were sent"), and the reviewer deal page
  shows a red banner so the deal doesn't sit stuck. Fires once per deal, and only
  for real package-return docs — an early void cheque / "other" file stays benign.
  (`notify.ts` `notifyFundingDocsBeforeSend`, `(dealer)/actions.ts` upload actions,
  `constants.ts` `PACKAGE_RETURN_FUNDING_TYPES`, staff deal `page.tsx` banner.)
- **Deals no longer get stranded before "In for funding" (reviewer funding gate).**
  The "Move to In for funding" button was gated on every *required document type*
  having a confirmed file — so a doc filed under the wrong category (e.g. an
  install photo dropped into "Other supporting documents"), or a required type not
  uploaded, silently disabled the move even though "All uploaded documents
  confirmed" and "this deal can be funded" both showed green. That's why some deals
  moved and some didn't. Now the reviewer is the gate: once **every uploaded
  funding document is confirmed** (and at least one exists), the deal can move; the
  required-type list stays as guidance (red = missing) but no longer hard-blocks.
  Changed on the client and server together. (`FundingChecklist.tsx`,
  `moveToInForFundingAction`, en/fr `fundingChecklist.confirmAllFirst`.)
- **Void cheques / PAP forms are no longer wrongly blocked as "credit cards."** The
  upload card-scanner OCRs each file; a void cheque's transit + institution +
  account numbers can run together into a Luhn-valid 13–19 digit string sitting
  next to the words "Account Number", which the scanner treated as card context and
  hard-blocked. Fix: when a document clearly reads as banking (VOID / void cheque /
  pre-authorized / PAP / transit / institution / routing) **and** carries no
  payment-card signal (brand word, CVV, expiry, credit limit, cardholder, "card
  number"), a bare Luhn number in "account number" context no longer blocks it.
  Real cards still block — a brand BIN, the known HD / FinanceIT prefixes, or any
  card signal all still trip it (proven by tests). (`lib/cardscan.ts`,
  `tests/cardscan.test.ts`.)

## 2026-09-20
- **E-Transfer is now treated as an already-paid method, not financing.** It was
  missing from `NON_FINANCE_PAYMENT_METHODS`, so e-transfer deals were asked for a
  financing deal number and the signed finance package like a financed deal. It's
  now aligned with its `financed: false` split-payment marker: no financing number,
  no finance-doc requirement. (`constants.ts`.)
- **Total Value (this month) now also excludes declined & draft deals.** Extends
  the earlier withdrawn-exclusion: the tile counts only deals that could carry
  value. `NO_VALUE` is now WITHDRAWN + DECLINED + DRAFT. (`(dealer)/dealer/page.tsx`.)
- **Maintenance "be right back" page redesigned — modern, not an old error screen.**
  Dark ambient background with a frosted-glass card, a slow greyscale aurora, fine
  grain texture, and a shimmer progress bar; still greyscale + the logo as the only
  colour (brand kit), self-contained, safe-area aware, auto-refreshing.
  (`public/maintenance.html`.) Activation is still a CloudFront change (S3 error
  origin + custom error responses) — steps documented, not yet wired.
- **Document viewer: the Close button no longer hides behind the iPhone notch (was
  "stuck with no way to close").** In the installed PWA the full-screen document
  viewer's header sat under the iOS status bar / notch, so on a reviewer's phone
  there was no reachable way to close a file. The header now pads past the notch
  with `env(safe-area-inset-*)`, and the control is a clear "✕ Close". Affects the
  in-app viewer everywhere (reviewer deal docs, dealer docs, paperwork).
  (`DocViewer.tsx`, en/fr `docViewer.close`.)
- **Dealer home "Total Value (this month)" no longer counts withdrawn deals.** The
  headline value tile summed every application created this month regardless of
  status, so a withdrawn deal still inflated the figure. Withdrawn deals are now
  excluded (`NO_VALUE` set). Declined/draft deals still count for now — say the
  word and those can be excluded too. (`(dealer)/dealer/page.tsx`.)

## 2026-09-19
- **Deal submit & cancellation are much faster — staff notifications no longer
  block the dealer.** A dealer submitting a deal or requesting a cancellation was
  made to wait while the server emailed **every** reviewer/admin one-by-one (plus a
  push) — several seconds of external calls before the page moved. Those sends now
  run in the **background** (new `notifyInBackground`; safe because we run on a
  persistent Elastic Beanstalk server, so the process finishes them after the
  response). The dealer's request is still saved durably first; only the
  notifications are deferred. (`lib/notify.ts`, `(dealer)/actions.ts` —
  `requestCancellationAction`, `createApplicationAction`, doc-upload paths.)
- **New deal: a rejected submit is now obvious (was "nothing happens").** When the
  server rejected a submit (a field it didn't like), the button showed "working…"
  for ~1s then reverted to normal with the error summary up at the top of the form
  — off-screen for a dealer looking at the Submit button, so it read as "the tap
  did nothing" and cost time on all three flows. Added a plain-language red note
  **right at the Submit button** ("Not submitted — please fix the highlighted items
  above, then submit again") so the failure is always in the dealer's eyeline; the
  existing scroll-to-summary is unchanged. (`NewApplicationForm.tsx`, en/fr
  `newApplication.submitFailedHint`.)
- **Submit buttons: no more double-taps, and they show they're working.** A new
  shared `PendingSubmitButton` disables the button the instant a form starts
  submitting (so an impatient double-tap can't fire a second deal / cancellation /
  upload), swaps in a spinner + "working…" label immediately, and once the wait
  passes ~2s appends a live elapsed-seconds counter so a slow save visibly ticks
  instead of looking frozen. Wired into the **new-deal submit**, the **Cancel this
  deal** button, and the **document upload** button. (`PendingSubmitButton.tsx`,
  `NewApplicationForm.tsx`, `DealCancelPanel.tsx`, `UploadForm.tsx`.)
- **Scan "double-check" hints no longer name a field that isn't on screen.** The
  scan-verification banner would say e.g. "⚠️ Double-check: Years at address" even
  on the Express/Photo flows, which don't have that field — confusing, since there
  was nothing to check. It now lists only flagged fields whose input is actually
  visible in the current entry method. (`NewApplicationForm.tsx`.)
- **New-deal scan verification no longer blocks a deal with an invisible checkbox
  (fix).** After scanning a licence/credit app, some deals couldn't be submitted:
  the scan flags every section it filled so the dealer confirms it, but a full
  credit-app scan also flags **Employment** (and sometimes **Co-applicant**) — and
  those sections only render on the **typed** (Priority) flow. On the **Express**
  and **Photo** flows their confirm checkbox never appears, so the deal was stuck
  behind a requirement with no box to tick. Dealers hit it right after the
  DOB/applicant confirm, so it looked like a "date of birth" problem, and it only
  happened when scanning. Fix: a scanned section can only block submission if its
  confirm checkbox is actually **on screen** (all three entry points behave the
  same now); a co-applicant flagged by a scan and then removed no longer blocks
  either. Blocking logic extracted to `lib/scanReview.ts` with unit tests.
  (`NewApplicationForm.tsx`, `lib/scanReview.ts`, `tests/scanReview.test.ts`.)
- **Live journal is now strictly append-only (data-integrity fix).** A live-journal
  write could land on an existing row and overwrite it — it matched rows by HD ref
  / loan number and would also fill the first blank-Last-Name row, which meant a
  human's notes row (blank Last Name but real notes) got clobbered and the journal
  shifted. Root cause was in `chooseRow` (`journal.ts`). **Live** mode now only
  ever writes to the row **below all existing content** (never over another row,
  never into a gap); the sole in-place update is when we re-sync a deal whose
  remembered row still carries that customer's Last Name. It no longer matches
  arbitrary rows by reference number, and won't reuse a remembered row whose Last
  Name no longer matches. The **test** sandbox keeps its lenient fill-the-blank
  behavior. `chooseRow` is now exported and covered by unit tests
  (`tests/journal.test.ts`). NOTE: a previously-overwritten row must be restored
  from the sheet's own Version history. (`journal.ts`, `settings.ts` type import.)
- **Pop-up alerts can now carry an image.** A must-read pop-up can attach a flyer /
  notice image (JPEG/PNG/WebP/GIF, ≤12 MB); with an image the message text is
  optional — dealers just view it and press X to close (the acknowledgement is
  still recorded). The image is served audience-scoped (only users the alert
  targets can fetch it) and clicking it opens the full-size version in a new tab.
  (`schema.prisma` `DealerAlert.imageStorageKey`/`imageMime`, migration
  `20260919180000`, admin `AlertForm.tsx`, `createDealerAlertAction`,
  `api/alerts/[id]/image/route.ts`, `AlertModal.tsx`.)
- **Document viewer: view *or* download when preview fails.** When an inline PDF/
  doc preview can't render, the viewer now offers both **Open in new tab** (view)
  and **Download**, instead of download-only. (`DocViewer.tsx`, `en.ts`/`fr.ts`
  `docViewer.openNewTab`.)
- **Accidental duplicate deal submissions are blocked.** Submitting a new customer
  application now guards against a double-submit — the same office + applicant name
  within a short window (status not already declined/withdrawn) is refused rather
  than creating a second identical deal. Existing duplicates are cleared by staff
  declining or the deal being withdrawn (applications aren't hard-deleted, for
  audit). (`(dealer)/actions.ts`.)
- **Leads report shows leads by source (Store vs HD Mail In Test).** The Leads
  report now surfaces a "Leads by source" line — HD Store leads vs scanned HD Mail
  In Test cards (same window) — so mail-in is visible alongside store. The existing
  HD metrics/funnel are unchanged (they still cover Store leads); mail-in keeps its
  own list, views and billing. (`leadsReport.ts`, `LeadsReportView.tsx`.)
- **HD Mail In Test now has List / Grouped / Map — the same options as Store, plus
  split Booked/Sold.** The mail-in workspace gained a **Grouped** view (sections by
  status) and a **Map** view (reusing the Store map + geocoder; scanned cards are
  geocoded by their address via the new `addressGeoData`, dealer store pins
  included). The Leads report's combined **"Booked / sold"** tile is now two
  separate **Booked** and **Sold** tiles. (`MailInTestWorkspace.tsx`, `leadGeo.ts`,
  dealer `leads/page.tsx`, `LeadsReportView.tsx`.)
- **Mail-in lead billing: tracking + admin report.** Each scanned card now records
  whether **Georgian Water** uploaded it (leads mailed to our office → billable to
  the owning office) vs the office scanning its own cards (not billed) — a new
  `uploadedByGwa` flag set at upload time from the scanner's role (migration
  `20260919170000`; an admin "viewing as" a dealer counts as the office, not GW).
  New **admin-only** page **Admin → Mail-in billing** (`/admin/mail-in-billing`,
  section `mail-in-billing`) with a month picker and two tables: **Billable to
  offices** (what GW uploaded, by office) and **All mail-in leads by office**
  (every card per office, billable + office-uploaded + total). Counts from the day
  the flag shipped; a per-lead rate can be added when invoicing. (`schema.prisma`,
  `scanActions.ts`, `lib/reporting/mailInLeads.ts`, `admin/mail-in-billing/page.tsx`,
  `constants.ts`.)
- **Blank HD Mail In Test reference card added — the scanner accuracy feature is
  now live.** Dropped the clean, unfilled HD Mail In card in `assets/lead-card/
  blank-card.jpg` (straightened + downscaled from Sean's photo). The reader now
  shows it as a labelled layout map before every filled card, which measurably
  improves reads on busy handwriting. This completes the blank-card reference
  wiring shipped earlier today (`getLeadCardTemplate` picks it up automatically;
  `LEAD_CARD_TEMPLATE_DISABLED=1` still turns it off). The lead-generation card is
  a different layout and will be added later as its own type.
- **Leads page redesign: view switcher + HD Mail In Test workspace + Undo.**
  Rebuilt the dealer Leads page around a **view switcher** — **All · HD Mail In
  Test · Store** (each with a live count, `?tab=` param) — so the two lead types
  live together and you can flip between them or view all. The **HD Mail In Test**
  section is now a real workspace (`MailInTestWorkspace`): search, **sort**
  (newest / oldest / name / store / collected date / status), status-filter chips,
  and **paging** (Load more, 12 at a time) so it stops sprawling as cards pile up;
  the scanner is tucked into the toolbar as a compact **＋ Scan cards** button
  instead of an always-open box. The **Store** tab is the existing Home Depot
  leads view unchanged (keeps its map / grouped / month filters). Staff leads page
  gets the same HD Mail In Test workspace (its office selector is unchanged).
  Added a discoverable **Undo** on the call tracker: a Sold / Booked / Not-
  interested lead shows a one-tap "↩ Undo" (was only a hidden ✕ in the history),
  so a mis-tapped Sold can be reopened. ("Associate" will be added as a third lead
  type later, once that distinction exists.) (`LeadsTabs.tsx`,
  `MailInTestWorkspace.tsx`, `LeadCallTracker.tsx`, `ScannedLeadsList.tsx`,
  dealer + staff `leads/page.tsx`.)
- **The "All" tab is now one fully-merged list.** HD Mail In Test cards and Store
  leads interleave in a single status-striped list (each row tagged Mail-In /
  Store) with a shared search, sort and status filter and its own paging — not two
  stacked sections. Each row keeps its type's full detail by reusing the same row
  component its dedicated tab uses (`StoreLeadRow` / `ScannedLeadRowItem`), so
  nothing is lost; the per-type tabs still hold the power features (the Store tab's
  map / grouped / month views). (`AllLeadsView.tsx`, `ScanCardsPanel.tsx`;
  `LeadsView.tsx` and `ScannedLeadsList.tsx` export their row components.)
- **Renamed the scanned cards to "HD Mail In Test"** across the dealer + staff
  leads UI (display-only; the `ScannedLead` model is unchanged).
- **Location-isolation audit + fixes (scanned leads, lead calls, chat).** Full
  cross-office data-isolation sweep. The main dealer read/write surfaces (deals,
  documents, gift cards, mail, reports, downloads) were confirmed correctly
  `dealerId`-scoped. Fixed:
  - **Lead calls** (`leadCalls.ts`, `leadCallActions.ts`): `readLeadCalls` now
    scopes to the viewing office (own calls + GWA staff notes; never another
    office's), and `logLeadCallAction` verifies a scanned lead belongs to the
    caller's office before logging — so a dealer can't inject a call/note onto
    another office's lead. Dealer leads page + dealer digest pass the office
    scope. The all-office `leadsReport` stays unscoped by design (staff report).
  - **Chat** (`chat.ts`): `canAccessConversation` and the author-name masking now
    respect impersonation, so an admin "viewing as" a dealer is confined to that
    dealer's threads (same class as the scanned-leads fix).
  - **Scanned-lead save** (`scanActions.ts`): an admin viewing as a dealer now
    saves cards to that office, not by store lookup.
  - Tests: `tests/chatAccess.test.ts` (+ existing `scannedLeads.test.ts`).
  - **Follow-up (config, not code):** the report-visibility screen lets an admin
    set an inherently cross-office report (all-leads / lead-funnel) to the
    "own office's data" level, which would then expose every office's leads to any
    office with reports on. Recommend disallowing that level for cross-office
    reports — flagged for a decision.
- **Scanned leads: fixed cross-office visibility in "view as dealer".** Each
  scanned lead is owned by an office (`dealerId`), and real dealers were already
  scoped to their own — but an admin **viewing as** a dealer still saw *every*
  office's cards, because impersonation keeps the ADMIN role (which the scanned-
  lead scoping treated as "see all") and only swaps in the dealer's id. Added a
  `seesAllScannedLeads()` guard: internal staff see all **except** while
  impersonating, when they see exactly what that dealer sees. Closes the list, the
  status/delete actions, and the card-photo route in one place. (`lib/scannedLeads.ts`;
  `tests/scannedLeads.test.ts`.) Note: staff-scanned cards whose store number
  doesn't map to a dealer stay **unassigned** and are visible only to staff — map
  the store to an office to route them.
- **System health: real AI cost meter + tidier AI section.** Added a *measured*
  "AI spend this month" meter (USD) to Admin → System health, alongside the DeepL
  meter. Every card-reader and support-assistant call now records its real token
  usage (new `AiUsage` table, migration `20260919120000_ai_usage`; recorded
  best-effort so metering never breaks a feature), priced at Anthropic first-party
  rates and broken down by feature (card reader vs assistant) and model. It
  measures from deploy forward — earlier usage isn't counted (full history lives
  in the Anthropic Console). The old client-side estimator is kept as a collapsed
  "Model cost comparison (what-if)". The AI-assistant cards are now grouped under
  one "AI assistant" heading, and "What dealers are asking" is collapsed by
  default and capped to 5 with "Show all", so the Q&A log no longer sprawls.
  (`lib/aiUsage.ts`, `AiCostMeter.tsx`, `CollapsibleCard.tsx`, `system-health/
  page.tsx`, `AssistantReview.tsx`, `AiCostCalculator.tsx`, `ai.ts`,
  `api/leads/scan-card/route.ts`, `schema.prisma`; `tests/aiUsage.test.ts`.)
- **Deal progress bar: the highlighted step now sits on where the deal actually
  is, not one step ahead.** Each linear stage was marked "done" the moment a deal
  *reached* it, so the current-step marker (the first not-done stage) pointed at
  the next milestone: a just-**submitted** deal looked like it was already up for
  approval, and a freshly **approved** deal (e.g. an instant-approved Financeit
  deal) jumped straight to "Docs uploaded". Now a stage is "done" only once the
  deal has moved *past* it — a SUBMITTED/UNDER_REVIEW deal rests on **Submitted**
  until a reviewer approves, and a freshly approved deal rests on **Approved**
  until its funding docs are in (or install paperwork is sent). The funding half
  of the bar is unchanged. (`progress.ts`; new `tests/progress.test.ts`; also
  refreshed 3 stale `reviewer-flow.test.ts` assertions to match the existing
  FUNDING_SUBMITTED guard.)
- **Lead-card reader: stronger model + optional blank-card reference (accuracy).**
  Two changes aimed at reading messy handwriting better:
  - The reader now defaults to **`claude-opus-5`** (was `claude-sonnet-5`) — a more
    capable vision model, ~2× the cost per scan (still a few cents, on low volume).
    Contained to the card reader only (the chat assistant's `ANTHROPIC_MODEL` is
    untouched) and still overridable via `CARD_AI_MODEL` — set it to
    `claude-sonnet-5` or `claude-haiku-4-5` to trade a little accuracy for cost.
  - Added an **optional blank-card reference**: a clean, unfilled photo of the card
    (plus optional office `notes.txt`) dropped in `assets/lead-card/` is shown to the
    reader first as a "here's where each field sits" layout map before each filled
    photo — measurably better on busy cards. Fully optional and off until a blank
    photo is added: `getLeadCardTemplate()` returns `undefined` when the folder is
    empty, so the scanner behaves exactly as before. Env `LEAD_CARD_TEMPLATE_DISABLED=1`
    turns it off without deleting anything. (`leadScanner.ts`, new `leadCardTemplate.ts`,
    `api/leads/scan-card/route.ts`, `assets/lead-card/README.md`.)
  - **To finish the blank-card win:** add one clean, blank card photo as
    `assets/lead-card/blank-card.jpg` (see `assets/lead-card/README.md`).

## 2026-09-18
- **Lead-card reader accuracy pass, tuned to the real card.** From real cards: the
  reader now (a) captures **"Number of people in your household"** (new `householdSize`
  field + column, migration `20260918160000`) which was being dropped entirely; (b)
  supports **"Community Well"** as its own water source (was collapsed to Well/Other);
  and (c) reads the **store number from the large hand-written number in the right
  margin** (e.g. "7138") as well as the "Store Location" line — the key to routing the
  lead. The extraction prompt was rewritten to match this exact card field-by-field
  (labels, order, the two date fields, AM/PM/Evening best-time ticks, no occupation/
  spouse block on this card). (`leadScanner.ts`, `schema.prisma`, `ScanLeadCard.tsx`,
  `scanActions.ts`, `ScannedLeadsList.tsx`, dealer + staff `leads/page.tsx`.)
- **Scanned leads now look and act like the Home Depot lead rows.** They were an
  always-open card grid; they're now collapsible status-striped rows (name · store ·
  phone · status badge) that expand to the full detail — matching the HD leads list —
  and carry **the same call functions**: the `LeadCallTracker` (No answer / Msg left /
  Spoke / Booked / Sold / Not interested + notes), reusing the shared `LeadCall`
  store under a `scanned:<id>` key. The status badge/stripe now reflect the call
  history. (`ScannedLeadsList.tsx`, dealer + staff `leads/page.tsx` pass `callsByKey`.)
- **"View photo" on a scanned lead now opens an in-app lightbox with a close button.**
  It used to open the image in a new tab, which on mobile/PWA left the user stuck with
  no way back. Now it opens over the app (× button, Escape, tap-outside to close, plus
  an "Open in new tab" option). (`ScannedLeadsList.tsx`.)
- **Fixed the Test/Live journal toggle not switching.** The toggle depended on
  `window.confirm` (silently blocked in some in-app browsers) and the action returned
  nothing, so a click could do nothing with no feedback. It now uses an inline
  confirm, flips immediately from the action's returned mode, and surfaces any error.
  (`reports/actions.ts` returns a result, `WriteModeToggle.tsx`.)
- **Lead-card scanner now reads MANY cards at once (was one-at-a-time) + a Back
  button.** The scanner was built as "multiple photos = one card"; a dealer who
  submitted four cards got a single lead. It now treats every distinct card as its
  own lead: each uploaded photo is read and can contain **one card or several cards
  laid out together** (e.g. four side by side), and all detected cards come back as a
  reviewable list — check/edit each, then **Save all N leads** in one go (each saved
  with the photo it came from). Cards read with low confidence are flagged per field.
  Added a clear **"← Start over"** control (and Cancel) so you're never stuck after
  picking a photo. New multi-card extractor `extractCardsFromImage` (a `record_cards`
  array tool, blank-space entries dropped); the scan API reads photos in parallel and
  tags each card with its source photo. (`leadScanner.ts`, `api/leads/scan-card/route.ts`,
  `ScanLeadCard.tsx`.)
- **Flashing browser-tab alert for reviewers on new messages.** When a staff member
  is on another browser tab, the portal tab title now rotates between the page title
  and "🔔 (N) new message(s)" while they have unread portal messages — so reviewers
  notice a dealer's message without watching the app. It stops the moment they return
  to the tab (and clears once the messages are read). New `TabUnreadNotifier` client
  component polls the same `/api/chat/summary` (`totalUnread`) the chat badge uses;
  mounted in the staff layout for users with chat access. (`TabUnreadNotifier.tsx`,
  `(staff)/layout.tsx`.)
- **Dealer-facing payouts: staff auto-complete, dealer visibility, and actual-payout
  receipts in the calculator.** Building on the journal → paid sync (below), three
  linked changes so a settled deal flows all the way to the dealer with no manual work:
  1. **Staff "Pay dealer" step reads complete when auto-filled.** Once a payout is
     recorded (now automatic from the journal's "Pay to dealer"), the step shows a
     "Paid — nothing to enter" state with the receipt; the manual entry form is tucked
     behind a collapsed "Record another payout or a correction" section instead of
     always demanding input. (`staff/applications/[id]/page.tsx` pay block.)
  2. **Dealers see their final payout amount on the deal.** The deal page now shows a
     prominent final payout figure + receipt once a payout exists. New per-office
     toggle `Dealer.showPayoutsToAllUsers` (migration `20260918120000`, default **on**):
     everyone at the office sees payout dollars by default; an office can switch to
     owner/main-contact-only from Admin → Dealers (**Payouts ✓** button). The
     distributor always sees it. (`schema.prisma`, `(dealer)/…/[id]/page.tsx`,
     `(admin)/actions.ts` `toggleDealerShowPayoutsAction`, `DealerRowActions.tsx`,
     `admin/dealers/page.tsx`, i18n `dealDetail.finalPayout`.)
  3. **HD payout calculator shows the ACTUAL payout + prints a real receipt for paid
     deals.** When a dealer looks up one of their fully-paid deals (a payout exists),
     the calculator shows the real amount paid (date/method) instead of the estimate,
     and "Save PDF"/Print produce an **actual** receipt built server-side from the
     recorded payout (re-verified within the dealer's tenant scope — never client math).
     Unpaid deals still get the estimate as before. (`calculator/actions.ts` `DealMatch`
     +payouts, `DealerCalculator.tsx`, `api/dealer/calculator/receipt/route.ts`, i18n
     `calculator.actualPayout`/`paidOn`/`confirmedPaid`/`actualNote`.)
- **Scheduled the journal → paid sync (it was built but nothing ever ran it).** The
  journal-paid automation (`journalPaidSync.ts` + `/api/cron/journal-paid-sync`) —
  which reads each journal-written deal back, and when the row shows Result "OK" +
  a Date Paid, auto-advances the deal to Funded and auto-fills the "Pay to dealer"
  payout from the journal — has always been code-complete but had **no scheduler**.
  The app runs no cron of its own; `render.yaml` has no cron job; and prod is on AWS
  EB (not Render, where the go-live checklist pointed the cron). So the sweep never
  fired on its own — deals only synced if a reviewer pressed "Check journal" on the
  deal. Added `.github/workflows/journal-paid-sync.yml`: a scheduled GitHub Action
  that POSTs the cron endpoint every 2h (and can be run on demand from the Actions
  tab). **Requires**: repo secret `CRON_SECRET` matching the EB env var; and the live
  journal must have the "Pay to dealer" column or the payout amount won't fill (deal
  still auto-funds + stamps journalPaidOn). Long-term this should move to AWS
  EventBridge Scheduler (same infra as prod; GitHub disables schedule crons after 60d
  of no commits). (`.github/workflows/journal-paid-sync.yml`.)

## 2026-09-17
- **Deal chat is back on the dealer side — but only when we've messaged them.** The
  dealer's deal page now shows the `ConversationThread` chat in a card **right under
  the status header**, so a message from our team is the first thing they see. It's
  rendered **only once GWA has actually sent a message on that deal** (a real
  `fromStaff`, non-`auto` `ChatMessage`) — no empty chat box otherwise. The dealer
  can reply from there. (`dealer/applications/[id]/page.tsx` server-side
  `hasStaffMessage` query + gated section, `dealDetail.messagesTitle` /
  `messagesPlaceholder` i18n en/fr.)
- **Per-person opt-out for new-deal/funding emails.** Added a **"A dealer submits a
  new deal or funding package"** toggle to staff notification settings (My account),
  backed by `User.notifyNewSubmission` (migration `20260917120000`, defaults **on**
  so nobody misses a deal). The new-submission and funding-submission emails now
  respect it; push still goes to all staff. (`schema.prisma`, `notify.ts`,
  `(account)/actions.ts`, `ProfileForm.tsx`, `account/page.tsx`, `validation.ts`, i18n.)
- **New-deal & funding-package alerts now email reviewers, not just push.** New-deal
  submissions and funding-package submissions were **push-only** — and browser/PWA
  push silently lapses (expired subscription, notifications turned off, iOS quirks),
  so reviewers could stop seeing new deals. Both now **email every active
  reviewer/admin AND push** (mirroring how document-upload alerts already worked),
  so a new deal is reliably seen even when push is down. Not gated behind an opt-in
  preference — new deals are the core job. (`notify.ts` `notifyNewSubmission`,
  `notifyFundingSubmitted`.) Note: push itself needs the **VAPID keys set on
  Elastic Beanstalk** to work at all — email works regardless.
- **Void cheque (and any doc) can be uploaded early again — without advancing the deal.**
  Refined the order-of-operations rule: dealers may **upload** individual documents
  any time after approval (e.g. a void cheque they have on hand), but this no longer
  advances the deal or marks it "returned." Only **submitting the completed package**
  advances it, and that still requires our install docs to have gone out first
  (DOCS_SENT). The dealer sees a hint that they can upload now and submit once our
  paperwork arrives. (`(dealer)/actions.ts` upload gates reverted; `submitFunding`
  gate + `hasDealerReturned` order rule kept; dealer page hint.)
- **Funding order-of-operations enforced (dealer can't return docs before we send them).**
  Fixed a workflow gap where a dealer could upload/submit their signed funding
  package while the deal was only **Approved** — before GWA sent the install
  documents — which flipped the deal into "review" and falsely marked **"Produce
  install documents"** and **"Sent — awaiting install"** as *Done* (with "0
  documents sent"). Now the sequence is enforced end to end:
  - **Server:** the dealer funding uploads (`uploadFundingDocAction`,
    `uploadFundingBatchAction`) and the "submit funding package"
    (`submitFundingAction`) require status **`DOCS_SENT`** or later — never
    `APPROVED`/`CONDITIONAL`. `DOCS_SENT` is set precisely when a reviewer sends
    install paperwork, so the dealer can only return what we've actually sent.
  - **Reviewer flow / staff checklist:** a phase is "Done" only when it truly
    happened — `hasDealerReturned` now requires our install docs to have gone out
    first, and a deal that somehow reached `FUNDING_SUBMITTED` without sent docs is
    surfaced back at "Produce install documents" instead of showing false greens.
  - **Dealer page:** before we've sent docs, the funding uploader is replaced by a
    clear "we're preparing your install documents — nothing to do right now" note;
    the "What's needed from you" card no longer tells an approved dealer to upload
    before they can. (`reviewerFlow.ts`, `outstanding.ts`, dealer `actions.ts`,
    dealer `applications/[id]/page.tsx`.)

## 2026-09-16
- **Lead-card scanner on the Leads page (dealer + staff).** Dealers (and GWA staff)
  can photograph a handwritten Home Depot **water-test lead card** and the AI reads
  it into a form to confirm and save — the booking site's scanner, ported into the
  portal. New **"Scanned leads"** section on both the dealer and staff Leads pages:
  an "Add a lead card" uploader (multi-photo of the same card for accuracy, or type
  by hand) and a list of saved cards with status (New / Contacted / No good), the
  original photo, and delete. Stored in the portal DB (`ScannedLead`), **separate
  from the HD Leads Log sheet** — dealers see their own office's cards, staff see all
  (attributed by store number). The original photo is kept encrypted in S3.
  - Backend `lib/leadScanner.ts` calls the Anthropic REST API via `fetch` (no new
    dependency; matches `lib/ai.ts`); gated on `ANTHROPIC_API_KEY` (already live) and
    per-user rate-limited (`scan-lead`, 20/min). Confidence + uncertain-field flags
    surface in the UI. Scanner is hidden when AI isn't configured.
  - Files: `ScannedLead` model + migration `20260916120000`; `lib/leadScanner.ts`,
    `lib/scannedLeads.ts`; `api/leads/scan-card` (read) + `api/leads/scanned/[id]/photo`
    (serve, access-scoped); `scanActions.ts` (save/status/delete); `ScanLeadCard.tsx`,
    `ScannedLeadsList.tsx`; wired into dealer + staff Leads pages.
  - **English-only for now** (FR translation of the scanner UI is a follow-up).
- **Concurrency caps on heavy jobs (memory-spike protection).** Added a tiny
  in-process semaphore (`src/lib/concurrency.ts`) and wrapped the two heaviest,
  memory-hungry paths so a burst can't exhaust the small instance's RAM: **OCR**
  (tesseract + page rasterization, `ocrBytes`) capped at 2 concurrent, and **PDF
  page rendering** (`pdfFirstPageThumb` + `renderPdfPagesStacked`, shared pool)
  capped at 2. Excess calls queue (they wait, never dropped) so a spike degrades to
  "slightly slower" instead of an outage. Per-instance by design. (AWS capacity
  item #4.)
  - **OPS TODO — the AWS-side capacity items still need doing** (they require AWS
    console/CLI access, which the portal/session can't do): **(1)** convert the EB
    env `Gwa-portal-env` from single-instance to **load-balanced, min 1 / max 2–3**
    with a CPU scale-out trigger (ends the single-point-of-failure); **(2)**
    right-size to **t3.medium** only if the memory/credit alarms fire; **(3)** add
    the **CloudWatch alarms** (CPU, CPU-credit-balance, memory, EB health, ALB 5xx,
    RDS). Full copy-paste steps in **`docs/AWS-SCALING-ALARMS.md`**. Blocked on AWS
    access (the "AWS MCP" connector isn't available to the org and the session's AWS
    env creds return InvalidClientTokenId).
- **Fixed the in-app document viewer opening in a tiny box (dealer + staff).** The
  `DocViewer` full-screen overlay (View on deal documents / customer paperwork /
  HD waivers) is `position: fixed`, but it rendered inside the page DOM — so a
  `transform` on any ancestor (e.g. a card hover effect) became its containing
  block and trapped the overlay in that little area instead of the viewport (it
  only filled the screen when the cursor left, releasing the hover transform). Now
  rendered through a React portal to `document.body`, so it always covers the full
  viewport regardless of ancestor transforms. (`components/DocViewer.tsx`.)
- **Security audit follow-ups (safe batch).** Acted on the 2026-09-16 read-only
  audit's low-risk findings (no behaviour changes for normal use):
  - **PII reveal is now logged-or-masked (fail-closed).** `audit()` returns whether
    the entry was actually written; the reviewer deal view, edit form, and print
    view now record the `PII_DECRYPT` entry **before** decrypting and only reveal
    when it succeeded — otherwise fields stay masked. Closes an unlogged-PII-access
    gap when an audit write fails. (`audit.ts`, staff `applications/[id]/page.tsx`,
    `edit/page.tsx`, `print/page.tsx`.)
  - **Rate limiter no longer fails fully open.** On a DB error the limiter falls
    back to a per-instance in-memory window instead of allowing everything, so
    login/MFA/reset brute-force protection survives a DB blip. (`ratelimit.ts`.)
  - **Disabling 2FA now un-trusts remembered devices** — `disableMfaAction` bumps
    `mfaTrustVersion` like every other MFA-change path. (`(account)/actions.ts`.)
  - **Deal chat can't create a stray conversation row for a deal you can't access**
    — `getOrCreateDealConversation` checks access before creating. (`chat.ts`,
    chat `send`/`messages` routes.)
  - (Earlier same day: rate-limited the AI support-assistant endpoint.)
  - Deferred by design/decision: encryption single-key + KMS hardening (needs the
    live key confirmed first), card-scan fail-open vs fail-closed, and login
    account-lockout enumeration wording.
- **Document-expiry reminders: admin settings panel + optional CC to GWA staff.**
  The WSIB/WCB (and "Other") renewal reminders already emailed + pushed the
  **dealer's own active users** at the office that owns the document; that's
  unchanged. Added, at **Admin → Dealers → Dealer documents**:
  - **A settings panel** to edit the whole schedule without a code change:
    on/off, first-reminder days-before (default 7), repeat cadence (default weekly),
    max reminders (default 6), send-hours window, and timezone — with "Reset to
    defaults". Persists in app settings (`reminders.docExpiry`).
  - **"Email GWA staff a daily digest"** toggle — when on, every Reviewer + Admin
    gets ONE summary email per run listing every document reminded that day
    (office · document · status · expiry), instead of a copy per document; sent
    only on days something is due, email only. Offices with no users of their own
    still appear in the digest. Off by default.
  - **"Run it now"** button to fire the due sweep on demand (respects the send-hours
    window). (`docReminders.ts` `ccStaff` + staff CC, `saveDocReminderConfigAction`
    / `resetDocReminderConfigAction` / `runDocRemindersNowAction`,
    `DocReminderConfigForm`, `DocReminderRunner`, dealer-documents admin page.)
  - Confirmed the daily Render Cron `gwa-doc-expiry-reminders`
    (`0 13 * * *` → `/api/cron/doc-expiry-reminders`) is live, so reminders fire.

## 2026-09-15
- **Dealer "journal name" — short form written to the journal's Location column.**
  Each dealer now has an optional **journal name** (Admin → Dealers, inline next to
  the dealer's name) that overrides how the office appears in the sales journal's
  **Location** column (e.g. "Georgian Water and Air" → **GWA**). Leave it blank and
  the full dealer name is written, exactly as before — so nothing changes until a
  short form is filled in. Same pattern as products' journal codes. Takes effect on
  the next journal write for that dealer's deals (re-approve / any reference change
  re-writes the row). (`Dealer.journalName` + migration, `setDealerJournalNameAction`,
  `DealerJournalNameForm`, dealers admin page, `syncApplicationToJournal`.)
- **Paid auto-function now actually reaches "Paid" (was stopping at "Funded").**
  When the sales journal shows a deal paid (Result = OK + a Date Paid), the
  nightly sync was correctly recording `journalPaidOn` and advancing the deal to
  **Funded**, but the deal-progress tracker only lit the **Paid** step from a
  recorded Payout, so a journal-confirmed payment never showed as Paid (e.g.
  Leanne Vida last night). Fixed two things:
  - **Tracker:** "Paid" (and the earlier "In for funding"/"Funded" milestones)
    now light from **either** a recorded payout **or** the journal's Date Paid
    (`journalPaidOn`). Both the dealer and staff deal pages pass `journalPaidOn`
    into the tracker. The Vida deal will show **Paid** on next page load — no
    re-sync needed. (`progress.ts`, staff + dealer `applications/[id]/page.tsx`.)
  - **Auto-fill payout amount:** the sync auto-creates the dealer Payout from the
    journal's **"Pay to dealer"** column (currently **AO**). Broadened the
    header matcher to be whitespace/punctuation-insensitive so the column is found
    reliably regardless of casing/spacing (`Pay to dealer`, `Pay To Dealer`,
    `pay-to-dealer`, etc.). (`journal.ts` `readDealJournalStatus`.)
  - **Note:** the "Pay to dealer" (AO) column currently exists only on the **TEST
    journal**. Once verified, add the same column to the live journal — the payout
    $ then auto-fills on the next sweep with no code change.

## 2026-09-14
- **GWA-program deals no longer need an HD store.** On the new-application form, selecting **GWA** (not HD) in the Program dropdown now hides the Home Depot store field and drops it from the required fields (it was previously required on the Express path). HD deals are unchanged. (`NewApplicationForm.tsx`; server schema already treated the store as optional.)
- **Admin nav reorganized + two orphaned pages recovered.** Audited the admin menu: regrouped into Deals / Reporting / Dealers / Catalog / Dealer comms / People / System (splitting the overloaded Content + Deals menus and giving Reporting its own menu). Fixed **Report visibility** and **Outside costs**, which were reachable only by URL — both now appear in the nav. Nav-only; no access changes. (`(admin)/layout.tsx`.)
- **Report visibility control (Super Admin → Report visibility).** One page to set
  who can open each report — level per report: **Super Admin only / Leadership /
  Staff / Dealers (own office) / By grant / Off (hidden)** — with a legend of who
  each lets in. Enforced centrally: the tab is hidden **and** the page 404s below
  the chosen level (real access control). Backed by a report registry + batched
  resolver (`lib/reporting/visibility.ts`); levels persist in app settings.
  **Defaults exactly match the previous built-in gating, so nothing changes until
  a report is switched.** Wired across all dealer reports (tabs + pages) and the
  staff reports (grouped, plus Leads and Dealer-snapshot individually). New admin
  nav entry; super-admin only. (`visibility.ts`, `DealerReportTabs`, every dealer
  report page + staff report pages, `admin/report-visibility`, `setReportVisibilityAction`.)
- **Leads report: real "Download PDF".** A server-generated PDF (pdf-lib — no
  headless browser, works in production) of the Leads report, scoped to the
  selected period: brand header, KPI row, call-activity, leads-by-type, and the
  full per-office table (paginated with repeating header + page numbers).
  Download button on the dealer All-leads and staff Leads reports; routes
  `.../all-leads/pdf` and `.../leads/pdf` (same access as the report).
  (`leadsPdf.ts`, two routes, `ReportActions` `pdfHref`.)
- **Leads report: period picker (All time / Weekly / Monthly).** Pick a specific
  week or month and the whole report — group tiles, call-activity, leads-by-type
  and the per-dealer table — scopes to that period (with ←/→ nav and a "Showing:
  <period>" banner); the trend chart stays full-history for context. Printing or
  emailing then produces a generated report for exactly that week/month. On the
  dealer All-leads and staff Leads reports. (`buildLeadsReport` date window +
  `leadsPeriodWindow`, `LeadsPeriodControls`, both pages.)

## 2026-09-13
- **Dealer insights digest — Phase 2: emailed + scheduled.** The Snapshot can now
  be emailed to each office. `Dealer.insightsEnabled` (**off by default**);
  recipients = every report user at the office. Admin **Dealers** page gains a
  **Digest** on/off toggle and a **Test digest** button (sends that office's
  weekly snapshot to the admin's own email to preview — never the dealer). Cron
  `/api/cron/dealer-digest?period=week|month` (Bearer `CRON_SECRET`) sends to
  enabled offices with `DigestLog` dedupe (never twice per period).
  **OPS TODO (Sean):** add two scheduled crons — weekly Mon `?period=week` and
  monthly 1st `?period=month`, reusing the existing `CRON_SECRET`. (`dealerDigestEmail.ts`,
  `digestSend.ts`, `api/cron/dealer-digest`, admin actions + DealerRowActions,
  schema `insightsEnabled` + `DigestLog`.)
- **Dealer insights plan + Phase 1 "Snapshot" digest (on-screen).** Planned an
  automated per-office insights digest (see `docs/DEALER-INSIGHTS-PLAN.md`:
  weekly+monthly, on-screen + emailed, then speed-to-lead / peer benchmarking /
  conversion funnel / HD-promo overlay). Built Phase 1: `buildDealerDigest()` +
  a branded, printable **Reports → Snapshot** tab showing leads (vs prior period)
  + an 8-period lead-volume trend, financing mix (financed, **HD Credit Cards**,
  FinanceIt, cash/other, $ funded), and VOC (completed, avg, top reps), with
  plain-language highlights. Phase 2 (emailed digest + weekly/monthly schedule)
  is next. (`lib/reporting/dealerDigest.ts`, `components/reporting/DealerDigestView.tsx`,
  `dealer/reports/digest`, `DealerReportTabs`, i18n.) Phase-1 view labels are
  English for now; FR is a Phase-2 polish item.
- **Leads report: lead-volume trend chart (weekly/monthly).** Added a bar chart of
  HD leads received per week or per month (last 12 periods, toggle), with the
  booked/sold portion highlighted — to see which Home Depot promotions actually
  drove leads. `buildLeadsReport` now returns weekly + monthly `trend` series
  (booked/sold by latest call outcome; undated leads noted and excluded).
  Inline SVG (prints cleanly); shows on the dealer All-leads and staff Leads
  reports. (`leadsReport.ts`, `LeadsReportView.tsx`.)
- **VOC "By store location" breakdown.** Added a per-Home-Depot-store table to the
  VOC report (store name, store #, owning office, completed VOCs, avg rating),
  counted straight from the file's store number — so every location's total shows
  even when a VOC couldn't be matched to a rep. Respects the date filter; dealer
  view is scoped to their own stores. (`voc.ts` `stores`, VocReportView, i18n.)
- **VOC import de-dupes numbers.** VOCs are keyed by a normalized (digits-only) HD Lead #, which is UNIQUE — re-uploading a file or overlapping months updates rows instead of creating duplicates. Import now also collapses duplicates within one file and reports "X new, Y updated, Z merged".
- **VOC contest standings.** Added a flat **sales-rep leaderboard** to the VOC
  report (dealer + staff): reps ranked by completed VOCs in the selected date
  range (top 3 get medals), for scoring VOC contests. One-click **"VOC contest
  (Jan 1 – Jun 30, 2026)"** date preset on both pages. (VocReportView + both voc
  pages + `en.ts`/`fr.ts`.)
- **VOC report — date range filter + a "has it been done?" lookup.** The VOC
  report (dealer + staff) now takes a **From/To submission-date filter**. The
  staff page adds a **completion lookup**: paste one or many HD Lead #s (or upload
  a .xlsx/.csv/.txt list) and see which have a completed VOC vs. still
  outstanding, with each number's office and rep. (`lib/reporting/voc.ts`
  `lookupVocs`/`extractRefsFromFile`, `vocMatch.ts` `extractRefs` (tested),
  `staff/reports/voc` `VocLookup`, both voc pages, `en.ts`/`fr.ts`.)
- **Voice of the Customer (VOC) report — completed HD reviews by office & sales
  rep.** New `VocEntry` model + migration. Admins upload Home Depot's VOC export
  (.xlsx) on **Staff → Reports → Voice of the Customer**; the parser (jszip, no
  new dependency) upserts by Lead #, so re-uploading a fuller month is safe. The
  report ties each VOC to an **office** by store number and to a **sales rep** by
  matching the VOC Lead # to the sales journal's **HD Ref #** (searched across
  2024→current, so a 2026 VOC on a 2025 deal still matches). Near-duplicate rep
  names are merged (same logic as the leaderboard); VOCs with no journal match
  still count toward the office as "rep not found," and the **match rate is shown**
  so we can validate the 800-number join against live data. Dealers see their own
  office at **Reports → VOC** (brand-stamped, printable/emailable); staff/admin
  see all offices. Pure matching engine is unit-tested (`tests/voc.test.ts`), and
  the parser was validated against the real 76-row export.
  (`lib/reporting/vocMatch.ts` + `voc.ts`, `components/reporting/VocReportView.tsx`,
  staff + dealer `voc` pages, `DealerReportTabs`, `en.ts`/`fr.ts`.)
- **New full-bleed app launch (splash) screen (Sean's artwork).** Replaced the
  splash with Sean's custom full-bleed portrait design (GWA lockup + water/air
  motif + "Cleaner Healthier Brighter") across all 11 iPhone sizes under
  `public/splash/`, generated cover-fit (scale-to-fill, centre-crop) from
  `design/splash/source-mobile.png`. The source art (mobile + a wide/landscape
  variant) is kept in `design/splash/` for reprocessing. Regenerate with
  `node scripts/gen-splash.mjs design/splash/source-mobile.png --mode cover`.
  (An earlier same-day pass used the logo-on-white-card look via
  `scripts/gen-splash-card.mjs`; the custom artwork supersedes it.) No code
  change — layout.tsx serves these files by name. (iOS caches the splash: remove
  the app from the Home Screen and re-add it to see the change.)
- **Dropped the grey "basis / methodology" footnote from the reports.** The small
  grey explanatory paragraph at the foot of each report (e.g. leaderboard's "From
  the journal's 'Dealer's Name' column… near-duplicate names are grouped…") is
  gone across the board: Salesperson leaderboard, Sales reps, Products & packages,
  Funding, Overall sales, Sales forecast, Lead funnel, All leads, and the staff
  Finance report. **Kept** the genuine data caveats — the leaderboard's "N paid
  deal(s) had no rep named… aren't counted" line, the monthly "no sales this
  month for …" note, the custom builder's per-selection note, and the product-
  pricing column legend (what "after-tax" vs "net" mean). (Render sites removed in
  the report views/pages; the now-unused i18n keys were left in place.)
- **Owner-only reports branded to match.** The five owner/distributor reports
  (Product pricing, Sales reps, Custom builder, Sales forecast, Accounting
  export) previously had no header or footer at all. They now carry the same
  dealer-branded top lockup (office name + uploaded logo, GWA fallback) and the
  "Georgian Water & Air" footer stamp as the other reports. Added at the page
  level so the staff-shared product-pricing view is untouched. (The five owner
  report pages under `dealer/reports/*`.)
- **Dealer reports now carry the dealer's own name + logo at the top; the GWA
  stamp stays at the foot.** On a dealer's own-office reports (Monthly, Weekly,
  Overall sales, Funding, Products & packages, Salesperson leaderboard) the top
  header lockup shows the office's business name and the logo they uploaded
  (from their profile), falling back to the GWA icon + "Georgian Water & Air"
  when no logo/name is set. The bottom brand **stamp is unchanged** — every
  printout still reads "Georgian Water & Air" at the foot. Staff-side copies of
  the same reports, and the cross-office leads reports (All leads, Lead funnel),
  keep GWA branding. New helper `getDealerReportBrand()`; `ReportHeader` (and the
  inline headers in `OfficeRangeView`/the Funding page) take an optional office
  logo. (`lib/reporting/dealerBrand.ts`, `components/reporting/kit.tsx`, the five
  shared report views, and the six dealer report pages.)
- **Option 3 (Standard): attach the credit app + bill of sale right on the
  form.** Added an "Attach the paperwork" upload area at the bottom of the
  new-application form when the dealer picks option 3, with two clearly labelled
  file pickers — **Credit application** and **Bill of sale** — so there's no
  confusion about what to send. Both are optional at submit (they can still be
  uploaded later on the application page). Files are validated up front (size +
  type; PDF or photo) and stored on the new application as `SUPPORTING`
  documents labelled "Application info" / "Bill of Sale" — the same labels the
  post-submit uploader uses — with the reviewer notified via
  `notifyNewDocuments`. Reworded the option-3 hint to point at the new area.
  (`NewApplicationForm.tsx`, `(dealer)/actions.ts`, `en.ts`/`fr.ts`.)

## 2026-09-12
- **Removed the driver's-licence scan; kept the credit-app scan.** The "Scan
  driver's licence" option didn't work reliably, so it's gone from the new-
  application form for both the main applicant and the co-applicant. The
  credit-app document scan (`DocScan`) stays everywhere it was. Deleted the
  `LicenseScan` component and its `/api/scan-id` (Textract AnalyzeID) endpoint,
  updated the auto-fill helper copy, and reworded the WelcomeTour step to
  describe only the credit-app scan. (`NewApplicationForm.tsx`,
  `WelcomeTour.tsx`; removed `src/components/LicenseScan.tsx`,
  `src/app/api/scan-id/route.ts`.)
- **Full-site security audit + two fixes; findings saved for follow-up.** Reviewed
  auth/session, authorization/IDOR, and injection/data exposure. Fixed a **CRITICAL
  MFA-bypass** (intermediate cookies could be replayed as a full session — session
  tokens now carry a `typ:'session'` claim required by `getSession`; one-time
  re-login on deploy) and a **cross-office lead PII leak** (`/api/leads/lookup`
  failed open for a dealer with no stores — now fails closed). Remaining findings
  (encryption-key/KMS, card-scan fail-open, rate-limiter fail-open, lockout DoS,
  temp-password email, and low items) are documented with file references and a
  suggested order in **`docs/SECURITY-AUDIT-2026-09-12.md`**. Overall posture is
  strong (envelope-encrypted PII, parameterized SQL, IDOR-protected document APIs,
  strong CSP, no privilege escalation).
- **Reports print as a clean one-pager — no browser header/footer, compact tiles.**
  Printouts no longer carry the browser's auto header/footer (page title, the
  portal web address, date, page number): `@page { margin: 0 }` removes the band
  they print in, and the sheet gets its own 12 mm padding so margins stay clean.
  KPI tiles are slimmed for print and forced into a single row (they were stacking
  2-up and pushing the table onto page 2), so a report now fits on one page.
- **Reports: Slate theme rolled across the dealer-visible set (banners replaced).**
  Monthly, Weekly store detail, Products & packages, and Salesperson leaderboard now
  use the same look as Total Sales — GWA icon header + petrol-navy rule, slate KPI
  tiles, slate table headers, and the bilingual brand stamp — replacing their old
  coloured banners (orange / navy / blue). Monthly & Weekly dealer pages are now
  wrapped in the print sheet with Print / Email actions like the other tabs. Stamps
  live inside the shared views (one per report, dealer + staff), so page-level stamp
  duplicates were removed.
- **New grant: "Leads oversight" — all-office leads for a dealer user.** A per-user
  grant (`User.canViewAllLeads`, additive migration) that exposes the cross-office
  **Leads** and **Lead-funnel** reports on the dealer side — every dealer's HD leads,
  not just one office — for a lead/relationship manager who works across all offices.
  It does **not** grant the reviewer deal workspace or other reports (least privilege),
  and unlike the other report grants it **can be given to a DEALER_USER**. New dealer
  pages `/dealer/reports/{all-leads,lead-funnel}` (reuse the staff leads builders +
  views, printable/emailable with the brand stamp), two dealer report tabs shown only
  with the grant, `canViewAllLeads()` helper, and an admin toggle in **Admin → Users →
  (person) → "leads oversight (all offices)"**.
- **Mobile: dealer report navigation is now a dropdown (was a sideways-scrolling
  tab strip).** On phones the report tabs ran off-screen — half the reports (incl.
  Monthly) were hidden until you scrolled the strip sideways. `DealerReportTabs` now
  shows a single "Choose a report" dropdown on phones (jumps straight to the report)
  and keeps the segmented tab strip on wider screens. New `ReportTabSelect` client
  component; owner-only tabs still gated.
- **Fix: reports now print/PDF fully — wide tables no longer clipped.** Printing a
  report (e.g. the month × store "Money put through" matrix) ran off the page and got
  cut off, because the on-screen `overflow-x-auto` table kept its full width on paper.
  Global `@media print` rules now make every report (`.print-sheet` / `.print-only`)
  fit the page: table wrappers stop clipping, tables shrink to 100% width and wrap,
  cell font/padding tighten to ~10px, `thead` repeats on each page, rows avoid
  breaking mid-row, and sticky columns are unstuck. One site-wide fix, so all reports
  (and the payout receipt) print fully in portrait or landscape.
- **Reports: one shared visual language (kit) across dealer + staff.** Added
  `src/components/reporting/kit.tsx` (ReportTile/ReportTiles, ReportTableWrap,
  shared thead/row/tfoot/footnote class constants). Each report **keeps its coloured
  header banner**; everything below (KPI tiles, table headers, spacing, footnotes) now
  comes from the kit so the reports read as one family. Deduped three copy-pasted
  `tile()` helpers (office-range, gift-cards, dealer funding); converted the dealer
  Sales Reps tiles + header; converted the Monthly report YTD tiles; standardized the
  table header row of StoreTable, LeaderboardTable, Finance, Lead funnel and Cycle
  times. Card/bar reports (store week, dealer snapshot, leads, product mix) keep their
  layouts; intentionally colour/tone-coded stats were preserved.
- **Dealer reports: four new high-level, printable/emailable tabs (own office).** The
  dealer "My reports" area gains, for **every dealer user** with report access (scoped
  strictly to their own office):
  - **Overall sales** — the office-range "Money put through" one-pager (month range).
  - **Funding** — deals **paid** to their office (see paid-basis below), **week or
    month** toggle, executive one-pager.
  - **Products & packages** — the product-mix report for their office.
  - **Salesperson leaderboard** — ranks **their own team** (reps for their office) by
    paid volume, deals and units.
  Each reuses the staff report builders scoped to `user.dealerId` (no cross-office
  leakage) and adds **Print / Save as PDF** and **Email to me** (new `ReportActions`
  + `emailDealerReport` server action — sends a link to the signed-in dealer's own
  account email only, rate-limited, audited; never a free-text recipient). New
  `.print-sheet` pages under `/dealer/reports/{overall-sales,funding,product-mix,leaderboard}`.
- **Funding report is now PAID-based (admin + dealer).** Both the admin funding
  report and the new dealer one count **paid deals only** — a **Payout** whose
  `paidOn` falls in the window (the actual dealer payout, incl. deals auto-paid from
  a Home Depot remittance / journal "Pay to dealer"), showing the **actual amount
  paid**, not the approved amount, and split payments summed per deal. Both gained a
  **week / month** toggle. "Awaiting payment" = funded/approved deals with no payout
  yet. Previously the report keyed off the FUNDED status event and used the approved
  amount. `fundingReport.ts` rewritten (payout-based, `monthWindow()`, optional
  `dealerId` scope); the weekly admin email now reports paid deals.
- **Rep reports now show UNITS SOLD, not just customers/deals.** Both per-rep
  reports previously counted one per deal (customer) and summed dollars — a rep who
  sold one customer 4 products showed as 1 deal, same as a 1-product sale. Now they
  also show **units sold**, read from the journal's **“# of units”** column (wired
  into `ReportDeal.units`; the column mapping existed but was never read). Deals and
  dollars are unchanged — units are **added alongside**.
  - **Staff → Reports → Leaderboard (Salesperson):** new Units KPI tile + Units
    column per rep (units on that rep’s paid-OK deals, matching the report’s basis).
  - **Dealer → Reports → Sales Reps:** new Units KPI tile + Units column. Portal
    applications carry no unit count, so units are sourced from the sales journal
    (`journalUnitsByRep()`), scoped to the office and range, matched to each rep by
    name (the journal “Dealer’s Name” column the portal writes into); returns (RB)
    excluded. Footnote explains the source.
- **Fix: Office range report showed a blank page on screen.** The executive
  rewrite wrapped the whole report in `.print-only`, which is `display:none` on
  screen (it's meant for print-only receipts like the payout slip) — so the report
  rendered but was invisible, leaving just the filter bar. Added a `.print-sheet`
  utility: visible on screen **and** isolates to a clean sheet when printing
  (Print / Save as PDF), and switched `OfficeRangeView` to it. No data/logic change.
- **Dealer Find-customer now searches the LIVE current-year journal (in-progress book).**
  Dealers could already find their own office's *closed*-year journal customers (the
  DB archive) and their portal deals — but a **current-year** deal that lives only in
  the live Google Sheet (e.g. a PENDING sale entered straight into the journal) was
  invisible in Find customer, even though it shows in the weekly store report. Root
  cause: the current year is deliberately never archived (it stays editable all year),
  and the dealer search never read the live sheet. Added `searchOfficeLiveJournal()`
  (`src/lib/journalArchive.ts`): reads the current (and any future) year live, attributes
  each row to an office with the **same matcher the import/weekly report use**
  (`buildDealerMatcher`: store number → alias → name token), and returns **only this
  dealer's own rows** (no cross-office leakage). Results show in a new
  "This year's sales journal (in progress)" section with the deal's result badge
  (OK / PE/OK / RB), **deduped** against portal deals already listed under "Your
  customers." Read-only; still gated by `isGlobalSearchEnabled()`; rate-limited and
  audited (the audit line now records the live-hit count). Staff/reviewer search
  already read the live sheet — unchanged.
- **New report — Gift cards by office (admin-only).** A per-dealer summary of how
  many gift cards were **sent** and the **dollar value**, plus what's still
  **pending** and how many were **cancelled**, with the date of the most recent
  card sent per office. The table is **sortable** (click any column header — sort
  drives the export too) and **downloadable as CSV**. Admin-only; shows in the
  Reports hub with the "Super Admin" badge. New `src/lib/reporting/giftCardReport.ts`
  (`buildGiftCardReport()`), `GiftCardReportView.tsx` (client, sort + CSV), and
  page at `/staff/reports/gift-cards`. Dollar figures are the requested/sent card
  values; "$ each dealer has" is read as **total $ sent** (there is no
  budget/balance field on the office — say the word if a remaining-budget column
  is wanted instead).
- **Monthly report: richer PE/OK pending snapshot + click-through to the deal.** The
  two pending-installation blocks (this month / earlier months) now expand each
  store to the individual pending deals **on desktop** — sale date, customer name,
  and product(s) sold — with the amount. Each deal **links to the customer's profile
  in the system** (`/staff/applications/<id>`) when its HD # matches a portal deal
  (resolved in one query; unmatched deals show without a link). Mobile keeps the
  compact store+total snapshot. `monthly.ts` now returns a `sales[]` drill-down
  (with resolved `appId`) on each `PendingStore`.
- **Remittances: duplicate fail-safe + delete button.** Auto-capture went live and
  produced a duplicate — a manual entry (placeholder doc # `20260911`) plus the
  webhook's real doc # (`2000133384`) for the same payment, which the doc-#-only
  dedupe couldn't catch. Added: (1) a **content-based dedupe** in `ingestRemittance`
  — before creating, it compares the sorted line signature (HD # + amount) and net
  total against recent remittances (45 days) and skips creating a repeat even when
  the document number differs or is absent; (2) a **Delete remittance** button on
  the remittance detail page (cascade-removes its lines) for clearing a duplicate
  or mistaken entry — it does **not** un-fund deals (money already recorded stays;
  it only clears the remittance bookkeeping), and is audited.
- **Office range report: executive styling + Print / Save as PDF.** The custom-range
  office report now reads as a one-pager — titled header (Georgian Water & Air,
  scope, date range, generated date), a row of KPI tiles (total put through, paid
  deals, average/month, best month), and a cleaner month × store/office matrix
  (zebra rows, tabular-aligned money, bold totals). Added a **Print / Save as PDF**
  button using the app's `.print-only` convention (prints just the report, no app
  chrome; landscape). `OfficeRangeView` + new `ReportPrintButton`.

## 2026-09-11
- **Auto-deploy pipeline live (GitHub → ECR → Elastic Beanstalk).** Added a deploy
  step to `.github/workflows/build-ecr.yml` (`einaregilsson/beanstalk-deploy`,
  bundling `Dockerrun.aws.json` + `.platform/`), and granted the `github-ecr-push`
  IAM user `AdministratorAccess-AWSElasticBeanstalk`. Every push now builds **and
  ships** — no more manual ZIP uploads. `wait_for_deployment: false` because the
  single-instance env intermittently reports Yellow on low traffic (EB "insufficient
  request rate"), which was false-failing the step even though the deploy succeeded.
- **Journal audit: appending columns at the far right is confirmed SAFE.** Full
  sweep of every sales-journal reader/writer (reporting reader, `journal.ts`
  read+write, paid-sync, journal importer, customer search, all report
  aggregators). All resolve columns by **header name**; the writer writes only
  single header-resolved cells (no whole-row/range writes, no fixed indexes); no
  fixed-index journal parser exists in the repo. The four new columns (Admin. Fee,
  Tax On Admin Fee, Reserve, **Pay To Dealer**) don't collide with any header
  keyword. Safe to roll out to all monthly tabs. (Read window is A1:BZ = 78 cols —
  ample.)
- **Payment receipt auto-fills from the journal (actual "Pay to dealer" amount).**
  When the journal row shows **Result = OK + a Date Paid**, the paid-sync
  (`journalPaidSync`) now also reads the new **"Pay to dealer"** column (the actual
  net amount paid — after admin fee / tax / reserve, which can differ from the HD
  calculator) and **auto-creates the dealer payout receipt** with that amount and
  the paid date, moving the deal from funding to **paid** (it already auto-advances
  to FUNDED). Guarded: only when an actual amount is present and **no payout exists
  yet** (never duplicates or overwrites a manually entered receipt). Older journals
  without the column are unaffected. `readDealJournalStatus` now returns
  `payToDealer`.
- **Confirmed cancellation writes "RB" to the journal with an explanation note.**
  When a reviewer confirms a dealer cancellation, the deal's journal row Result is
  set to **"RB"** and a **cell note** is attached on that cell explaining why:
  the reason, who confirmed it in the portal, which dealer user requested it, and
  the date (plus HD-refund/reviewer note if any). Best-effort + safety-gated (only
  writes if the row's Last Name still matches); the cancellation, requester,
  confirmer and reason are already recorded in the portal (DealCancellation +
  status event + audit), and the RB writeback is audited too. New
  `writeCancellationToJournal()` in `journal.ts`.
- **Reviewer entry view: values render in UPPERCASE for copy-into-finance-systems.**
  The reviewer's "Application — reviewer entry view" (and the pop-out full
  application / print view, which reuse the same component) now render the dealer-
  entered values in **UPPERCASE**, so when a reviewer copies a name/address/etc.
  into HD or a finance company's portal it comes out in caps (their convention).
  This uppercases the **actual string** (not CSS `text-transform`, which would copy
  back as original case). Done once in the shared `Field` component in
  `ReviewerEntryView.tsx` with a `raw` opt-out applied to **email** (applicant + co-
  applicant), where all-caps can break the address. Numbers/dates/amounts are
  unaffected; free-text notes stay as written. Display-only — stored data is
  untouched.
- **Remittance: split-payment deals only fund once fully paid (no more funding on a deposit).**
  A split-payment deal can be paid by Home Depot in more than one remittance (e.g.
  a $500 deposit, then the $9,500 balance). Previously the first matching line
  marked the whole deal FUNDED. Now `ingestRemittance` tracks the **cumulative HD
  dollars received per deal** (summed from the deal's remittance lines — same HD #,
  as confirmed) and, for a `isSplitPayment` deal, only marks it FUNDED once the
  total reaches the **expected HD payout** (`computeDealerPayout(...).payout`, i.e.
  the HD payout calculator) within a small tolerance (max of $2 / 1% — the
  calculator is an estimate; HD's actual cents can differ). An earlier partial
  payment instead nudges the deal to **In for funding**, adds an internal note
  ("PARTIAL payment $X of ~$Y expected"), and the reviewer deal page shows a
  **"Partially funded — awaiting the rest"** banner with received-vs-expected; the
  reviewer can still mark it funded manually. Non-split deals fund exactly as
  before. Implemented **without a schema migration** (no new enum value) — the
  "partially funded" state is derived from existing remittance-line data — to avoid
  a risky enum-on-boot migration on the live server; can be promoted to a true
  filterable status later if wanted. Remittance summaries now show a `partial` count.
- **Dealer uploads: void cheque optional + re-upload anytime (incl. after funding).**
  Two dealer-side fixes: (1) the **Void cheque / PAP form** funding doc is now
  **optional** (`required: false` in `FUNDING_DOCUMENT_TYPES`) so a missing one no
  longer blocks submitting the funding package. (2) Dealers can now upload funding
  documents through **FUNDED** (added `FUNDED` to `canUploadFunding` and to the
  `uploadFundingDocAction` / `uploadFundingBatchAction` status gates) — so a
  changed document can be re-sent after the deal is funded. The always-open
  "Documents for approval" section now carries a hint that updated/additional
  documents can be sent there anytime (via "Other"), which pairs with the new
  reviewer banner that surfaces post-completion uploads.
- **Reviewer deal page: banner for documents uploaded after a deal is completed.**
  A dealer can upload a file (e.g. a missing Bill of Sale) to a deal that's already
  funded/completed — it lands on the customer's file, but every phase read "Done"
  so nothing flagged it for the reviewer. The reviewer deal page now shows a
  prominent amber banner at the very top listing any dealer-uploaded document
  (APPLICATION/FUNDING stage) that arrived **after** the deal was finished with the
  dealer (past review — reviewerDone, or in/through funding), with view links,
  regardless of status. (Dealer uploads also already fire an email + push to
  reviewers via `notifyNewDocuments` — now that web-push is configured, that
  reaches phones too.) No schema change; computed from document timestamps vs the
  deal's completion time in `src/app/(staff)/staff/applications/[id]/page.tsx`.
- **New report: Office range (custom month span).** Deals → Reports → *Office
  range report*. Pick an office (or **All offices**) and a **From→To month span**
  (e.g. January → now, or the last two months) and get how much money that office
  put through, broken down **by month × store** (by office for the all-offices
  aggregate) with month totals and a grand total, print-ready per office. Money
  basis = **paid & received** (OK money dated by date paid), the same basis as the
  Monthly report, so the two reconcile. Reuses the journal reader + office/store
  scoping (`src/lib/reporting/officeRange.ts`, `OfficeRangeView`, page at
  `/staff/reports/office-range`). Standalone for now; a combined finance-penetration
  view can ride along later.
- **HD remittances: upload the PDF straight in the portal.** New "Upload the HD
  remittance PDF" box on Deals → HD Remittances. The portal extracts the text from
  Home Depot's "Remittance Advice" PDF, parses the invoice rows (HD #, invoice
  date, net amount — a negative net is a chargeback) and the document number /
  payment date, and processes it exactly like a pasted or webhook remittance
  (idempotent by document #). No Google dependency; works from a phone. The raw HD
  PDF carries no customer names, so lines show HD # + amount (matching to a deal is
  by HD # regardless). New `parseHdRemittanceText()` in `src/lib/hdRemittance.ts`
  (verified against a real advice: 10 rows, $49,605.53, doc# 2000133384),
  `ingestRemittancePdfAction`, and `UploadRemittanceForm`. Note: auto-funding still
  only matches lines whose **HD Customer # is on the deal** — a remittance whose
  deals lack their HD # will show those lines as "unmatched" for a reviewer to fix.
- **Push notifications now read the VAPID public key at runtime (no rebuild trap).**
  Desktop/phone push (Account → Desktop & phone notifications) was showing
  "Notifications are not configured on the server yet" because the browser read the
  public key from a **build-time** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — the same
  inlining trap that made the EN/FR toggle vanish after a rebuild. The client now
  fetches the key at runtime from a new endpoint (`GET /api/push/key`, session-
  gated; returns `{ key }` from `VAPID_PUBLIC_KEY`), so setting the key in the
  server env takes effect immediately and survives every future image rebuild.
  **To go live it needs a VAPID keypair set on Elastic Beanstalk** (runtime env,
  no rebuild required once this image is deployed):
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and optionally
  `VAPID_SUBJECT=mailto:portal@ghsbarrie.ca`. Generate a pair with
  `npx web-push generate-vapid-keys`. The public key is not secret; the private
  key must never be committed. iOS requires the portal be installed to the Home
  Screen (iOS 16.4+) before it can receive push. `pushEnabled()` and the send
  paths already read `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, so no other change is
  needed. **Operational status: ⏳ pending — keypair not yet set on EB.**

## 2026-09-10
- **PDF preview restored on AWS (docker image was missing node-canvas libs).**
  In-app PDF preview — the tap-to-open scrollable page view **and** the little
  first-page thumbnails on document tiles — is rendered server-side by `pdf-to-img`,
  which depends on **node-canvas**. The AWS runtime image (`node:20-bookworm-slim`)
  only had `openssl / ca-certificates / curl`, so node-canvas couldn't load: every
  PDF render threw, thumbnails fell back to a plain "PDF" glyph, and the page
  preview errored out to **download-only** (reported on the reviewer's "Review
  signed documents" step — files wouldn't open without downloading). Added the
  node-canvas runtime libraries + a base font to the Dockerfile runtime stage
  (`libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2
  libpixman-1-0 libfontconfig1 fontconfig fonts-dejavu-core`). Verified node-canvas
  renders once these are present. **Needs the image rebuilt + redeployed** (the
  packages are baked at build time). This did not affect Render, which runs the
  Node runtime, not this Dockerfile.
- **Reviewer edit form now covers financing — "edit everything".** The reviewer's
  Edit deal form (reached from the new **Edit deal details** button on Review &
  decide) already covered the applicant, address, ID, employment/income, sales
  details and products; it now also has a **Financing** section: **payment method,
  finance company, loan / approval number, and HD Customer #**. So a deal that came
  in on the wrong payment method or with no finance company can be corrected in one
  place. Saving an edit now also **re-syncs the sales journal** for any deal that's
  already been written there (amounts, products, finance company and numbers all
  appear in the journal), so a correction doesn't leave the sheet stale.
- **Reviewer "Review & decide" tab: reordered + finance-company fix.** Rebuilt the
  order of the first reviewer tab (both Flow and Tabs views) to how the deal is
  actually worked: **Write-to-journal button at the top**, then the customer
  information, an **Edit deal details** button, the payment breakdown / deal
  numbers / application documents, and finally the **Decision area folded away at
  the bottom** (collapsed by default — it's the least-touched part once a deal is
  moving; one tap to expand). Also fixes the reported bug where a deal submitted as
  an Express FinanceIT deal showed a **blank "Finance company"**: an Express deal
  records its financing source as a *payment method* (FinanceIT / HD card / cash),
  which never populated `financeCompanyId`. New `financeCompanyDisplay()` helper
  maps it through (FinanceIT → "FinanceIt", Home Depot card → "HDCC", cash-type →
  "… — not financed"); applied on the reviewer snapshot and the detailed entry
  view. The **payment method is now always listed** on the reviewer side. And the
  approval gate no longer falsely flags an Express FinanceIT deal as "missing a
  finance company" (the payment method now counts as the finance source; genuinely
  non-financed deals need neither a finance company nor a loan number to approve).
- **FinanceIT deals: signed finance contract no longer mandatory.** When a deal is
  auto-approved on a FinanceIT loan number, the dealer submits the signed finance
  package to FinanceIT directly — so the portal no longer *requires* a
  "Signed finance docs" upload to move the deal forward. The upload box stays
  available (marked *optional*) in case they want a copy on file, but it no longer
  blocks funding submission or the reviewer's verification gate.
- **Support chat: clearing a thread re-engages the AI.** A support thread that was
  ever handed off to a person ("Talk to a person") sets `awaitingHuman`, which
  correctly makes the assistant stand down — but the "clear/trash" button deleted
  the messages without resetting the flag, so the AI went **permanently silent**
  in that thread even after clearing. `clearSupportConversation` now resets
  `awaitingHuman`, so clearing truly starts fresh and the assistant answers again.
- **Deal page: "Documents for approval" collapses once it's done.** After a deal
  is approved (or further) and the approval docs are uploaded, that uploader now
  folds to a one-line summary ("N submitted ✓") instead of showing a full
  dropzone — one tap to reopen. New reusable `CollapsibleSection` component; wired
  on the dealer application page via an `approvalDocsDone` check.
- **PDF paperwork cards show a real first-page thumbnail.** The "Paperwork for
  Customer" cards rendered a generic red "PDF" ribbon; they now use the existing
  server-rendered thumbnail (`/api/documents/[id]/thumb` — image downscale / PDF
  first page) so each file previews as its actual page, matching the deal-document
  tiles. Falls back to the stylized ribbon if a preview can't be produced. New
  `src/components/PaperworkThumb.tsx`; `PaperworkCards` swapped to it.
- **System health: live AI-assistant (Anthropic) check.** Added an "AI assistant
  (Anthropic)" row to Admin → System health. It exercises the **real chat path** —
  a 1-token Messages API call with the *configured* model — so it catches
  model-access problems a key-only check misses (a valid key can still lack access
  to the configured model, which makes the chat silently return nothing). Green
  when the model actually generates; red with the exact HTTP status/error on
  failure; on a model 404 it lists the models the key CAN use and points at
  `ANTHROPIC_MODEL`; "not set" when no key. New `pingAi()` in `src/lib/ai.ts`,
  `checkAi()` wired into `src/lib/health.ts`.
- **AWS cutover progress.** App is live on AWS (Elastic Beanstalk, ca-central-1)
  behind CloudFront (HTTPS) with the RDS DB, S3, and SMTP all green; login works
  end-to-end. Fixed a CDN login bounce by having `createSession` emit a single
  Set-Cookie. Google Workspace (leads/journals) + AI/DeepL/cron env loaded onto
  EB. Still to do: `NEXT_PUBLIC_*` rebuild (maps/push/i18n baked at build) and the
  GoDaddy DNS flip. See `docs/AWS-CUTOVER-PROGRESS.md`.

## 2026-09-09
- **AWS migration prep — container build files.** Added a root `Dockerfile`
  (multi-stage, Node 20, exposes the `NEXT_PUBLIC_*` build args, runs
  `scripts/start.sh`) and `.dockerignore` so the app can be built for ECS Fargate
  in `ca-central-1` — co-locating compute with the RDS DB + S3 to kill the
  US↔Canada round trip that makes pages slow. **Render is unaffected** (it uses
  `runtime: node`, not this Dockerfile). Full cutover in `docs/AWS-MIGRATION.md`.
- **Funding report + deal-status search (`/staff/reports/funding`).** A weekly view
  of deals funded (including deals auto-funded from an HD remittance), grouped by
  office with per-office totals, a funded-value figure, and an approved-but-not-yet-
  funded pipeline count; week-by-week navigation. Below it, a **search deals by
  status** filter — pick any status (Funded, Approved, Problem, Withdrawn, …) to
  pull the current list with counts and approved-value totals. Internal (staff);
  dollar figures never reach dealers. Reads portal data (FUNDED status events), so
  it stays accurate as remittances auto-fund deals. New report card + `fundingReport.ts`.
  - **Weekly email:** `sendWeeklyFundingReport()` + cron `/api/cron/weekly-funding-report`
    email last week's funding summary to admins (schedule Monday ~9am — added to the
    go-live checklist).
- **Home Depot remittance → auto-fund (`/staff/remittances`).** When HD pays
  (Mon/Wed/Fri), the remittance's invoices are matched to deals by HD # and matched
  deals are marked **Funded** automatically. **All dollar figures stay internal —
  a dealer never sees a remittance amount** (funding shows only as the "Funded"
  status, with a money-free status event). **Chargebacks** flag the deal (internal
  note) for the refund flow; **unmatched** lines surface an attention count.
  - Two intake paths: an **idempotent webhook** `POST /api/hd-remittance/ingest`
    (Bearer `CRON_SECRET`) the existing Google remittance script can POST to (see
    `docs/HD-REMITTANCE.md` for the ~15-line addition), **and** a **manual paste**
    form (HD ID, amount, name — negative = chargeback).
  - New `HdRemittance` + `HdRemittanceLine` models + migration; matching/funding
    engine `src/lib/hdRemittance.ts`; reviewer/admin list + per-remittance detail;
    new admin section `remittances`. Reuses `CRON_SECRET` (no new env var).
  - **Still to come (discussed):** a pullable weekly funding report + a broader
    deal-status search/report.
- **Cancellations queue (`/staff/cancellations`).** A sortable view of every deal
  a dealer asked to cancel, with tabs: **Refund pending** (funded deals awaiting
  the HD refund — the "what still needs refunding" list), **Awaiting review**,
  **Installed & cancelled** (funded then cancelled), **Before install**, and All.
  Each row shows customer, dealer, reason, uninstall date, HD-refund status and a
  link to the deal. New admin section `cancellations`; also linked from the staff
  Deals dashboard. Reviewer + admin access.
- **Deal cancellations — dealer requests, reviewer confirms.** Dealers can now
  cancel a deal from its detail page (near the status). A cancellation is a
  **request that a reviewer must confirm** before it finalizes — it is never
  closed by the dealer alone.
  - **Before install / funding:** dealer gives a reason → reviewer confirms → the
    deal is set to **Withdrawn**.
  - **After funding:** the dealer also records the **equipment uninstall date**;
    because the deal was paid, it's flagged to reviewers as a **priority** and the
    reviewer must tick **"Home Depot refund processed"** before confirming. On
    confirm the deal is Withdrawn and the dealer is told the refund is confirmed.
  - Every step (request + reason + uninstall date, reviewer confirm/reject + HD
    refund) is written to the deal's **note trail**, so it lives on the customer
    file and both sides see it. New `DealCancellation` model + migration; new
    `notifyCancellationRequested`/`notifyCancellationResolved`. Reason required;
    reopening is staff-only (a reviewer can reject a request). `WITHDRAWN` (already
    a terminal status everywhere) is reused, so cancelled deals drop out of
    reminders, SLA and paid-sync automatically.

## 2026-09-08
- **Finance-app scan: hardened date parsing + "double-check" flags on shaky reads.**
  The credit-app scanner's date converter only understood `MM/DD/YYYY` (slash/dash)
  and `YYYY-MM-DD` — so a Financeit form printing the date with **dots**, a **written
  month**, a **2-digit year**, or **year-first with slashes** left Date of birth /
  ID expiry **blank**. Replaced it with a shared, tolerant parser
  (`src/lib/dateparse.ts`, unit-tested) that reads all those shapes. It also reports
  when it had to **guess** the day/month order (e.g. `03/12` = Mar 12 vs Dec 3) or a
  2-digit year, and `/api/scan-doc` now returns an `uncertain` list combining those
  guesses with **low Textract OCR confidence** (< 88%). The new-customer form shows
  a **"⚠️ Double-check: Date of birth, …"** note in each section's confirm banner so
  the dealer knows exactly which scanned fields to verify.
- **Dealer Business Documents — self-serve compliance vault with auto-scanned expiry + renewal reminders.**
  Dealers upload their WSIB / WCB clearance (and any other document with a renewal
  date) at **Dealer → My office → Business documents** (`/dealer/documents`). On
  file select the portal **scans the document and pre-fills the expiry/renewal
  date** (and any account number) — on-prem via the PDF text layer with a tesseract
  OCR fallback (`/api/scan-expiry`, `extractExpiryDate` in `docanalysis.ts`); the
  dealer confirms it. A scheduled job then **emails + pushes the dealer one week
  before expiry** (configurable) and again weekly through expiry/overdue until the
  document is replaced, so GWA no longer has to chase paperwork
  (`src/lib/docReminders.ts`, `/api/cron/doc-expiry-reminders`).
  - New `DealerDocument` model + migration `20260908170000`. Required document
    "slots" (WSIB, WCB) live in `BUSINESS_DOC_TYPES` (`constants.ts`) and are easy
    to extend; dealers can also add free-form "Other" documents (insurance, CSST,
    RBQ, trade licences).
  - Admins get a **compliance dashboard** at **Admin → Dealers → Dealer documents**
    (`/admin/dealer-documents`): every active office × required document with
    Expired / Not-uploaded / Expiring-soon / Current status and a View link. New
    admin section `dealer-documents`.
  - Files are stored encrypted at rest like all uploads and streamed back only to
    the owning dealer or staff (`/api/dealer/documents/[id]/file`).
  - **⚠️ Go-live step:** add a Render Cron Job hitting
    `POST /api/cron/doc-expiry-reminders` with `Authorization: Bearer $CRON_SECRET`
    (once or twice daily) — see `docs/GO-LIVE-CHECKLIST.md`. Until then, reminders
    won't fire (uploads + the dashboard work regardless).
- **Marketplace: per-size part numbers, shipping method, and a shipper packing-slip PDF.**
  - Apparel part numbers change by size, so each size now carries its own part
    number. Admin item editor replaces the old comma "Options" box with **per-size
    rows** (size + its part number); the base "Part number" is the fallback for
    sizeless items. New `MarketplaceItem.optionSkus` (index-aligned with `options`;
    migration `20260908150000`). The dealer order resolves the chosen size's part
    number (falls back to the base) onto the order line.
  - Dealers pick a **shipping method** at checkout (Standard ground / Rush-express
    / Courier / Pickup). Stored on `Order.shippingMethod` (migration
    `20260908160000`), shown in the admin orders list.
  - The order email to the shipper now carries a **Ship-to block** — dealer/business
    name, shipping address (from `DealerProfile.shippingAddress` → `address`), phone
    + alt phone — plus the shipping method, and a **print-ready packing-slip PDF**
    attachment (`src/lib/orderPdf.ts`) they can print and pack straight from.
- **Reports: "All offices" (company-wide) option + leaderboard tidy-up.**
  - The office selector on Finance penetration, Product mix and the Salesperson
    leaderboard now has an **All offices** choice (aggregates every office), shown
    to users with cross-office access (`canViewDealerSnapshot`). New `reportStoreScope`
    helper in `monthly.ts`.
  - **Salesperson leaderboard is now Admin-only** (per Sean — the rep data still
    needs organising) and **groups near-duplicate rep names**: "Nick F" ≈ "Nick.f"
    (case/punctuation-insensitive) and "Brynn/Alex" ≈ "Alex/Brynn" (order-insensitive).
    Each row that combines spellings shows a badge and **expands to list the merged
    spellings + their deal counts**, so an accidental merge is easy to catch.
    (`salespersonLeaderboard.ts` `repKey`, `LeaderboardTable.tsx`.)
- **New-customer hero image** wired to `public/new-customer-hero.webp` (uploaded).
- **Salesperson leaderboard now runs on the full journal (not portal-only).** The
  journal reader was never mapping the rep column, even though the journal *write*
  code (`journal.ts`) already used it — the header is **"Dealer's Name"**. Added
  that column to the reader (`journalRead.ts` `FIELD_CANDIDATES` + `ReportDeal.salesperson`)
  and rebuilt `buildSalespersonLeaderboard` on `readJournal` (paid-OK deals per
  office/year, grouped by rep). No migration needed — office reports read the sheets
  live. Dropped the "portal deals only" label; the leaderboard now covers every year
  the journals are connected. Columns: rank, rep, deals, avg deal, volume (+ a note
  for deals with no rep named).
- **Three new reports (separate pages on the Reports hub).**
  - **Product mix & attach rate** (`/staff/reports/product-mix`) — per office/year:
    total deals, average products per deal (attach signal), and each product's deal
    count, share % and $. Journal-based.
  - **Salesperson leaderboard** (`/staff/reports/leaderboard`) — reps ranked by
    funded volume, deals, win rate, avg deal. **Portal-submitted deals only** (the
    journal has no rep field) — clearly labelled in-page.
  - **Lead → sale funnel** (`/staff/reports/lead-funnel`, leadership-gated) — HD
    leads → contacted → booked → sold with conversion %, overall and per office;
    reuses the leads call-outcome data.
  All three bilingual (EN/FR). (`productMix.ts`, `salespersonLeaderboard.ts`,
  `reports/product-mix|leaderboard|lead-funnel/`, hub cards.)
- **Super Admin: full customer-data export (CSV).** Admin → Security now has a
  Super-Admin-only "Export all customer data" button: one row per deal with every
  stored field, and the encrypted PII (SIN, DOB, address, banking, gov ID, income,
  co-applicant) **decrypted** on the way out. Confirmation step before download;
  the server route re-checks Super Admin and writes a `DATA_EXPORT` audit entry with
  the record count. (`api/admin/full-export/route.ts`, `security/FullExportButton.tsx`.)
- **New report: Finance penetration.** Per office / year, shows how paid deals were
  financed — a penetration % (financed ÷ total), financed vs cash counts and volume,
  a payment-method breakdown (Financeit/loans vs cash vs other, with bars), and a
  per-store penetration table. Same money basis as the monthly report (OK by date
  paid). New card on the Reports hub. (`financePenetration.ts`, `reports/finance/`.)
- **Reports: click a store to see the sales behind it.** In the monthly report,
  clicking a store row (e.g. 7024 — Barrie) now expands the individual paid-OK
  sales that make up its "This month" number (customer, product, date, amount).
  Each sale links to **Find a customer** pre-filled by phone/name so the reviewer
  can open that customer. The store table moved into a client component
  (`StoreTable.tsx`); `buildOfficeMonthlyReport` now attaches per-store `sales[]`,
  and `find-customer` accepts `?q=` to run a search on load. (`monthly.ts`,
  `MonthlyReportView.tsx`, `StoreTable.tsx`, `find-customer/page.tsx`,
  `CustomerSearch.tsx`.)
- **Marketplace: uniform product tiles.** Product image tiles used `aspect-square`,
  so their height tracked card width — and the New Arrivals rail gave cards variable
  widths, making every image a different height. Images now use a fixed height
  (`h-56`) so every tile is identical, and rail cards are a fixed width (`w-64`).
  Combined with the grid/flex row stretch, all cards in a row are the same size.
  (`MarketplaceOrderForm.tsx`.)
- **Financeit PDF fill fixed — values now land on the right lines.** The generated
  "Loan Application" PDF was stamping every value at the left margin one row too
  low, so each value collided with the next label. Re-measured the template's label
  positions and now place each value on the dotted line to the right of its label,
  on the same baseline. Housing status is ringed with an ellipse over Own/Rent/Other.
  Also fixed a co-borrower bug: the second page was copied AFTER the primary was
  stamped on it, so the co's fields overlapped the primary's — now the blank page is
  copied first. Verified by rendering primary + co pages. (`src/lib/financeit/fill.ts`.)
- **Scan confirm moves into each section.** The "confirm the scanned info is
  correct" checkbox now lives in the header of the very section a scan filled
  (Applicant, Address, Employment, Co-applicant) instead of a single panel at the
  bottom — so dealers verify in place. Submit is still blocked until every scanned
  section is ticked; a failed submit turns the unconfirmed section's control amber
  and scrolls to the first one. (`NewApplicationForm.tsx`,
  `newApplication.verifyScanConfirmShort/…ConfirmedShort`.)
- **Driver's-licence scan is now photo-only (barcode reader removed).** The
  on-device PDF417 back-barcode scanner and live-camera flow were removed — reads
  weren't reliable enough. "Scan driver's licence" now takes/uploads a photo of the
  **front** and reads it via Textract AnalyzeID. NOTE: AnalyzeID may not be offered
  in `ca-central-1`; set **`TEXTRACT_ID_REGION`** (e.g. `us-east-1`) in Render to
  switch it on — that processes the licence image in that region (never stored). See
  `docs/ID-SCAN.md`. (`LicenseScan.tsx`, `api/scan-id/route.ts`, `WelcomeTour.tsx`.)
- **Customer search: selling office's address on the card.** The office that sold
  the equipment now shows its **saved address** (📍) next to its phone — on the
  journal "office to contact" block (staff/internal search) and the dealer
  cross-office "registered with another office" card. Address is pulled from
  `DealerProfile.address` (set at Dealer → Profile → Business address; blank
  offices simply show no address line). Added `dealerAddress`/`officeAddress` to
  the `JournalMatch`/`OtherOfficeMatch` result types and `address` to the dealer
  contact lookup. (`customerSearch.ts`, `CustomerSearch.tsx`.)
- **Gift-cards hero copy updated.** Dealer page (EN/FR) now reads "Enter your $25
  HD gift card customer information. All HD gift cards are sent out by Guusto — this
  allows for safe delivery and tracking of the customer's card." The staff/reviewer
  page keeps its processing note but now leads with the same Guusto safe/trackable
  framing. (`giftCards.heroSubtitle` in `en.ts`/`fr.ts`; `staff/gift-cards/page.tsx`.)
- **Desktop sidebar runs the full page height.** The dark nav column was fixed at
  one screen tall (`h-[calc(100vh-72px)]`, sticky), so on any page taller than the
  viewport (e.g. the dashboard) it stopped partway down and the light page
  background showed below it. The gradient now sits on a full-height wrapper that
  matches the content height, while the nav itself stays sticky and one screen
  tall — no more abrupt cut-off. Applied to both the dealer (`DealerShell`) and
  reviewer (`StaffShell`) shells.
- **Auto-fill: one clean "Scan driver's licence" action.** Dropped the standalone
  "Upload a photo" button from the licence scanner (primary + co-applicant), so it
  matches the single-button "Scan a filled credit app". Upload remains as a
  fallback only if the camera can't open, and inside the scanner overlay.
  (`LicenseScan.tsx`.)
- **Mobile: stop iOS zoom on the message composers.** The "Write a message…"
  box in deal/support conversations (`ConversationThread`) and the gift-card
  thread composer (`GiftCardThread`) were 14px/12px, so iOS Safari force-zoomed
  the page on focus. Both now render at 16px on phones (unconditionally, not via
  a media query, so it holds even if the global phone rule doesn't match), and
  keep their compact desktop size (`sm:text-sm` / `sm:text-xs`). Complements the
  existing global 16px-on-phones rule in `globals.css`. NOTE: if the page still
  zooms after deploy, it's the cached stylesheet — hard-refresh / clear website
  data (or reopen the installed app).

## 2026-09-07
- **New application: confirm-what-you-scanned gate before submit.** Because a
  driver's-licence barcode or a photographed credit app can be misread, any
  section a scan actually filled now raises a checkbox in a "Confirm the scanned
  details" panel above Submit — Applicant name & ID, Home address, Employment &
  income, and Co-applicant details. The deal can't be submitted until every
  scanned section is ticked; trying shows an amber reminder and scrolls to the
  panel. Re-scanning a section clears its earlier confirmation. Bilingual
  (EN/FR). (`NewApplicationForm.tsx`, `en.ts`/`fr.ts` `newApplication.verifyScan*`.)
- **Admin: new-user invite email in English or French.** Adding a user (Admin →
  Users) now has an **Invite email language** dropdown (English / Français); the
  welcome/login email (subject, greeting, Web address / Username / Temporary
  password labels, sign-in button, security footer) renders in the chosen
  language. French uses fr-CA wording and the correct "Georgian Water & Air" name;
  the English subject was corrected from "GWA" to "Georgian Water & Air".
  (`src/app/(admin)/actions.ts`, `UserForm.tsx`.) The self-serve access-request
  approval email is still English-only (follow-up).
- **New application: sections stay minimized until an option is picked.** The form
  now opens with only the "Start here" 1/2/3 picker (no method pre-selected) plus a
  prompt; choosing Express/Priority/Standard reveals the sections that option needs
  (`{method && (…)}` wraps everything below the picker; `method` state is now
  `Method | ''`). The Auto-fill bar sits at the top of the revealed sections.
- **New application: top "Auto-fill" bar (all flows) + credit-app photo scanner.**
  Moved the licence scan out of Borrower identification into an "Auto-fill this
  application" bar at the TOP of the form, shown in every entry method (Express/
  Priority/Standard); shared `fillBorrower` (BorrowerAutofill, `src/lib/autofill.ts`)
  fills whatever fields the current method shows. Added a **"Scan a filled credit
  app"** button (`DocScan` → `/api/scan-doc`, AWS Textract FORMS OCR) that reads a
  photo/PDF of a completed application and fills the fields; image processed in
  memory, not stored. **Needs AWS:** the credit-app scanner (and the licence
  front-photo fallback) require `textract:AnalyzeDocument`/`textract:AnalyzeID` on
  the app IAM role in ca-central-1; until enabled the button says so and the
  on-device licence barcode scan still works with no AWS.
- **New application: co-applicant licence scan + pre-filled Financeit PDF.**
  The licence scan is now also on the Co-applicant section (fills the co-borrower's
  name/DOB/ID/address; `DateOfBirthInput` `gwa:setdate:coDob` hook + a deferred
  effect since `coFirstName` is controlled). Added a "Download Financeit PDF"
  button (Priority flow, by Submit) that stamps the on-screen values (primary +
  co-borrower) onto the real Financeit loan-application template
  (`public/financeit-loan-application.pdf`) at coordinates derived from the
  template's own label positions (`src/lib/financeit/fill.ts`) — a co-borrower
  gets a second page with "applying with <primary>". Runs entirely in the browser
  (no data leaves the page). SIN is left blank (not on the portal form). Alignment
  may need per-field coordinate nudges after a real-device check.
- **New application: driver's-licence scan → autofill.** On the Priority/typed
  new-customer form (Borrower identification), a "Scan driver's licence" button.
  Primary path is on-device: photograph the BACK, decode the PDF417 barcode in the
  browser (`@zxing/library`) and parse AAMVA (`src/lib/aamva.ts`) — exact fields,
  image never leaves the device. Fallback: if no barcode reads, the image POSTs to
  `/api/scan-id` (AWS Textract AnalyzeID) which returns fields and **stores
  nothing**. Autofills ID type/number/province/expiry, first/middle/last name,
  DOB, address/city/province/postal; dealer reviews before submit. Email/phone/
  SIN/income stay manual (not on a licence). `DateOfBirthInput` gained a
  `gwa:setdate:<name>` custom-event hook so the scan can set the controlled DOB.
  **Ops:** the Textract fallback needs `textract:AnalyzeID` on the app's IAM role
  (and AnalyzeID available in the region); until then the route returns
  `not_enabled` and the on-device barcode path works alone.
- **Journal archive: 2024 store-name → store-number resolver + preview/guard.**
  The 2024 book records the HD store as a CITY name (column F "HD Store" =
  "BARRIE", "PARRY SOUND") instead of the 4-digit number 2025+ use, so archived
  2024 rows showed Store "—". On import, `journalImport` now resolves a city name
  to its store number via an exact, normalized match against the portal's
  `HomeDepotStore` list — cities not in the list (OTTAWA, SUDBURY, …) or ambiguous
  names are left as-is, never guessed. Also added `previewJournalYear`
  (dry read: rows/matched/skipped-tabs/grouped issues/sample) and an
  overwrite guard (refuses to replace a good archive with a zero/<50% parse unless
  forced) so DB uploads stay correct across the journals' year-to-year layouts.
  Search already files 2024 customers under their office via the sheet's "Office:"
  metadata, so they were searchable regardless; this fills in store numbers.
- **Journal archive: in-portal Upload/Re-sync for fast office customer search.**
  Office customer search already reads a Postgres archive (`JournalRecord`), not
  live Sheets — but that archive could only be filled by a CLI script. Added a
  shared importer (`src/lib/reporting/journalImport.ts` — `importJournalYear`,
  delete+bulk-insert replace; `archiveStatus`) used by both the CLI
  (`scripts/import-journals.ts`, refactored) and a new **admin UI** on staff →
  reports → Connection ("Customer search archive": per closed year, rows/matched/
  last-uploaded + Upload/Re-sync). Admin-only action `importJournalYearAction`
  (audited `JOURNAL_ARCHIVE_IMPORT`). **The current year is never archived** — it
  stays a live read so it can be adjusted all year (`importJournalYear` refuses
  `year >= currentYear`). No new table/migration — reuses existing `JournalRecord`.
  Search still gated by `isGlobalSearchEnabled()`. See BUILD-FACTS "Journal archive
  & office customer search".
- **Heroes: image slots for Applications & New customer.** Both `SectionHero`s now
  accept a background photo like the other tabs. Drop `public/applications-hero.webp`
  and `public/new-customer-hero.webp` (wide ~1920×640 WebP) and they fill each hero
  with the standard feather/scrim treatment; until then the plain navy gradient
  shows (no breakage).
- **Dealer nav: collapse toggle moved into the sidebar** (ChatGPT-style), out of the
  top header. The desktop sidebar already collapsed to an icon rail; only the
  control's location changed.
- **Reports: Home Depot–orange KPI band + mobile fix.** The Monthly performance
  summary strip (This month / vs last month / Year to date) is now a bold HD-orange
  (#F96302) band with white numbers and depth. Fixed the mobile clip where the big
  "This month" figure overflowed its narrow column — on phones it now spans full
  width with the two comparison stats side-by-side beneath it. Store-number chips
  (7024, etc.) recoloured to the same HD orange so the accent ties together.
  Shared `MonthlyReportView`, so staff reports get the same treatment.
- **Assistant: new "Products" knowledge tab + no more "use Mail".** Added a
  **Products** area to the AI assistant knowledge panel (models, specs, features,
  pricing notes, links) — applied automatically when a dealer chats from the
  Product Library / Resources (`/dealer/resources*`), and available for product
  questions elsewhere. Also removed every "message the reviewer team via Mail"
  cue from the assistant's guidance: deal/reviewer questions now route to this
  chat (a teammate can jump in), and the assistant no longer mentions or links a
  Mail page. (`src/lib/settings.ts`, `AssistantKnowledge.tsx`, `ai.ts`,
  `ChatWidget.tsx`.)
- **Chat: assistant links dealers straight to the right portal page.** The
  assistant now knows every dealer page URL (Product Library, Resources, HD
  Promotions, HD Credit Card, Marketplace, Leads, Calculator, etc.) and, when an
  answer points somewhere in the portal, includes a clickable link to it. Chat
  message text now renders markdown links, bare URLs, and internal `/dealer/…`
  paths as tappable links (internal → same tab, external → new tab); plain
  messages render exactly as before. (`src/lib/ai.ts`, `AutoTranslate.tsx`.)
  Note: the assistant can *link* to the Product Library but doesn't yet read its
  entries — for it to quote a specific product, put that in a knowledge box.
- **Chat: no more iOS zoom on the message box.** The chat input is now 16px
  (`text-base`) — iOS Safari force-zooms the page whenever a focused input is under
  16px, which is what made the widget jump/clip on mobile. Keep chat inputs ≥16px.
- **Chat: handoff gated behind an actual question.** The **Talk to a person**
  button stays hidden until the dealer has sent a message *and* the assistant has
  replied — so the AI always gets first crack (it can usually answer instantly)
  instead of being skipped by a one-tap escalation.
- **Chat: "Talk to a person" handoff + hide empty deal chats.** Dealers get a
  **Talk to a person** button in the support chat: it flags the thread for the
  team, posts a "we've told the team" note, and **pauses the AI assistant**
  (`Conversation.awaitingHuman`, migration `20260907040000_conversation_awaiting_human`)
  until a real teammate replies (which clears the flag). Also: empty deal threads
  (auto-created placeholders like a new deal with no messages) no longer clutter
  the dealer's chat list — they only appear once there's a message.
  `POST /api/chat/request-agent`.
- **Chat: "Clear chat" to reset a support thread.** A trash button in the support
  chat header (dealer or staff) wipes that thread's messages so conversations
  don't pile up — and clears the assistant's "a teammate is active" state. Only
  General support threads can be cleared (deal threads keep their history).
  `POST /api/chat/clear`. Also fixes the stuck test threads where messages
  mis-stamped as staff (from the earlier impersonation bug) kept the assistant
  silent.
- **Fix: AI assistant gave no reply in "view as dealer" (real root cause).**
  Impersonation was only applied when `x-pathname` was a `/dealer/*` route, but the
  chat calls `/api/chat/*`, so on those requests the admin was treated as staff —
  the assistant endpoint bailed at its "acting as staff" guard before ever calling
  the model (hence no error in logs), and messages were stamped `fromStaff`.
  `requestIsDealerPortal()` now also honours the **Referer** for `/api/*` calls, so
  a dealer-portal page hitting an API is correctly scoped to the impersonated
  dealer. (This also correctly scopes other admin API calls made while viewing as
  a dealer.)
- **Chat assistant: Q&A memory + human-approved learning loop.** Every assistant
  Q&A is now logged (`AssistantQa`, migration `20260907030000_assistant_qa`),
  tagged by area, with answers where it deferred to a teammate flagged as gaps.
  Admin → System health gets a **"What dealers are asking"** panel: review recent
  questions, filter to gaps, and **one-click "Add to knowledge"** promotes a good
  answer into that area's knowledge — so the assistant improves over time with
  admin approval (not autonomous learning, which is risky for a bot touching
  credit/money). Remove clears a logged item.
- **Chat assistant: context-aware, per-area knowledge.** The assistant now knows
  which part of the portal a dealer is chatting from (Marketplace, a Deal, Leads,
  Gift cards, or General) and answers from that area's knowledge — so Marketplace
  support behaves differently from Deals support. Admin → System health → team
  knowledge is now **tabbed by area**; General always applies and the area's text
  stacks on top. The widget passes the current section; the prompt gets a "the
  dealer is currently in …" hint. New settings keys `ai.knowledge.*`; the existing
  general knowledge carries over. (Next: a Q&A memory + review/promote loop so the
  assistant improves with your approval.)
- **Chat assistant: fix — no replies while "viewing as dealer".** An admin using
  "View as dealer" keeps `role: ADMIN` with `impersonating: true`, so their chat
  messages were stamped `fromStaff` — which made the assistant treat them as a
  teammate handling the thread and stay silent (and mis-read their messages as its
  own turns). Now an impersonating admin counts as the dealer for chat:
  `postChatMessage` sets `fromStaff = internal && !impersonating`, and the
  assistant endpoint only skips for genuine staff. Also added server-side logging
  of Anthropic API failures (status/model) so silent failures are diagnosable in
  Render logs.
- **Chat assistant: default model → Sonnet 5.** Switched the assistant default
  from Haiku 4.5 to `claude-sonnet-5` for sharper, more impressive launch-quality
  answers (still inexpensive). Override anytime with `ANTHROPIC_MODEL` in Render.
- **Admin: "View as dealer" no longer lands at the bottom of the page.** The
  server-action redirect kept the admin list's scroll position; a `ScrollTopOnMount`
  in the dealer layout now resets to the top when entering the dealer area.
- **Admin: Georgian Water & Air pinned to the top of the Dealers list.** The list
  is newest-first, so the house office sat far down; any account named "Georgian
  Water …" now floats to the top (most-used "View as" target). Stable sort keeps
  newest-first within the rest.
- **Chat assistant: reliable replies + "trainable" knowledge + cost estimator.**
  Three changes: (1) **Reliability** — the assistant reply now comes from a
  dedicated `POST /api/chat/assistant` the widget awaits, instead of a
  fire-and-forget task that a redeploy could drop; the send route just saves the
  message. (2) **Knowledge / "train it like me"** — richer built-in portal facts,
  plus an **admin-editable "team knowledge"** textbox (Admin → System health,
  saved to `AppSetting` `ai.assistantKnowledge`) injected into the system prompt
  as authoritative, so staff can teach the assistant answers/policies in their own
  words with no deploy. Prompt also re-tuned to give real steps and stay in the
  team's voice. (3) **Cost estimator** — an interactive card on System health
  estimating monthly Anthropic cost by model (Haiku 4.5 / Sonnet 5 / Opus 5) from
  editable volume + token assumptions.
- **Auth: EN/FR language toggle on the login (and all auth) pages.** Pre-login
  pages only followed the saved locale cookie, so a dealer landing in the "wrong"
  language had no way to switch until after signing in. Added a shared
  `(auth)/layout.tsx` that shows the `LanguageToggle` (top-right, gated by
  `I18N_UI_ENABLED`) on login, forgot/reset password, MFA and 2FA-setup.
- **Reports: fixed two stacked navy blocks + new tab style.** The monthly
  summary card sat right under the navy "My reports" hero as a second big navy
  block, so the two read as one heavy mass. The summary is now a **light KPI
  card** (white, icon chip, big navy numbers, coloured MoM) — clearly distinct
  from the hero. The report tabs became a **segmented control** (Option A): a
  tinted track with the active tab as a raised white thumb, scrolls horizontally
  for the owner's 7 tabs. Both theme-aware. (Summary card is shared with the staff
  monthly report, which gets the same cleaner look.)
- **Mobile: tapping a field no longer zooms the page (iOS).** iOS Safari
  auto-zooms when a focused input's font is under 16px, which happened on the chat
  box and other fields. Added a phone-scoped rule forcing form controls to 16px
  (`max-width:640px`), so focusing the chat message box / any input no longer
  jumps the zoom. Desktop keeps its compact fields.
- **Mobile: support chat moved into the bottom quick bar (in place of Mail).**
  The quick bar's last tab is now **Help** (chat icon) which opens the support
  chat directly, so support is always one tap away without a floating bubble.
  Mail stays reachable via the header bell and the hamburger menu. On phones/
  tablets with the quick bar on, the floating chat bubble is now hidden (chat is
  in the toolbar); it still shows on desktop (no quick bar there) and if a dealer
  turns the quick bar off. New `quickBar.help` key (EN "Help" / FR "Aide").
- **Chat bubble no longer interferes with the document viewer.** The in-app PDF/
  image viewer (`DocViewer`) is a full-screen overlay that shared the chat
  launcher's `z-50`, so the bubble floated over the PDF and could grab taps
  (glitchy Back/scroll). The viewer now emits a `gwa:overlay` open/close signal
  that the chat widget listens for (counter-based, nesting-safe) and hides the
  bubble while any viewer is open; the viewer was also raised to `z-[60]` as a
  backstop.
- **Dashboard: visual upgrade of the three insight cards** (desktop + mobile).
  *Applications by Status* is now a crisp SVG donut (rounded segments with a soft
  gap, track ring, big centred total) with a cleaner legend (count + muted %).
  *Applications This Month* becomes a proper chart — dashed gridlines, gradient
  rounded bars with a soft shadow, a baseline, responsive bar widths.
  *Program Breakdown* gets an icon-chip header, gradient bars on a track, and
  count·% on the row. Shared card style (softer border, layered shadow, more
  padding), theme-aware, with subtle grow-in intros (disabled under
  reduced-motion). No data/logic changes — presentation only.
- **Mobile: chat bubble no longer covers page buttons.** The floating chat
  launcher sat over primary actions at the bottom of long pages (e.g. "Submit
  app" on the New Application form). It now auto-hides (fades/slides out) once the
  reader scrolls to the bottom of any scrollable page — where Submit/Save buttons
  live — and returns as they scroll back up; still hidden on the dashboard, which
  has its own support card. Works site-wide, no per-page config.
- **Chat: real-time assistant feel.** After a dealer sends in the support thread,
  the widget shows a live "✨ Assistant is typing…" indicator and fast-polls
  (~1.5 s) so the reply appears in about a second or two instead of on the 6 s
  cycle; it stops the moment the reply lands (or after a 25 s safety timeout).
- **Chat: AI support assistant (always-on, with human takeover).** The General
  support thread now answers dealers automatically with Claude (Anthropic
  Messages API, called from `src/lib/ai.ts` — no SDK dependency). It's grounded
  in a portal-facts system prompt, replies in the dealer's language, and is
  guard-railed: it never invents customer/deal/credit/dollar specifics or makes
  binding promises, and defers those to the team. It stays silent for 30 min
  after a real teammate replies, so a person can take over; a staff reply always
  wins. Runs in the background after the dealer's message is saved (send stays
  instant; the reply lands on the widget's ~6 s poll) and only on `SUPPORT`
  threads (deal threads still go to the reviewer). Assistant/auto messages render
  as a left "✨ Assistant" bubble. Falls back to the static after-hours note when
  the AI is unavailable. **Requires `ANTHROPIC_API_KEY` in Render** (optional
  `ANTHROPIC_MODEL`, default `claude-haiku-4-5-20251001`); without it, behaviour
  is the after-hours note only. Also fixed the auto-message author label
  (was "GWA Portal" → "Assistant") to respect the brand naming rule.
- **iOS: branded launch splash for the installed app.** Added
  `apple-touch-startup-image` launch screens (blue tile + centred icon) for the
  common iPhone resolutions, wired via `appleWebApp.startupImage` in the root
  layout. Opening the installed app now shows the brand instead of a white flash,
  matching Android (which already uses the manifest icon + `background_color`).
  Assets in `public/splash/` (PNG, per Apple's requirement); portrait, one per
  device size. Android/desktop unaffected.
- **Perf: hero/banner images converted to WebP.** The dashboard hero, the
  time-of-day rotation, and every page banner were ~2 MB PNGs each, so first
  paint pulled megabytes on every dealer screen. Re-encoded to WebP at ≤1920px /
  q80 — **92–97% smaller** (total hero payload ~34 MB → ~2 MB), references
  updated, PNG originals removed, and the static-image cache window lengthened
  (`max-age` 10 min → 1 h, SWR 1 day → 1 week). The runtime hero scanner already
  accepts `.webp`, so the daily/hourly rotation is unchanged.
- **Chat: after-hours auto-reply.** When a dealer sends a message outside
  9am–9pm (America/Toronto), the thread gets an automated acknowledgement
  ("Our team is offline right now (9 PM–9 AM) … we'll reply as soon as we're
  back"), stored in the dealer's language and rendered as a centred **system
  note** (amber, not a person's reply). Posted at most once per burst until a
  human actually replies. Schema: `ChatMessage.auto` flag + nullable `authorId`
  (migration `20260907010000_chat_auto_reply`, applied on deploy by
  `scripts/start.sh`). Support hours are defined in `src/lib/chat.ts`.
- **Mobile: support-chat button no longer hidden behind the Leads map.** The
  Leaflet map gives its own panes/controls a high `z-index` (up to ~1000), and
  the map wrapper created no stacking context, so those escaped into the page and
  painted over the fixed chat launcher (`z-50`) and the quick bar. Added
  `isolate` (isolation: isolate) to the map wrapper so Leaflet's z-index stays
  contained to the map box; the chat button and quick bar sit above it again.
- **Mobile: dealer "quick bar" (hybrid bottom navigation), toggleable per
  device.** Added a fixed bottom shortcut bar for dealers on phones/tablets
  (`DealerBottomNav`, hidden at `lg` where the sidebar takes over) with the five
  everyday actions — Home, Deals (Applications), a raised **New** button in the
  centre, Leads, Mail — with active-tab highlighting and unread dots pulled from
  the same nav array the shell builds. The hamburger drawer is **kept** as the
  full menu; the quick bar is an additive shortcut layer, not a replacement. It
  can be switched **on/off from a toggle in the mobile menu** (default on);
  preference is stored per device in `localStorage` (`gwa-quickbar`) and syncs
  live between the toggle, the bar, the page's bottom padding, and the support
  chat launcher (which lifts above the bar on phones). New `useQuickBar` hook +
  `quickBar.*` dictionary keys (EN/FR). Staff/admin unchanged (desktop-primary).
- **Mobile: dealer Applications "Pipeline" view no longer clips on phones.** The
  kanban was a fixed 880px 4-column grid inside a horizontal scroller, so on a
  phone the left column was cut off (stray amounts bleeding off-screen) and card
  text truncated. Now the pipeline **stacks stages vertically on phones**
  (full-width, nothing clipped) and keeps the horizontal kanban at `md`+. Also
  tightened card truncation (name/program get `min-w-0` so they ellipsize cleanly
  instead of overflowing). Extracted shared `PipelineCard` / `StageColumn` so both
  layouts stay in sync.
- **New home-screen / PWA app icon.** Replaced the install / Add-to-Home-Screen
  icon with the new GWA app tile (maple leaf + Canada map + GWA + wave, supplied
  by Sean). Regenerated `public/icon-192.png`, `icon-512.png` and
  `apple-touch-icon.png` (180) full-bleed — the source's black corners are
  trimmed so phones apply their own rounding cleanly — plus a padded
  `public/icon-maskable-512.png` now wired as the manifest's `maskable` icon so
  Android's circle/squircle mask never clips the wordmark. Source art saved at
  `public/brand/gwa-app-icon.png`; recorded in Brand Kit §3.
- **PWA install splash + chrome now brand blue.** `manifest.ts`
  `background_color` changed from white to `#1d4ed8` (brand-600, matching
  `theme_color` and the new app icon), so the launch/splash screen and the
  standalone window chrome match the icon instead of flashing white.
- **Mobile: fixed the root cause behind top-bar buttons ignoring their
  show/hide breakpoints.** The `.topbar-btn` class (`@apply inline-flex …`) was
  defined as plain CSS *after* `@tailwind utilities` and outside `@layer
  components`, so its `display:inline-flex` beat Tailwind's own `hidden` /
  `lg:hidden` / `sm:inline-flex` utilities (equal specificity, later in source
  wins). Every top-bar button therefore ignored its responsive display classes —
  the **sidebar-collapse toggle leaked onto phones** (showing next to the
  hamburger, which is desktop-only), the hamburger itself didn't hide at `lg`,
  and the theme toggle's `hidden sm:inline-flex` showed on mobile. Wrapped
  `.topbar-btn` in `@layer components` so the utilities win again; all three now
  toggle correctly. (`.card`, `.badge`, `.label` were checked for the same
  latent bug — `.card` sets no `display`, and `.badge`/`.label` are never paired
  with a responsive display utility, so no other visible toggle was affected.)
- **Mobile: header no longer truncates to "De…" on phones.** The dealer and
  staff top bars crowded the portal-name text between the logo and the right-hand
  controls, clipping it to "De…". The wordmark block (portal name + "GEORGIAN
  WATER & AIR" eyebrow) is now hidden below `sm` — the logo tile already carries
  brand identity on a phone — and given `min-w-0`/`truncate` so it ellipsizes
  cleanly rather than overflowing at any width. Part of a whole-site mobile pass:
  audited every dealer flow — all responsive grids start `grid-cols-1/2` on
  phones and only widen at `sm`/`lg`, and every wide table already scrolls inside
  its own `overflow-x-auto`, so the Pipeline kanban and this header were the only
  structural mobile breaks.

## 2026-09-06
- **Translation: live health check + Google Translate as a dormant provider.**
  Added a one-click **Live translation test** on Admin → System health (translates
  a known French phrase and reports which provider answered) via a server action —
  on-demand so it doesn't spend quota on page load. Extended the provider chain to
  **DeepL → Google → MyMemory**: Google Cloud Translation is wired in but dormant
  until `GOOGLE_TRANSLATE_API_KEY` is set in Render — switching to it later is just
  adding the key, no code change. Added `providerLabel()` for diagnostics.
- **Translation: usage meter + free fallback provider.** `src/lib/translate.ts`
  now runs a provider chain — DeepL first, then **MyMemory** (free, no account)
  automatically when DeepL is unconfigured, out of quota, or unreachable — so
  reviewer translation keeps working without a paid plan (long text is chunked to
  fit MyMemory's per-query limit; set `MYMEMORY_EMAIL` to raise its free daily
  cap). Added `deeplUsage()` (characters used vs. plan limit) and a **Translation
  usage** card on **Admin → System health** with a used/remaining bar that warns
  as the DeepL credit runs low and notes the automatic free fallback. Every
  translation caller goes through `translateText`, so the fallback is portal-wide.
- **Brand logo assets added.** Committed the Georgian Water & Air logo lockups
  (supplied by Sean): `public/GWANewLogo.png` (primary horizontal, transparent) +
  organized copies in `public/brand/` (horizontal-with-divider, and a circular
  badge for avatar/favicon use). Updated `docs/BRAND-KIT.md` §3/§12 to record the
  on-file rasters; vector (SVG/EPS) and a true reverse (white-on-dark) lockup are
  still outstanding. Used the primary logo on the greyscale Bilingual Launch
  Readiness Review PDF (the logo is the only colour element, per the §4 interim
  rule).
- **Bilingual coverage — file drop-zone (shared upload control).** Translated
  the drag-and-drop `FileDropInput` (drop prompt, Choose-file button, format
  hint, photo-optimizing state, "N files ready", "Click to change") — the last
  shared control on the dealer upload path still in English. New `fileDrop`
  namespace; default `hint`/`buttonLabel` now fall back to localized copy while
  still overridable per caller. This closes the dealer + reviewer toggle: the
  only surfaces left in English are the admin console (`TopNav`/AppShell) and the
  printable `PayoutReceipt` (paperwork, English on purpose), plus the on-hold
  Tutorial and the verbatim consent legal text.
- **Bilingual coverage — reviewer verification checklist, split-payment
  breakdown, conversation thread.** Final staff stragglers (fr-CA draft): the
  reviewer **funding verification checklist** (`VerificationChecklist` — the four
  checks + help via a new `verificationChecklist` namespace keyed to the
  constants, plus all row chrome/states/buttons), the split-payment
  **PaymentBreakdown** (title, Financed/Paid badges, deal total, amount
  financed), and the staff **conversation thread** page (title, back/open links,
  the "sees you as Reviewer" note, composer placeholder). The check codes and
  written values stay English; labels display via keys.
- **Bilingual coverage — staff report page wrappers + hub.** Translated the
  remaining staff report shells: the **Reports hub** card grid (`staffReportsHub`
  — 7 card titles/blurbs, badges, hub chrome; badge strings stay English as
  filter keys and localize only at render), and the office/month/week selector
  wrappers for **monthly**, **weekly store detail**, **dealer snapshot**,
  **product & package pricing**, plus the staff **Find a customer** search page.
  New `staffReports` + `staffReportsHub` namespaces (reusing `reports.*`
  month/week/view keys); month/week dropdown labels now format in the viewer's
  locale. With this the staff toggle is complete apart from the admin console.
- **Bilingual coverage — staff/reviewer surfaces, part 3 (shell, mail,
  conversations, misc).** Finished the staff-side sweep (fr-CA draft): the
  **staff shell/nav** (`StaffShell`, reusing the shared `nav.*`/`shell.*` keys,
  plus a small `staffShell` namespace), the **Mail** list + thread + compose
  (`staffMail`, `staffMailThread`, `mailCompose`), **Conversations** index
  (`staffConversations`), the GWA-team **customer detail** page
  (`staffCustomerDetail`), the **journal-connection** diagnostics report
  (`connectionReport`), and the staff **leads** oversight page (reusing dealer
  `leads.*` keys + a small `staffLeads` namespace). Staff-typed content (mail
  subject/body), machine values, env-var names/URLs, and data values stay
  English; fixed "GWA" brand slips (sender label, headers). With this the
  EN/FR toggle has no remaining English islands on the dealer or staff surfaces
  (admin console and the on-hold Tutorial excepted).
- **Bilingual coverage — staff/reviewer surfaces, part 2 (reviewer forms).**
  Translated the reviewer action forms on the staff deal page (fr-CA draft):
  the **decision** form (`DecisionForm` — options via `decisionDisplayLabel`,
  approve/finance fields, notes), the customer **confirmation** call script +
  checklist (`ConfirmationForm`), the **payout** form (`PayoutForm`), the manual
  **status change** control (`StatusChangeForm`, reusing the existing
  `enum.status.*` labels), and the reviewer **workspace** shell
  (`ReviewerWorkspace` — flow/tabs layout, phase tags, action banners). New
  `decisionForm`, `confirmationForm`, `payoutForm`, `statusChangeForm`,
  `reviewerWorkspace` namespaces. All machine values written to the deal record
  (decision/status/enum codes, amounts, confirmation numbers, reviewer-typed
  notes) stay English; only visible chrome is localized.
- **Bilingual coverage — staff/reviewer surfaces, part 1.** Began the staff-side
  sweep (fr-CA draft) for a fully bilingual toggle: the **reviewer queue**
  (`ReviewerQueue` — view modes, columns, tabs, priority bands, pager, empty
  states), the reviewer **funding checklist** (`FundingChecklist` — states,
  buttons, localized funding-doc type names via the shared helper), and three
  leadership reports — **weekly snapshot**, **dealer snapshot**, **cycle times**.
  New namespaces `reviewerQueue`, `fundingChecklist`, `weeklySnapshot`,
  `dealerSnapshot`, `cycleTimes`. Money/number/date formatting, journal data
  values, and status codes stay English; fixed "GWA" brand slips in report
  eyebrows/labels. (Staff are English-speaking; this is completeness work so the
  site has no English islands when toggled to FR.)
- **Bilingual coverage — deal-detail "what's needed" + funding-doc labels
  (dealer).** Closed the last dealer-facing gap: `dealerOutstanding()` now takes
  a translator and returns localized to-dos (fix-problem, add-serials,
  upload-{doc}, ready-to-submit) for the deal page "What's needed from you" card
  and the applications-list "Action needed" chip. Added a display-only
  `fundingDocTypeLabel` helper (`enum.fundingDocType.*`) + `outstanding`
  namespace; the dealer deal-detail funding checklist now shows localized
  document-type names. The English `constants.ts` labels stay the source of
  truth for reviewer counts, exports and any record. Fixed a "GWA" brand slip in
  the submit-package prompt.
- **Bilingual coverage — shared dealer components (upload, product picker,
  doc viewer).** Translated the file **upload form** (`UploadForm` — category
  prompt, "describe it", the no-payment-cards warning, submit/clear states), the
  **product picker** (`ProductPicker` — search, "Other" free-text, "add to my
  list" opt-in, empty state), and the in-app **document viewer** (`DocViewer` —
  Back/Download, PDF loading + render-error fallback). New `uploadForm`,
  `productPicker`, `docViewer` namespaces. Form field names, submitted product
  names, and the printable **payout receipt** (`PayoutReceipt`) stay English
  (data-write / paperwork).
- **Bilingual coverage — more dealer surfaces (forms, account, library, misc).**
  Translated to fr-CA (draft): the resource-library **brand/sort filters**
  (`LibraryFilters`); the **sales-rep report** page date-range control and the
  **weekly report** week-range dropdown (now locale-formatted); the **Find a
  customer** all-offices view (GWA-team) plus the "your office" fallback; the
  **mail attachment viewer**; the **date-of-birth** picker (`DateOfBirthInput`,
  incl. month names); the **split-payment** input (`SplitPaymentInput`, reusing
  the shared `paymentMethodLabel` display helper); the **product-package
  builder** inside pricing (`ManualPackageBuilder`); and the account-page
  **Install app** (PWA) and **desktop-notification** controls. New `dob`,
  `splitPayment`, `installApp`, `desktopNotifications`, `manualPackage`
  namespaces plus additions to `resources`, `reports`, `findCustomer` and `mail`.
  Data-write paths stay English (submitted DOB value, payment-method enum
  values, money formatting). Fixed brand slips ("GWA Portal" → "Georgian Water
  & Air Portal").
- **Bilingual coverage — reporting views (dealer + reviewer).** Translated the
  shared report components to fr-CA (draft): the **monthly performance** report
  (`MonthlyReportView`), **weekly store detail** (`StoreWeekView`), **by sales
  rep** (`SalesRepReport`), **product & package pricing** (`ProductPricingReport`),
  **sales forecast** (`SalesForecastView`) and the **custom report builder**
  (`CustomReportBuilder`) — headers, stat tiles, table column headers, hints,
  empty states, buttons and footnotes. New `reports.monthly`, `storeWeek`,
  `salesRepReport`, `productPricing`, `salesForecast` and `customReport`
  namespaces; the dealer weekly page also localizes its week-range dropdown.
  Data-write paths stay English on purpose: money/number formatting, the CSV
  export headers and filenames, and the custom builder's group-by dimension
  labels (which double as CSV headers). Also fixed brand slips ("GWA HD" →
  "Georgian Water & Air") in the monthly/weekly report eyebrows.
- **Bilingual coverage — Find a customer (dealer).** Translated the dealer
  "Find a customer" surface to fr-CA (draft): the `FindCustomerPanel` hero
  (title, subtitle with `{company}`, the My customers / Whose customer mode
  toggle, mode-specific placeholders and hints, Recent lookups + Clear, footer)
  and the shared `CustomerSearch` results (status/empty messages, result rows,
  the "other office has this customer" block, the journal detail card, and the
  inline customer-edit form). New `findCustomer` namespace. Office-scoped search
  behaviour and any values written back stay as-is; only display strings change.
- **HD Promotions hero slot.** Added a hero image slot for the HD Promotions
  content page — drop a file at `public/HD-Promotions.png` and it becomes the
  page banner; absent, it falls back to the gradient (same pattern as the HD
  Credit Card hero).
- **Mobile/tablet nav fix — no stray collapse button, no dead nav gap.** The
  sidebar collapse/expand toggle now only appears at `lg`+ where the persistent
  sidebar actually lives (it was showing where it made no sense on smaller
  screens). Fixed the underlying breakpoint mismatch: the hamburger drawer was
  hidden at ≥`sm` (640px) while the sidebar didn't appear until `lg` (1024px),
  leaving tablets (640–1023px) with no navigation at all. Added a `hideAt` prop
  to `MobileNav` (default `sm`, preserving AppShell's inline nav) and set the
  Dealer/Staff shells to `lg`, so below `lg` you get only the hamburger and at
  `lg`+ only the collapse toggle — never both.
- **Auto-translate chat & messages for reviewers (FR→EN, near-instant).** New
  `<AutoTranslate>` component converts each message to the viewer's interface
  language automatically on load — so an English reviewer reads a French dealer's
  message in English right away (and a French dealer reads English replies in
  French), with a subtle "show original" toggle. Wired into all message threads:
  the corner **chat widget**, the reviewer **deal conversation** thread, and the
  **gift-card** message thread. Cost/latency-aware: a client-side French-signal
  heuristic skips same-language text (no DeepL call), results are cached per
  (target, text) for the session, and DeepL's detected source suppresses the
  note when text was already in the viewer's language. Degrades silently with no
  key set, so it **activates for reviewers the moment `DEEPL_API_KEY` lands in
  Render — no redeploy needed**. Independent of the `NEXT_PUBLIC_I18N_ENABLED`
  UI-language flag. (`translateContent` now also returns DeepL's detected source.)
- **Support card — agent photo centred.** Moved the customer-support agent photo
  from the right edge to the centre of the support pill (symmetric two-sided
  feather) so the right-hand "Chat" button no longer clips it; lightened the
  colour wash so the centred photo reads clearly while the left text stays crisp.
- **Bilingual coverage — Leads (dealer, full surface).** Translated the entire
  Home Depot Leads surface to fr-CA (draft): the leads list (totals, search,
  status/outcome/month filters, list/grouped/map toggle, group headers, lead
  rows + all detail fields, no-good reason, pagination, empty states), the
  per-lead **call tracker** (outcome buttons, status pills, next-step chips,
  logged history), the **No-good** control (confirm flow + messages), the month
  dropdown, and the **map view** (store/lead popups, legend, loading + placement
  status). New keys live under the `leads` namespace; the shared
  `leadCallStatus` helper now takes an optional `t` (English fallback preserved).
- **Bilingual coverage — deal-detail page (dealer).** Translated the dealer
  deal-detail page to fr-CA (draft): header + "where your deal stands",
  customer snapshot, review decisions, confirmation, documents-for-approval,
  paperwork-for-customer, payout receipt, the whole funding-package section
  (legend, serials, per-document checklist, badges, submit), and the status
  history (via `enum.status`). New `dealDetail` namespace. Also localized two
  shared display helpers used here and on the staff deal page: the "where you
  stand" label (`dealerFacingStatusLabel`, keyed by reviewer-phase id →
  `dealerStatus.*`) and recorded-decision labels (`decisionDisplayLabel` →
  `enum.decision.*`). Still English (lib-driven, shared with staff/email paths —
  a later careful pass): the "what's needed" outstanding items and the
  funding-document type labels.
- **Deal enum labels — staff/reviewer display too (site-wide).** Extended the
  display-only enum layer to the staff surfaces: the reviewer queue (program +
  category columns), the staff deal-detail page (program badge, payment method),
  the reviewer entry/print view (program, SOAP), the split-payment breakdown
  (method labels), and the staff edit-deal form dropdowns. `t` is threaded into
  the shared `PaymentBreakdown`/`ReviewerEntryView` components as a prop.
  Careful exception: the edit page's *default product* value still comes from the
  **English** category label (`PROGRAM_CATEGORY_LABELS`) because it's written to
  the deal, not just shown. Enum labels are now localized everywhere they're
  displayed, dealer- and staff-side.
- **Bilingual coverage — deal enum labels (display-only layer).** Added a
  locale-aware **display** layer for the deal enums — program type/category,
  payment method, SOAP — as `enum.*` dictionary keys plus helpers in
  `src/lib/enumLabels.ts` (`programDisplayLabel`, `paymentMethodLabel`,
  `soapDisplayLabel`, …). Wired it into every **dealer-facing** display: the
  new-application dropdowns + payment picker, the dashboard program breakdown +
  recent deals, the applications list, the deal-detail page, and customer-search
  results. **The English `constants.ts` labels are deliberately untouched** and
  still back every data write — sales-journal columns, CSV/PDF exports, HD
  paperwork, emails — so records stay consistent regardless of the viewer's
  language. Staff/reviewer internal views (PaymentBreakdown, ReviewerEntryView,
  staff deal pages) will adopt the same helper when those surfaces are
  translated as a whole. `enum.programCategory.HVAC` → “CVC” in fr-CA.
- **Bilingual coverage — new-application form (the big one).** Translated the
  full "New customer processing" form to fr-CA (draft): the three entry-method
  cards (Express/Priority/Standard), payment-type picker, financing details,
  HD-lead pre-fill (incl. the live lookup status messages), deal + sales
  details, applicant/address/borrower-ID/employment sections, the co-applicant
  questionnaire, First Nations tax exemption, and the client-side error summary
  (field labels + "required"). New `newApplication` namespace (~130 keys). Select
  values are unchanged (labels display FR, submitted values stay the codes the
  backend expects). The legal **consent notice** (`CONSENT_TEXT`) is left
  verbatim per the brand kit — its fr-CA legal wording is for the Québec team to
  supply. Constant-driven option lists (program/category/payment/SOAP) still
  render their English labels for now — that shared enum layer is a separate pass.
- **Bilingual coverage — gift-cards surface (dealer).** Translated the full
  water-test gift-card flow to fr-CA (draft): the request form, per-request
  cards + inline edit, the dealer↔team message thread, search/filter controls,
  the pager, and the bulk-CSV importer (preview table, per-row validation
  messages, plural "added/skipped" counts). Expanded the `giftCards` namespace
  with ~70 keys. The downloadable CSV template now switches with the locale
  (French headers + filename when FR), and the importer accepts both English and
  French headers (accent-insensitive) so data-matching still works either way.
  Also fixed a brand slip in the
  message thread ("GWA team" → "Georgian Water & Air team").
- **Bilingual coverage — public "Request portal access" onboarding.** Translated
  the public `/request-access` page and its onboarding form to fr-CA (draft):
  access code, main contact, office details, people-who-need-a-login rows, and
  the confirmation state. New `onboard` dictionary namespace. Example data in
  placeholders (names, sample phone/postal) left as-is; descriptive labels and
  hints translated.
- **Bilingual coverage — sign-in / account-security screens.** Translated the
  entire `(auth)` surface to fr-CA (draft): login, forgot-password,
  reset-password, forced password change, two-factor verification (MFA), and
  two-factor setup/enrollment (email-code + authenticator-app tabs, QR, resend).
  New `auth` dictionary namespace. Still gated behind `NEXT_PUBLIC_I18N_ENABLED`.
- **Dealer journal-archive search (office-scoped history).** Dealers can now
  find their own office's past Home Depot customers from the **closed** sales
  journals (2024+) right in Find customer. The old journals are no longer edited,
  so they're **imported once into the database** (`JournalRecord` table +
  migration) and searched from there — fast, permanent, and correctable. New
  `scripts/import-journals.ts` reads each closed year via the existing journal
  reader, attributes every row to an office with the shared Dealer-Snapshot
  matcher (`src/lib/reporting/dealerMatch.ts`, store number → alias → distinctive
  name token), and upserts on `(year, tab, rowNum)` so re-runs refresh without
  duplicates. `searchOfficeJournalArchive()` (`src/lib/journalArchive.ts`) is
  **strictly scoped to the dealer's own `dealerId`** (no cross-office leakage),
  name/phone match, read-only. Results show as customer cards under "From your
  office's past sales journals" (avatar, year, product · store · finance · amount
  · sale date, phone/address). Going forward, run the import once per year as each
  book closes. **To go live:** run the import in production (dry-run first) —
  `npx tsx scripts/import-journals.ts --year=2024,2025 --dry`, then without
  `--dry`.
- **HD Payout Calculator — deal tool + printable receipt.** The "How the payout
  works" explainer now stays on the right at all times; the result breakdown
  renders under the inputs on the left (calculator layout unchanged). Portal deal
  search now returns full sale details (customer, sale date, products, sales rep,
  installer, payment method) shown in a refined customer-profile card, with a
  **Recent** quick-pick row remembered per browser. Added **Print receipt** — a
  print-friendly Dealer Sale & Payout Receipt (sale details + accounting
  breakdown) the dealer can attach to a sale or hand to accounting. Added hero
  slots: `/reports-hero.png` (My reports) and `/mail-hero.png` (Mail). Removed
  the "Sales & rewards" eyebrow from the Marketplace hero.

- **Resources & content-page cleanup.** Removed the white script flourish from
  the Resources index, Product library and Support heroes; fixed the **double
  banner** on the Resources page (the embedded section no longer renders its own
  hero); promoted **Product library** to a top-level sidebar item (out of the
  Resources submenu) and gave the resources index a proper prominent card for it.
  Tightened the shared content-card grid to 3-up on wide screens with
  full-preview (object-contain) thumbnails so document covers stop cropping oddly.
- **HD Payout Calculator beefed up.** Two-column layout on desktop (inputs left,
  results right) that fills the width, with a "How the payout works" panel shown
  until an amount is entered; added a hero image slot (`/calculator-hero.png`).
- **Brand fixes.** Replaced customer-facing "GWA" with "Georgian Water & Air" in
  the Resources blurb, the calculator note and its copied breakdown.

## 2026-09-05
- **Bilingual (EN/FR) foundation for the Québec launch.** Added a cookie-based
  i18n system (`src/i18n/`) — no route restructuring: `getLocale()`/`getT()` for
  server components, `<LocaleProvider>`/`useT()` for client, en + fr-CA
  dictionaries, a `setLocale` server action, and an **EN/FR toggle** in the top
  bar. The toggle is **hidden until `NEXT_PUBLIC_I18N_ENABLED=1`** in Render so
  real users don't see half-translated pages during the all-at-once rollout.
  First surfaces translated: the dealer shell (nav, top bar, mobile drawer) and
  the whole dashboard. Also added **DeepL** live translation for user-typed
  content (`src/lib/translate.ts` + `<TranslateText>`), gated on `DEEPL_API_KEY`.
  fr-CA copy is a **draft for the Québec team to review**; legal/statutory text
  is intentionally left for official French wording. *(Rollout continues across
  applications, forms, reports, staff & admin before the flag is turned on.)*
- **Right rail refresh.** Quick Actions swaps "Find a Lead" for **Gift cards**;
  a compact **HD Leads** pill now sits above the (slimmer) Support pill.
- **Dashboard & shell polish.** The dealer sidebar is now **collapsible** (toggle
  in the top-left; icon-only rail at 72px, state remembered per browser) so the
  content area can go wider. Added a **New application** button to the top bar.
  Sidebar links get a subtle **"water" hover** (caustic wash + light sheen,
  reduced-motion aware). Mobile dashboard KPIs are now a **compact 2-up grid**
  (smaller tiles that flow into the list). The **Support** card is slimmer (a
  single compact row, "Chat" button) so it doesn't read as a big call-out.
  **Recent Applications** stays at 4 rows collapsed and, when expanded (up to
  15), scrolls inside its own card so the page never gets pushed around.
- **Hero cleanup + HD Credit Card hero slot.** Removed the white script flourish
  from the **Leads** hero and from the shared **Resources** content heroes (it
  overlapped the photos / read as clutter). Added a per-slug hero image map in
  `ContentPage` so content tabs can carry their own banner; wired the **HD Credit
  Card** page to `/hd-credit-card-hero.png` (drop that file in `/public`).
  `ContentSectionView` now takes an optional `bgImage`.
- **Pricing report: unit counts + all products.** Added a "Products — sold /
  approved / installed" table (units per product across all deals; installed =
  installation date reached), and the "Group products your way" picker now lists
  **every active catalog product** (even zero-sales ones). The manual grouping
  result now shows Sold / Approved / Installed counts alongside the average.
  `productPricing` now scans all non-draft deals (averages still approved-only)
  and returns `productCounts` + full catalog.
- **Custom builder — more measures, group-bys & CSV.** Added an **Approval rate
  (%)** measure and three group-bys — **Payment method, Entry method, HD store** —
  plus an **Export CSV** button. `reportDataset` now carries paymentMethod,
  entryMethod, HD store number and an approved flag.
- **Save & name custom reports.** The custom report builder can now save a named
  view (measure + group-by + range + status filters) and reload or delete it.
  Saved reports are **office-shared** (any owner at that office sees them). New
  `SavedReport` model + additive migration `20260905020000_saved_report`; server
  actions `saveCustomReport` / `deleteCustomReport` (owner-gated).
- **By-sales-rep report (dealer owner).** `/dealer/reports/sales-reps`: each rep's
  deals, total and average sale value, plus their top program, with a date-range
  filter. Uses the salesperson name captured on the new-customer form
  (`Application.salespersonName`). Owner-gated.
- **Rotating dashboard hero.** Drop a few images into `public/hero/` and the
  dashboard shows a different one **each day** (deterministic; falls back to
  `public/hero-banner.png`, then the gradient). Combined with the existing
  time-of-day greeting (sunrise/sun/moon) so sign-in feels fresh without any
  external weather call. `lib/heroImage.ts`.
- **Sales forecasting centre (dealer owner).** `/dealer/reports/forecast`: 12-month
  trend, this-year-vs-last-year by month, and a **seasonal projection** for the
  next 3 months (each future month's historical average scaled by the recent
  12-month trend; trailing-3-month fallback). Clearly labelled as a directional
  estimate. `lib/reporting/salesForecast.ts` + `SalesForecastView`. Owner-gated.
- **Custom report builder (dealer owner).** A curated, tenant-isolated report
  builder at `/dealer/reports/custom`: pick a **measure** (deal count / total $ /
  average $), a **group-by** (month, program, status, salesperson, province,
  product), a **date range**, and **status filters** — live table + bar chart,
  computed in the browser over the office's own deals (`reportDataset`). Owner-
  gated (same as the pricing report). Save/name reports and sales forecasting are
  the next phases.
- **Pricing report: manual product grouping.** Tick products to see the average
  sale price when sold together, with "Exactly these" / "Includes these" match
  modes (`ManualPackageBuilder`).
- **Product & package pricing report.** Average sale price per product and per
  package, per office. Because a deal stores one total + a product list (no
  per-product price): a deal with **one** product feeds that product's average;
  a deal with **two or more** is a **package**, auto-grouped by the exact set of
  products (no hard-coded package list). Basis: approved-or-beyond deals, using
  the approved amount (falls back to requested). Two surfaces:
  **Staff** (`/staff/reports/product-pricing`, Reports area, gated by the
  Dealer-Snapshot grant) with an office picker (All / each office); and
  **dealer owner** (`/dealer/reports/product-pricing`) scoped to their own office.
  Dealer access is deliberately double-gated so the control is clear: the user
  must be the **office owner** (`User.isDistributor`) **and** the office's
  reports must be enabled by an admin (`Dealer.reportsEnabled`, the existing
  Admin → Dealers → "Reports" toggle) — regular office staff never see it.
  `lib/reporting/productPricing.ts`, `canViewOwnerPricingReport`,
  `ProductPricingReport`. No schema change.
- **Applications: multi-view deal tracker (dealer).** The Applications list is now
  a switchable workspace so dealers can track deals through approval → docs →
  funding the way that suits them: **Tracker** (grouped by "Needs your action" /
  "In progress — with GWA" / "Funded & paid" / "Closed"), **Pipeline** (Kanban
  columns by stage), **List** (the detailed sortable table), and **Progress** (a
  stage bar per deal). One search + sort drives all views; pins float to top.
  The chosen view is remembered per user (most-recent) and **usage is counted in
  the DB** (`ApplicationViewUsage`) so we can see which views dealers actually
  use. Stage/grouping logic in `lib/dealerStage.ts` (reuses `dealerOutstanding`);
  view logged via `/api/dealer/view-usage`. Replaces the old single table +
  separate "Needs attention" panel on this page. Migration
  `20260905010000_application_view_usage` (additive).
- **Reviewer (staff) area brought up to match the dealer portal.** New
  `StaffShell` gives the reviewer area the same dark-blue sidebar + white top
  header (slim scrollbar, Dealer-view switcher pill, mail bell, account block)
  as the dealer portal, replacing the old top-nav `AppShell` (content stays in a
  centered column). `SectionHero` now heads the main reviewer pages — Deals
  queue, Mail, Conversations, Gift cards, Directory, Find customer, Leads,
  Reports (with a "Journal connection" hero action). Admin area still on the old
  shell (next phase). UI-only; queue/search/sort/logic unchanged.

## 2026-09-04
- **Shared hero rolled across the dealer tabs.** Every dealer page now uses the
  reusable `SectionHero` (added an optional `actions` slot for header buttons and
  an `actions`/flourish right side; image is scaled to cover — never distorted —
  focused via `bgPosition` and feathered on the left so a banner photo blends
  into the gradient with no seam). Converted: Applications (with a "New customer
  processing" hero button), New customer, Leads ("Home Depot Leads"), Gift cards,
  Resources + Product library, HD Promotions / HD Credit Card (via
  `ContentSectionView`), Mail, Office profile, Request logins, HD Payout
  calculator, Find customer, Tutorial, Contact & Support. Swappable banner
  slots wired for `public/{leads,gift-cards,resources}-hero.png` (gradient
  fallback until uploaded).
- **Marketplace facelift (dealer).** New shared enterprise page hero
  (`SectionHero`, reusable across dealer tabs): blue gradient + swappable
  background photo (`public/marketplace-hero.png`), eyebrow/title/subtitle,
  feature tiles and a "Represent / Grow / Succeed / Together" script flourish.
  Categories are now big icon cards with counts; added a product search + sort
  (Featured / A–Z). On desktop the cart is a **persistent right rail** (with a
  "Need help with your order?" support card that opens the corner chat, plus
  Fast-processing / Dealer-exclusive / Questions tiles); mobile keeps the
  floating cart button + drawer. All order logic unchanged — still an
  order request, **no prices/checkout** (items carry no price in the system).
- **"Needs your attention" moved to the Applications page.** Off the dashboard;
  it now sits above the full Applications list (reviewer send-backs first,
  flagged red), where the dealer actually actions deals.
- **Dealer dashboard facelift — round 2.** Hero rebuilt as a wide photographic
  banner: swappable background photo (`public/hero-banner.png`, on-brand gradient
  until one is added), a **time-aware icon** on the greeting (sunrise / sun /
  moon-and-stars for morning / afternoon / evening) and a "Better Water /
  Brighter Lives" script flourish (Great Vibes web font). Header shows the
  dealer's own company logo + "Dealer Portal". Sidebar got a **slim on-brand
  scrollbar** (replacing the chunky native bar) and tighter spacing; the
  "Switch to Reviewer view" control moved up to a small top-bar pill beside the
  search. **Recent Applications** is now expandable (Show more/less), pinnable
  (per-user pins float to the top), and flags reviewer send-backs. New
  **"Needs your attention"** panel lists deals to action — reviewer send-backs
  (PROBLEM) first, flagged red with a "!". Support card made compact + shows a
  swappable agent photo (`public/support-agent.png`). UI-only.
- **Dealer dashboard facelift — refinements.** Header now shows the **dealer's own
  uploaded company logo** beside "Dealer Portal" (falls back to the Georgian
  wordmark when no logo is set). Hero rebuilt to the enterprise "Welcome to your
  Dealer Portal" treatment (line-art house + growth-arrow graphic, "Your hub for
  managing and organizing your business"); removed the four feature chips and the
  announcement banner under the hero. Support card ("Need Support?") now **opens
  the corner chat** on click (was a link to `/dealer/support`) and shows a
  swappable, auto-cropped agent photo from `public/support-agent.png` (headset
  watermark until one is added; AI image prompt in `BRAND-KIT.md` §13). Quick
  Actions "Process Application" → **"Product Resources"** (→ product library).
  `ChatWidget` listens for a `gwa:open-chat` event. UI-only; backend/routes/auth
  unchanged.
- **Dealer portal facelift (dashboard + shell).** New enterprise-style dealer
  UI: dark-blue left sidebar + white top header (`DealerShell`, reuses the
  existing mobile drawer), and a real-data dashboard at `/dealer` (hero with
  time-aware greeting + office name, KPI cards, Recent Applications preview,
  Quick Actions, Support card, and Status-donut / Monthly-trend / Program
  breakdown). The full searchable/filterable Applications list moved to
  `/dealer/applications` (logic unchanged; nav "Applications" points there,
  "Home" → `/dealer`). Reusable components under `components/dashboard/`; added
  `lucide-react`. Backend, routes, auth, permissions, forms unchanged;
  staff/admin unaffected. Self-contained commit — revert to restore the
  original look.
- **Animated header wordmark + dashboard greeting (dealer).** The header opens as
  "GWA Dealer Portal" and, once per browser session, softly blurs into
  "<Company> Portal" (company from the office profile) after ~5s. The dealer
  dashboard shows a time-aware "Good morning/afternoon/evening, <first name>".
  Falls back to "GWA Dealer Portal" when no company is set; respects
  prefers-reduced-motion. `AnimatedWordmark` + `DashboardGreeting`.
- **Card-number redaction in chat.** Card numbers typed into chat are stripped
  and replaced with "[card number removed]" server-side (raw number never
  stored); the message still goes through and the sender sees an amber notice.
  Length + Luhn detection, so the portal's own numbers (HD Customer #,
  financing #, phones) are untouched. `src/lib/cardGuard.ts` (+ tests).
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
