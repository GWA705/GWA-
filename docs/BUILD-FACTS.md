# GWA Dealer Portal — Core build facts

The durable reference for how this app is built and configured. Update it when a
core fact changes. (Roadmap/ideas live in `BACKLOG.md`; privacy posture in
`COMPLIANCE.md`; the yearly journal ritual in `JOURNALS.md`; reporting defs in
`REPORTING-SPEC.md`.)

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
- **Render** hosting. **Production auto-deploys from branch
  `claude/pci-credit-application-portal-vi7d6r`**; **staging** from branch
  `staging` (throwaway DB, local storage, log-only email, staging banner).
- Migrations are hand-written SQL, applied via `prisma migrate deploy` in
  `scripts/start.sh` on deploy.
- **File storage:** S3 **ca-central-1**, bucket **`gwa-portal-documents`**, with
  app-level (envelope) encryption; files served through `/api/...` routes, never
  public URLs.
- **Email:** SMTP is **LIVE**, sending from **`hello@ghsbarrie.ca`**. (Falls back
  to log-only if `SMTP_HOST/USER/PASS` are unset.)

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
- **Admin → System health** verifies every connection (DB, S3, email, service
  account, journals, leads) live, and shows the service-account share address.

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
**Resource library** (product manuals/brochures) · **payout calculator** +
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
