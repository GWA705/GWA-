# Reporting system — design & plan

Turn the portal into the place offices log in to see performance. Two surfaces:
internal analytics (admin/reviewer, company-wide + per-office drill-down) and a
dealer-facing "My Reports" (an office sees only its own numbers).

## Confirmed decisions
- **Month basis:** "$ sold" is dated by the deal's **date of sale**; "$ paid" by
  the **payout date**. Activity/pipeline counts by submission where relevant.
- **Sales figure:** **approved amount** (total sale with tax) — same input the
  payout calculator uses.
- **Dealer access:** reports are OFF by default. **Every dealer-facing report is
  tenant-isolated to the user's own dealership — a distributor sees only their
  own dealer's HD store numbers, NOT all dealers.** Distributors get the report
  suite for their own office; other dealer users see reports only when an admin
  grants it (per-user and/or per-office, mirroring the calculator grant). No
  office ever sees another office's data.
- **Company-wide view (all dealers / national):** super-admin only (Sean + JJ),
  or an explicit leadership-report grant. The weekly leadership snapshot lives
  here. Nobody else — not distributors, not scoped admins — sees cross-dealer
  totals unless granted.

## Report modules
- **KPI scorecard** — this month vs last: deals submitted, $ sold, $ paid,
  # in funding, with up/down deltas.
- **Pipeline board** — deals by stage (submitted → in review → approved →
  awaiting install → in funding → funded → paid; problems flagged) with counts
  and $, split HD vs finance company.
- **Trends** — monthly submitted / $ sold / $ paid (trailing 12 months) +
  weekly submissions.
- **Finance-company breakdown** and **product mix**.
- **Internal only:** office leaderboard; growth insights — new & active dealers,
  submit→fund conversion %, average time-to-fund, month-over-month growth.

## Access control
- Internal: a new "Reports" admin section, permission-gated like the others.
- Dealer: distributor = full; others by grant. Tenant-isolated to own office.

## Data / architecture
- Computed live from Application, Payout, StatusEvent (indexed, date-ranged).
  Consider cached monthly aggregates later if volume warrants.
- Later: CSV / printable export; scheduled weekly & monthly email digests to
  distributors.

## Build order
1. Internal analytics (KPIs, trends, pipeline, per-office).
2. Dealer "My Reports" + access control.
3. Growth insights, leaderboard, exports.
4. Scheduled email digests.

## Open input
- Reviewing the office's existing Google Apps Script reports (code + screenshots)
  to match their current metric definitions and layout exactly, then folding
  those definitions into this spec before building.

---

## Learned from the existing Apps Script (GWA_Weekly.gs v7.10)

The current reports read the **Google Sheets journals** (2026 + 2025) directly and
email branded HTML. Key definitions to mirror so portal numbers tie out:

**A "confirmed sale" (what counts):**
- Valid HD ref: starts `800` OR matches `^7\d{2}` (7xx = "Associate / Online Lead",
  vs 800 = regular — badged differently).
- `RESULT` column (col Q/17) === **`OK`** (the same Pe/OK→OK status).
- Has a **Date Paid** (col 18) within the period; per-store weekly also needs a
  **Date Installed** (col 31).
- Money **value = col 34** (the receivable / EFT payout), filtered `>= $100`.

**So their money-of-record is the PAID/receivable value, dated by Date Paid** —
i.e. the portal's `$ paid` metric (payouts by payout date), NOT gross sale. The
`$ sold` (approved amount, by sale date) is a *booking/pipeline* view they don't
currently have — the portal adds it.

**The analytics pattern that drives their reports (replicate this):**
- **This Year vs Last Year** side by side, with **% change** (green +, red −,
  "New" when LY = 0), at **week / month / YTD** granularity.
- Grouping: by store → **district/region** (hardcoded store→district map), and a
  national grand total.
- Metrics per group: count of confirmed sales (#) and $ value.

**Style to match:** dark navy `#0a1628`, blue `#1a5fa8`, orange `#e07b00`
accent, logo header, TY/LY cards, district table (LY$/LY#/TY$/TY#/VS-LY/YTD),
grand-total row.

## The big fork: data source for reports
- Their reports read the **journals** (years of history → real TY-vs-LY, national
  totals, receivable values).
- The portal DB only has deals **entered through the portal** (no last-year data
  until it accumulates; no deals that never went through the portal).
- Options: (a) portal-native only (grows over time, no LY yet); (b) portal reads
  the journal for the money/history (matches current reports exactly); (c) hybrid
  — portal-native for pipeline/submissions, journal for paid/receivable history.

---

## Target layout: per-office "Monthly Performance Report" (the Barrie example)

This is the format to reproduce in the portal for each office (a distributor/
leadership view). One office (e.g. "Barrie"), broken down by its HD stores.

**Header:** office name, "July 2026 · Monthly Performance Report", "GWA HD HOME
SERVICE" badge; an "INTERNAL COPY — not sent to …" note on the leadership copy.

**Main table — one row per HD store, three comparison blocks:**
- **Month over Month:** prev month $, current month $, **M/M %**.
- **Vs Last Year:** same month LY $, **Y/Y %** ("New" when LY = 0).
- **Year to Date:** TY $, LY $, **YTD %**.
- **Location Total** row across all stores (e.g. June $194,190.94 → July
  $162,270.51, M/M −16.4%; YTD TY $1,403,731.09 vs LY $1,344,411.47, +4.4%).

**PE/OK — Pending Installation block** (below the totals, amber): each store with
$ **awaiting installation**, and a **Total Pending** — explicitly *not included in
the OK totals above*. (This is the portal's pipeline: Pe/OK = approved/awaiting
install, i.e. money booked but not yet paid.)

**Year-to-Date summary:** Jan→period end — TY 2026, LY 2025, TY-vs-LY, dollar gap.

**Styling:** navy header, light table, green +% / red −% / green "New", bold
current-period column, shaded YTD block, dark total row.

**Access:** this internal copy = leadership (Sean + JJ / super-admin). A
distributor sees the same layout for **their own office only**.

## Money & pipeline mapping (confirmed)
- Store/office $ = **paid receivable, RESULT = OK, by Date Paid** (journal / portal
  payouts).
- Pending = **Pe/OK (awaiting installation)** $, shown separately, not in OK total.
- Comparisons: **M/M, Y/Y, YTD** with % change — the core of every report.

---

## Exact definitions from GWA HD Location Reports v8.0 (authoritative)

**Status classification (drives OK vs Pending):**
- `OK` or `O` → **OK** (counts toward the money totals).
- `PE/OK` / `PEOK` / `PE/O` → **PENDING** (awaiting installation; shown in its own
  block, NEVER in the OK totals).
- anything else → ignored. Amount must be `> 0` and not an error (`#`).

**Journal columns (0-based row indices), skip first 5 rows:**
- 2026 journal: store = 6, result/status = 16, amount = 36.
- 2025 journal: store = 5, result/status = 19, amount = 20.
  (Note: the weekly script used a different amount column — confirm which column
  is the true receivable when we wire the hybrid money source.)

**Grouping:** stores → "location/area" via an internal contact sheet
(STORE | MANAGER | AREA). A location = a cluster of HD stores (e.g. Barrie =
7024, 7030, 7135, 7137, 7154, 7164, 7226, 7234, 7244, 7247, 7264). In the portal
a "location" maps to a dealer/office and its assigned HD stores.

**Periods (all computed per run):** current month, previous month (Dec LY if
January), same month last year, YTD this year (Jan→month), YTD last year.

**Per-office report contents (mirror exactly):**
1. Header: office name, "<Month> <Year> · Monthly Performance Report".
2. Table per HD store: prev-month $, current $, M/M %, LY-month $, Y/Y %, then
   YTD (TY $, LY $, YTD %). Green +% / red −% / green "New" when LY=0.
3. Location Total row.
4. PE/OK Pending Installation block (per store awaiting-install $ + total).
5. YTD Summary: TY, LY, TY-vs-LY %, Dollar Gap (± vs last-year pace).
6. "No sales this month" alert list for dead stores.

**Cadence:** monthly, 15th ~8:30am, for the previous month; internal copy to
leadership, live copy to the location's own contacts + CC/BCC.

---

## Exact definitions from the Weekly Snapshot v8 (leadership "JJ + Sean" report)

This is the **company-wide weekly snapshot** (dashboard-card email), distinct from
the per-office monthly report above. Leadership-only. Supersedes v7.10.

**Two report worlds, split on every screen — replicate this split:**
- **Home Depot Program** (`isHD` = the HD Ref# is all digits, ≥ 6 of them) vs
  **GWA Outside-HD** (everything else). Every stat block, funnel, financing chart
  and pending list is computed twice, once per world.

**Money basis here = GROSS SALE (`gross`), dated by DATE OF SALE.** Note the
deliberate contrast with the monthly location report, which uses **paid
receivable by Date Paid**. The portal must keep BOTH and label them clearly:
`$ sold` (gross, by sale date — this weekly snapshot) and `$ paid` (receivable,
by paid date — the monthly report). Gross is derived as `net sale + tax` when the
gross cell is blank; a `#N/A`/`#REF!` formula error is flagged, not derived.

**Result normalization (canonical set = OK / PE/OK / RB):**
- `PEOK`, `PE` → `PE/OK` (pending / awaiting install).
- `RD`, `BR`, `TD`, `PE/TD` → `RB` (customer-cancelled / dead — excluded from money).
- `OK` = confirmed. A week's "deals" = rows with result `OK` **or** `PE/OK`.

**Time windows (all Mon–Sun):** the week that just ended (trigger fires Mon 7am,
steps back 1 day first); previous week (−7d); same week last year (−364d); plus
MTD, YTD, and all-pending. Trailing-3-month monthly average drives a **"% of
pace"** figure (MTD gross ÷ trailing avg).

**Top stat strip (5 tiles):** Sold this week · Month to date · Year to date ·
**Barrie — pending payment** · % of 3-mo pace. Highlight line: ▲/▼ % vs last week,
same-week-last-year $, top location, top financing company.

**"Pending payment" (distinct from PE/OK pending-install!):** a Barrie-location
deal where **Date Paid (col R) is still blank** and result ≠ `RB` — money owed but
not yet landed, *regardless* of OK/PE status. Keep this metric separate from the
PE/OK awaiting-install bucket; they answer different questions ("who do we still
owe?" vs "what's booked but not installed?").

**Deal-status funnel (per world):** Confirmed (OK, this month) → Pending (PE/OK not
yet aged) → **Aging risk** (PE/OK past the warn threshold). `PENDING_WARN_WEEKS = 2`,
`PENDING_ALERT_WEEKS = 4`. Aging deals get a solid-fill "N WKS" badge + row link.

**Pending buckets by sale month:** this month / last month / older, each $ + count.

**Financing normalization (buckets to mirror):** HDFINIT, GHSFINIT, HDUEI, HDCC,
GoodHome, Enercare, Project Loan (HD-only), Cash/Cheque/Etransfer, Credit Card.
Bare `FINIT` resolves by `isHD` (→ HDFINIT if HD, else GHSFINIT). Blank financing
on an OK deal with a cash amount → Cash/Cheque/Etransfer; blank with no cash on an
OK deal is flagged as a data gap.

**Source categories (from HD Ref#):** HD Program (numeric), FNR (New Recruit),
Service, Retest, Home Show, Office/Personal, Referral, Non-HD (Other), GHS Direct.

**Financing totals table:** per company, This Week (count + $) / MTD $ / YTD $,
sorted by YTD.

**Data Health Check (a real feature to port, not just email chrome):** as it reads
the journal it logs data-quality issues — unrecognized result, unreadable date,
unrecognized HD Ref#/financing, missing/underivable gross, **broken formula in the
journal**, OK deal missing financing, Project Loan without an HD number — and the
values it auto-derived (gross from Net+Tax). In the portal this becomes an admin
**"Journal data issues"** panel (count by type + drill-through), so bad journal
rows surface instead of silently skewing the numbers.

**Cadence:** weekly, Monday ~7am, for the week that just ended; leadership only.

---

## Three report shapes to build (consolidated)

1. **Monthly per-office performance** (location report v8.0) — office managers +
   admins; distributor sees own office. Money = paid receivable by Date Paid.
2. **Weekly company snapshot** (snapshot v8) — leadership only (Sean + JJ). Money =
   gross by sale date; HD vs Outside-HD split; funnel + aging + data-health.
3. **Weekly per-store customer detail** (the AIRDRIE-style email) — that store +
   admins; per-customer line items (name, $), store total.

All three share: OK vs PE/OK classification, TY-vs-LY % comparisons, the navy/blue
palette, and journal-as-money-source (hybrid: portal for live pipeline).
