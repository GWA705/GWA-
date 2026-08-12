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
