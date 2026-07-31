# Reviewer 2-hour "not looked at" alert

When a **new deal** (a submitted application or a submitted funding package) has
been waiting **more than 2 hours** and **no reviewer has looked at it yet**, the
portal emails all active reviewers/admins a summary with a link to the queue.

- **Only sends 8am–10pm** (America/Toronto), every day. A deal that crosses the
  2-hour mark overnight is alerted at the next 8am run.
- **Re-sends at most once per ~2 hours** while a deal stays untouched, so it
  keeps nudging without spamming.
- Reviewers can turn it off per-person in **My account → Email me when… → "A new
  deal waits over 2 hours…"**.
- "Looked at" means a reviewer has taken an action on the deal (Start review,
  a decision, a note, verifying a document, etc.). The moment any reviewer acts,
  the deal drops out of the alert.

## How it runs

The logic lives in `src/lib/sla.ts` (`runAttentionAlerts`). It is triggered by a
protected endpoint:

```
GET/POST /api/cron/attention-alerts
Authorization: Bearer <CRON_SECRET>      (or ?key=<CRON_SECRET>)
```

The endpoint is safe to call all day — outside 8am–10pm it simply no-ops.

### Setup (one time)

1. **Set a secret** in Render → your web service → **Environment**:
   ```
   CRON_SECRET = <a long random string>
   ```
   (Also make sure `APP_URL = https://portal.ghsbarrie.ca` is set, so the email
   link points at the live site.)

2. **Create a Render Cron Job** (New → Cron Job, same repo/region):
   - **Schedule:** `*/15 * * * *` (every 15 minutes)
   - **Command:**
     ```
     curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
       https://portal.ghsbarrie.ca/api/cron/attention-alerts
     ```
   - Add the same `CRON_SECRET` env var to the cron job.

   (Any scheduler works — cron-job.org, GitHub Actions, etc. — as long as it
   hits the URL with the secret.)

## Testing

- Admin → **Email** page → **Reviewer 2-hour alert** → **Run the 2-hour check
  now**. It reports what happened (deals found + emails sent, "no deals
  waiting", or "outside business hours").
- To force a real send, have a dealer submit a deal, wait 2 hours (during
  business hours) without any reviewer touching it, then run the check.

## Tuning (in `src/lib/sla.ts`)

- `WAIT_MINUTES` — the 2-hour threshold (120).
- `BUSINESS_START_HOUR` / `BUSINESS_END_HOUR` — 8 and 22.
- `BUSINESS_TZ` — `America/Toronto`.
- Scope: currently only brand-new deals with no reviewer action. To also alert
  on in-progress deals that got a new dealer document/note, widen the `where` in
  `runAttentionAlerts` to the full "needs attention" set.
