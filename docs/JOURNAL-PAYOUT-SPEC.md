# Journal-driven dealer payout — build spec

Goal: when the GHS team marks a deal paid **in the journal** (Google Sheet
*GHS Sales Journal 2026*), the portal automatically records the payout,
computes the dealer amount, marks the deal **Paid**, and emails the paid
receipt to the dealer's **distributor** — no logging back into the portal.

## Trigger (confirmed)

- **Column Q** = payment status. Values: `Pe/OK` (pending) → `OK` (paid).
- **Column R** = paid date.
- Fire only when **Q = OK AND R has a date** (both, as a safeguard).
- One journal tab per month; the portal already stores each deal's
  `journalTab` + `journalRow` when "Write to Journal" runs, so it reads that
  exact row back.

## Detection (confirmed: instant + polling backstop)

1. **Instant** — a Google Apps Script `onEdit` trigger in the journal. When
   an edit lands in column Q of a data row and the new value is `OK` (and R is
   filled), it POSTs `{ tab, row }` + a shared secret to a new portal webhook
   `POST /api/webhooks/journal-paid`.
2. **Backstop** — a scheduled job `GET /api/cron/journal-payouts`
   (Bearer `CRON_SECRET`, ~every 15 min, same pattern as the backup/OCR crons)
   re-checks funded-but-unpaid deals in case a script edit is missed.

Both call the same idempotent `applyJournalPayout(applicationId)`.

## Scope (confirmed)

Only deals the portal already tracks as **funded / awaiting payment** (status
in the funding stage, with a saved `journalTab`/`journalRow`, and not already
paid). Rows that don't map to such a deal are ignored.

## Payout amount — replicate the HD calculator (confirmed)

Input `T` = the deal's **approved amount** (treated as *total sale with tax*).
Rates are **national**; only the **province tax rate `r`** changes. Steps
(rounding to cents at each step, to match the sheet exactly):

```
subtotal      = round2(T / (1 + r))
hdDiscount    = round2(subtotal * 0.13)
afterHd       = subtotal - hdDiscount
ibxDiscount   = round2(afterHd * 0.0125)
afterIbx      = afterHd - ibxDiscount
hdProgram     = round2(T * 0.04)            // 4% of the gross (with tax)
payout        = round2(afterIbx * (1 + r) - hdProgram)
```

Verified against the NB sheet: T=$4,686.25, r=15% → payout **$3,838.62**. ✓

Note: the tax rate nets out algebraically, so payout ≈ **81.9125% × T**; the
province only shifts the result by a penny or two through per-step rounding.
We still compute per-province to match the sheet to the cent.

### Province tax table (CONFIRM THESE)

| Province | Rate | | Province | Rate |
|---|---|---|---|---|
| ON | 13% | | NB, PE, NL | 15% |
| NS | 14% | | BC, MB | 12% |
| SK | 11% | | QC | 14.975% |
| AB, NT, NU, YT | 5% | | | |

> Nova Scotia is **14%** (HST reduced from 15% on 1 Apr 2025) — kept separate
> from the other Atlantic provinces, which remain 15%.

The rates + the three discount percentages live in **editable admin config**
(a settings block), so a change never needs a code deploy.

## Paid flow — `applyJournalPayout(applicationId)`

1. Guard: deal exists, is funded/awaiting-payment, has a journal row, not
   already auto-paid (`paidAutoSyncedAt` null) and has no existing payout.
2. Read the deal's journal row; require Q=`OK` and R has a date.
3. Compute `payout` via the calculator from `approvedAmount` + `province`.
4. Create a `Payout` (amount = payout, paidOn = R's date, note "Auto from
   journal"), set the deal Paid, stamp `paidAutoSyncedAt`.
5. Email the existing **PayoutReceipt** to the distributor (owner/main
   contact only).
6. Audit `JOURNAL_PAYOUT`.
7. Fully idempotent — webhook + cron are de-duped on `paidAutoSyncedAt`.

## Schema / infra

- `Application.paidAutoSyncedAt DateTime?` (double-fire guard) + migration.
- Routes: `POST /api/webhooks/journal-paid`, `GET /api/cron/journal-payouts`.
- Env: `JOURNAL_WEBHOOK_SECRET` (shared with the Apps Script).
- Render cron entry for the backstop (added like the others).
- Admin **on/off switch** for the whole auto-payout sync (safety).
- The Apps Script snippet to paste into the journal (Extensions → Apps
  Script), reading its secret from a Script Property.

## Safeguards

- Idempotent; only funded, journal-mapped deals.
- Requires BOTH Q=OK and a date in R.
- A cell flipping back to `Pe/OK` never un-pays — logs a warning.
- Ships **disabled**; enable only after verifying the calculator against
  5–10 real deals across provinces.
- All errors logged; the cron continues past a bad row.

## Open items before enabling

1. Confirm the province tax table above (esp. non-HST provinces — is PST
   included in the "total with tax", or GST only?).
2. Verify `computeDealerPayout` against real paid deals across provinces.
3. Confirm non-HD-program deals (FinanceIT, etc.) either use the same
   calculator or are out of scope for auto-payout.
