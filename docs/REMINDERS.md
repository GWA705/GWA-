# Dealer idle-deal reminders

Automatic nudges to a **dealer** (email + push) when a deal is sitting in their
court and hasn't moved. Keeps approved deals from stalling on missing paperwork
and makes sure flagged problems get looked at.

## When a deal counts as "waiting on the dealer"

A deal is in the dealer's court when its status is one of:

- **Approved** — waiting for the funding paperwork (signed contract, void
  cheque/PAP, install photos, signed HD docs, ID).
- **Conditionally approved** — waiting for the additional documents requested.
- **Problem** — something was flagged and needs the dealer to fix it.

The waiting clock starts when GWA last acted on the deal
(`lastReviewerActionAt`, e.g. when it was approved or flagged).

## The standard schedule

| When | Reminders |
|---|---|
| First 24 hours | none (grace — give them the first day) |
| Day 1 | **two** — morning + afternoon (~3pm) |
| Day 2 | one (morning) |
| Days 3–5 | every other day (day 3 and day 5), once each |
| After 5 days | about twice a week, each a ⚠️ **priority** message |

- Reminders only send between **8am and 9pm**, never more than **twice a day**.
- Every message says **what the deal is waiting for** — the problem note, or a
  plain "waiting on your funding paperwork" line.
- The deal is referred to only by first name + last initial in the message;
  the full detail is behind the login.

All of this is an **adjustable rule set** in **Admin → Dealer reminders**
(grace period, send hours, morning/afternoon times, the every-other-day cutoff,
the priority threshold, the twice-a-week gap, and the daily cap). "Reset to
defaults" restores the table above. Defaults live in
`DEFAULT_REMINDER_CONFIG` (`src/lib/reminders.ts`); overrides are stored in the
`AppSetting` row `reminders.dealerIdle`.

## Who gets them

Dealer users of the deal's dealership who are **active** and have **"A deal is
waiting on me"** turned on (My account → notifications; on by default). Each gets:

- an **email** (needs SMTP configured — Admin → Email; otherwise it's logged), and
- a **push** notification to any device where they've enabled notifications.

## How it runs

`runDealerReminders()` (`src/lib/reminders.ts`) is the engine. It's driven by a
scheduler hitting the protected endpoint:

```
POST /api/cron/dealer-reminders
Authorization: Bearer <CRON_SECRET>
```

Set this up as a **Render Cron Job** running every ~15 minutes:

```
*/15 * * * *   curl -fsS -X POST https://portal.ghsbarrie.ca/api/cron/dealer-reminders \
                 -H "Authorization: Bearer $CRON_SECRET"
```

Running it all day is fine — off-hours runs no-op. Admins can also press
**Run the reminder check now** on the Dealer reminders page.

Each send is written to the `DealerReminder` table, which is how the engine
enforces the per-day cap, the every-other-day step-down, and the twice-a-week
tail without double-sending.

## Env

- `CRON_SECRET` — shared secret for the cron endpoints (same one the 2-hour
  reviewer alert uses).
- `VAPID_*` — for push (see docs/PUSH-NOTIFICATIONS.md).
- SMTP vars — for email (see Admin → Email).
