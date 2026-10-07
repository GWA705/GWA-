# GWA Dealer Portal — Core build facts

The durable reference for how this app is built and configured. Update it when a
core fact changes. (Roadmap/ideas live in `BACKLOG.md`; privacy posture in
`COMPLIANCE.md`; the yearly journal ritual in `JOURNALS.md`; reporting defs in
`REPORTING-SPEC.md`; the **AWS Canada move (completed 2026-09-06)** in `AWS-MIGRATION.md`.)

## What it is
A secure credit-application + funding portal for **GWA / Georgian Water & Air
(GHS), Barrie ON**. Dealers submit consumer credit applications for installed
products (water / air / Smell Busters / HVAC); GWA reviews, approves, funds, and
pays. Handles sensitive PII (SIN, banking, ID) → built for **PIPEDA + provincial
privacy law (incl. Quebec Law 25)**. No credit-card data is collected (PCI-DSS
N/A).

## Stack & hosting
- **Next.js 14 (App Router) + TypeScript**, server actions, **Tailwind 3.4**.
- **Prisma + PostgreSQL** on **AWS RDS, ca-central-1**.
- **AWS Elastic Beanstalk** hosting (cutover from Render 2026-09-06). AWS account
  **`863478708936`**, region **`ca-central-1`**. Env **`Gwa-portal-env`** (Docker
  on AL2023, single t3.small) behind **CloudFront + WAF**; DNS `portal.ghsbarrie.ca` → CloudFront. **Every push to
  branch `claude/pci-credit-application-portal-vi7d6r` builds an image to ECR and
  auto-deploys to EB** (`.github/workflows/build-ecr.yml`). Render is
  decommissioned — **older docs that say "Render" mean EB now.**
- **Runtime env vars live on the EB environment** (Configuration → Software), NOT
  in GitHub. GitHub repo secrets hold only the AWS deploy keys + the two
  build-time `NEXT_PUBLIC_*` keys baked into the image. **EB caps total plain-text
  env properties at 4 KB**, so the large `GOOGLE_SERVICE_ACCOUNT_JSON` is sourced
  from **AWS SSM Parameter Store** (SecureString `/gwa-portal/GOOGLE_SERVICE_ACCOUNT_JSON`
  in ca-central-1; the EB row's Source = "Parameter Store" pointing at its ARN;
  read via the EB instance role `aws-elasticbeanstalk-ec2-role` + inline policy
  `gwa-ssm-google-sa`). **Put any future large secret in SSM the same way.** (Set
  up 2026-10-02 to make room for the Twilio vars.)
- Migrations are hand-written SQL, applied via `prisma migrate deploy` in
  `scripts/start.sh` on deploy.
- **File storage:** S3 **ca-central-1**, bucket **`gwa-portal-documents`**, with
  app-level (envelope) encryption; files served through `/api/...` routes, never
  public URLs.
- **Email:** SMTP is **LIVE**, sending from **`hello@ghsbarrie.ca`**. (Falls back
  to log-only if `SMTP_HOST/USER/PASS` are unset.)
- **Texting (SMS):** Twilio — `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` /
  `TWILIO_FROM_NUMBER` (E.164, or a `MG…` Messaging Service SID) set on EB
  (2026-10-02). `src/lib/sms.ts` stays inert until all three are set. Powers the
  customer review-request text. **Carrier registration (toll-free verification /
  A2P 10DLC) is still required for reliable Canadian delivery.** Admin → Email has
  a Connected/Not-set-up badge, a send-test-text button, and a Twilio cost meter
  (`src/lib/twilioUsage.ts`).

## Google Workspace (Sheets) integration
- **Service account:** `gwa-journal-writer@gwa-portal-504012.iam.gserviceaccount.com`.
  Every sheet must be shared with it (Viewer to read, Editor to write).
- **Sales journals — one spreadsheet per year**, env `JOURNAL_SHEET_ID_<year>`:
  - 2024 = "GHS-AIR&WATER SALES JOURNALS 2024" (`1jAnCn2VbfO-2CYfbncYbJJXLFUi2LxS99b1qX_qYTd4`)
    — **older, different layout** (metadata block, two-row header, no Location
    column); the reader detects & handles this automatically (`isMonthTab`,
    `officeFromMetadata`, header-name column mapping). READ-only history.
  - 2025 = "GHS -WATER & AIR - SALES JOURNAL 2025" (`1WYqNipTSPfW8upqTokMfnVG2RyVqNtHF2HbiVE5qJ4s`)
  - 2026 real/live = "GHS SALES JOURNAL 2026" (`1MTTv5Jjq7z9e_T5-fu1r_jcmT93rc_wcCUJAhFC1xdg`)
  - 2027 = "GHS SALES JOURNAL 2027" (`1r2v0r0Ufi1c6pxcTQvguvFC0bNVfS_5AlG1biIMwXYg`)
  - `JOURNAL_SHEET_ID` (no year) = the **test** journal ("GHS SALES JOURNAL Test SEAN"),
    the default write sandbox; 2026 reads fall back to it if `JOURNAL_SHEET_ID_2026` unset.
  - `EARLIEST_JOURNAL_YEAR = 2024` bounds the customer/journal search + health checks.
- **HD leads log:** `HD_LEADS_SHEET_ID` = `1dM9bsv0YOME-xLW-SvugAX8taWMM1dkAvsUAYGCb6lk`.
- **Reporting always READS the live per-year journals.** Deal WRITES have a
  Test/Live toggle (admin, on the Journal-connection / System-health area): Test
  writes to the sandbox; Live writes to the deal's sale-year journal
  (year-aware — 2027 deals go to the 2027 journal automatically).
- **Deal WRITE row selection (live, `planRow` in `src/lib/journal.ts`; updated
  2026-10-02):** writes to the **first truly-empty line** (every cell blank but
  the pre-printed "No."), scanning top-down — so it fills the pre-numbered blanks
  that sit ABOVE a totals row instead of appending below it. **Duplicate guard:**
  if the deal's HD Ref # / Loan # is already on a row (e.g. a staff member typed
  it in), it reuses that row and fills only its BLANK cells — never duplicates,
  never overwrites a human entry; a same-ref-different-name or multi-row case is a
  **'conflict'** (nothing written, surfaced on the "Write to Journal" button for a
  human to reconcile). A notes/totals row carries no reference, so it's never
  matched (preserves the Sep-19 notes-row protection). Re-syncing our own
  remembered row (stored `journalTab`+`journalRow` still holding the last name)
  updates in place. NOTE: deals written below a month's totals row *before* this
  fix are a one-time manual cleanup in the sheet.
- **Admin → System health** verifies every connection (DB, S3, email, service
  account, journals, leads) live, and shows the service-account share address.

## HD Resolution — Gmail email link (read-only)
Reuses the **same** Google Cloud project + service account as Sheets (no new
credential). Lets an HD Resolution case follow its Home Depot email chain.
- **Google Cloud project:** **"GWA Portal"** — Project ID `gwa-portal-504012`,
  project number `736448322505`, org `georgianwaterandair.ca`.
- **Service account (shared with Sheets):**
  `gwa-journal-writer@gwa-portal-504012.iam.gserviceaccount.com`.
  Its **Unique ID / Client ID** (used for domain-wide delegation) is
  **`100470797238569934976`** (recorded 2026-10-07). Not a secret — it's the
  service account's public identifier.
- **Gmail API:** **Enabled** on the GWA Portal project (2026-10-07, Sean).
- **Gmail label + filter:** label **`HD Resolution`** exists in `sean@ghsbarrie.ca`
  (Gmail label id `Label_6`); a filter auto-labels the HD resolution-centre mail.
  Confirmed live 2026-10-07 — **19 threads / 190 messages**, real cases from
  `resolutions_canada@homedepot.com` (+ escalations like `christine_e_brown@…`),
  subjects in the `CASE #######...` form the portal parses.
- **Still to switch ON (external consoles — can't be done from the repo):**
  1. **Workspace Admin** (admin.google.com → Security → API controls →
     Domain-wide delegation → Add new): Client ID = the service account's Unique
     ID above; OAuth scope `https://www.googleapis.com/auth/gmail.readonly`.
  2. **Elastic Beanstalk** (`Gwa-portal-env`): set `GMAIL_RESOLUTION_USER`
     = `sean@ghsbarrie.ca` (and optionally `GMAIL_RESOLUTION_LABEL` = `HD Resolution`,
     the default), then restart.
  The portal is **inert until `GMAIL_RESOLUTION_USER` is set**
  (`gmailResolutionConfigured()`). Code + 30-min sync (`resolution-email-sync.yml`,
  reuses `CRON_SECRET`) already shipped. Full steps: `docs/HD-RESOLUTION-EMAIL.md`.

## Journal archive & office customer search (DON'T rebuild — it exists)
- **Goal:** every office searches its OWN historical Home Depot customers in the
  portal, fast and reliably — without reading Google Sheets on every search.
- **Storage:** `JournalRecord` table (Prisma) = closed-year journal rows imported
  into Postgres. One row per deal, attributed to an office via `dealerId`
  (resolved at import by `buildDealerMatcher`: store number, then location name).
- **The current year is NEVER archived** — it stays a **live read** all year so it
  can be adjusted. Only **closed years** (`EARLIEST_JOURNAL_YEAR`..lastYear) go to
  the DB. `importJournalYear()` refuses `year >= currentYear`.
- **Single importer:** `src/lib/reporting/journalImport.ts` → `importJournalYear(year)`
  (force live Sheets read → match offices → **deleteMany+createMany** replace of
  that year, so re-sync never duplicates) and `archiveStatus(years)`. Used by BOTH:
  - **CLI:** `scripts/import-journals.ts` (`npx tsx … --year=2024,2025 [--dry]`), and
  - **In-portal admin UI:** staff → reports → **Connection** page, "Customer search
    archive" section — per closed year: rows/matched/last-uploaded + **Upload to DB**
    / **Re-sync** buttons (`importJournalYearAction`, ADMIN-only, audited
    `JOURNAL_ARCHIVE_IMPORT`).
- **Search path (already built):** `searchOfficeJournalArchive(dealerId, q)`
  (`src/lib/journalArchive.ts`, reads `JournalRecord` by office, name/phone) →
  blended with live portal deals in `src/lib/customerSearch.ts` → shown on the
  dealer **Find customer** page (`FindCustomerPanel`; GWA team gets all-office
  `CustomerSearch`). Gated by the **`isGlobalSearchEnabled()`** master setting —
  the page 404s when off.
- **To make it live for offices:** (1) turn on the global-search setting, and
  (2) Upload each closed year on the Connection page (or run the CLI in prod).

## Roles, access control & tenancy
- **Roles:** `DEALER_USER`, `REVIEWER`, `ADMIN`. `isDistributor` flags a dealer's
  owner/main contact.
- **Admin access:** `superAdmin` (full) + `adminSections[]` (scoped) per admin;
  nav + route guards derive from `ADMIN_SECTIONS` in `src/lib/constants.ts`.
- **Tenant isolation:** a dealer only ever sees their own dealer's data
  (`dealerPortalScopeWhere`); internal staff can see all (`applicationScopeWhere`).
- **Per-user / per-dealer grants:** calculator (`canUseCalculator` /
  `Dealer.calculatorEnabled`), reports (`canViewReports` / `Dealer.reportsEnabled`),
  leadership snapshot (`canViewLeadershipReport`), full customer search
  (`canSearchCustomers`). Global search also has a master admin toggle
  (`search.globalEnabled`, off by default).
- **Full customer search** (all portal deals + all sales-journal history: name,
  phone, HD 800/701 Ref #, address) is granted by ANY of: super admin, the
  `customer-search` admin section (Admin → Admin access — the way to give someone
  a **restricted admin login** that can only search customers), or the
  `canSearchCustomers` per-user flag (reviewers). Appears in both the Admin and
  Staff nav as "Find customer"; requires the `search.globalEnabled` master toggle
  ON. Every search is rate-limited + audited.

## Core domain
- **Application = the deal** (the central entity). Statuses: DRAFT, SUBMITTED,
  UNDER_REVIEW, CONDITIONAL, APPROVED, DOCS_SENT (awaiting install),
  FUNDING_SUBMITTED (signed docs to review), FUNDING_REVIEW, FUNDED, PROBLEM,
  DECLINED, WITHDRAWN.
- **Journal salesperson** = the **"Dealer's Name"** column. `journal.ts` writes the
  portal salesperson there; `journalRead.ts` reads it back into `ReportDeal.salesperson`
  (added 2026-09-08). The Salesperson leaderboard groups on it.
- **PII** (SIN, DOB, address, bank, ID) is **envelope-encrypted** (`src/lib/crypto.ts`,
  AES-256-GCM); names/phone/email kept plaintext for staff triage. Reads of
  encrypted fields are audited.
- **Dealer ↔ HD stores:** each dealer has assigned `HomeDepotStore` numbers; this
  mapping attributes journal/lead rows to an office (used by reports + leads).
- **Products:** admin catalog (`Product`, with `journalName` abbreviation written
  to the journal); a deal's `productsSold` is a String[] of product names.

## Reporting — money bases & definitions (critical)
- **Result classes:** `OK` = confirmed money; `PE/OK` = pending install (shown
  separately, never in OK totals); `RB` = dead/cancelled (excluded). A **$0 PE/OK
  is treated as a dead deal** and excluded from pending.
- **Weekly Leadership Snapshot** (super-admin/granted): money = **gross sale by
  date of sale**; split **HD vs Outside-HD**; funnel, aging, financing, pending,
  and a **journal data-health** panel.
- **Monthly Performance (per office):** money = **paid receivable by Date Paid**;
  M/M, Y/Y, YTD per HD store; PE/OK pending split into this-month vs earlier
  months.
- **Weekly Store Detail** (AIRDRIE-style): per-store customer line items; gross by
  sale date, OK + PE/OK.
- Dealer-facing reports are tenant-isolated (own office only). Company-wide =
  super-admin or grant.

## HD payout calculator (`src/lib/payoutCalc.ts`)
`computeDealerPayout(totalWithTax, province)`: subtotal = T/(1+taxRate); − HD 13%
(of subtotal); − HD IBX 1.25% (of after-HD); − HD Program 4% (of pre-tax
subtotal); net pre-tax; + HST (province rate) → TOTAL EFT PAYOUT. Province tax:
ON .13, NS .14, NB/PE/NL .15, BC/MB .12, SK .11, QC .14975, AB/NT/NU/YT .05.
Dealer calculator can auto-fill amount + province + customer from a **portal deal
lookup** (own dealer only).

## Features shipped
Application intake (typed / photo / FinanceIt #) · reviewer queue + funding
verification + payouts · dealer profiles + notifications · content tabs +
marketplace + announcements/alerts · office directory + support contacts ·
user-request intake/approval · **reporting suite** (3 reports, internal +
dealer) · **HD leads database** (per-office, view-only, month filter) ·
**Resource library** (product manuals/brochures) · **email a brochure/manual to
the customer** (attaches what fits; large files go as a secure 30-day download
link via the public `/d/[token]` route) · **customer review request** from the
Confirmation step (email + text, gold-star co-branded email, configurable Google
review link) · **flag an issue to the dealer** (deal chat + portal Mail with
required acknowledgement + top-of-deal banner + email) · **payout calculator** +
portal-deal lookup · **global customer search** + **customer-assist** page
(what they bought, matched manuals, local office, message-the-office
notification) · **System health** dashboard · grouped admin nav + "Needs
attention" panel · admin RBAC (superAdmin + sections) · 2FA + password policy +
audit log.

## Parked / pending
- **Staging: journal-driven auto-payout** (col Q Pe/OK→OK + date → auto-pay +
  receipt) — built on staging, parked until amounts verified.
- **Global customer search** — live behind master toggle; privacy-officer signoff
  recommended before broad production use (cross-office disclosure; see
  `COMPLIANCE.md`).
- **Customer-assist "one-screen"** — future: link deal → product → manual more
  richly (see `BACKLOG.md`).
