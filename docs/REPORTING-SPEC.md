# Reporting system — design & plan

Turn the portal into the place offices log in to see performance. Two surfaces:
internal analytics (admin/reviewer, company-wide + per-office drill-down) and a
dealer-facing "My Reports" (an office sees only its own numbers).

## Confirmed decisions
- **Month basis:** "$ sold" is dated by the deal's **date of sale**; "$ paid" by
  the **payout date**. Activity/pipeline counts by submission where relevant.
- **Sales figure:** **approved amount** (total sale with tax) — same input the
  payout calculator uses.
- **Dealer access:** reports are OFF by default. **Distributors see the full
  suite** for their office; other dealer users see reports only when an admin
  grants it (per-user and/or per-office, mirroring the calculator grant). No
  office ever sees another office's data.

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
