# New-lead customer auto-text

When a new lead comes into the portal, the customer gets **one** text letting them
know we received their in-home water assessment request and a team member from
**Home Depot Home Services (serviced by Georgian Water & Air)** will call within
**24–48 hours** to schedule. MMS (with a branded image) is sent first, falling
back to plain SMS.

It's **off by default** and ships in **test mode**, so it can't text real
customers until it's deliberately turned on.

## What triggers it

A text is queued when a lead is created in any of these paths (deduped by the
same lead key the push-notify sweep uses, so one text per customer):

- **In-store scanned card** — a rep's handwritten water-test card (`ScannedLead`,
  source `SCANNED`).
- **Mail-in card** — a card GWA staff uploaded that was mailed to the office
  (source `MAILIN`; the message says "mail-in").
- **Online HD Leads Log** — an online Home Depot booking lead swept in from the
  sheet (source `HD_SHEET`). Only recent leads (within the push-notify age
  window) are texted, so a bulk re-import never blasts old customers.

Each queued text is held until it's within the customer's **local daytime
window** (default 8am–9pm by province) and then sent by the sweep.

## Message

Identifies as "Home Depot Home Services (serviced by Georgian Water & Air)",
states the 24–48 hr callback, notes the call shows as "HD Home Services", and
carries **Reply STOP to opt out** (CASL). Quebec leads get the **French** version.
Edit/preview under **Admin → Lead auto-text**.

## Turning it on (external steps)

1. **Verify a toll-free number for Canada.** Twilio blocks unverified texts to
   Canadian numbers. Use the existing **1-866** (Hosted Messaging keeps its voice
   where it is) + complete **toll-free verification** in the Twilio Console
   (business info, opt-in = lead submitted at HD store / mailed in, sample
   message, volume). ~1–3 weeks. See `BUILD-FACTS.md`.
2. **Twilio env on Elastic Beanstalk:** `TWILIO_ACCOUNT_SID`,
   `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (the verified number, E.164, or a
   Messaging Service `MG…`). These already power the review-request text.
3. **Inbound webhook:** point the Twilio number's "A message comes in" webhook at
   `POST https://portal.ghsbarrie.ca/api/sms/inbound` so STOP/START replies are
   honoured + logged.
4. **Cron:** add a scheduled call (every ~15 min), like the other Render crons:
   `curl -H "Authorization: Bearer $CRON_SECRET" https://portal.ghsbarrie.ca/api/cron/lead-text-sweep`
5. **MMS image (optional):** host a public image (HD + GWA branding — clear HD's
   logo use with Home Depot) and paste its URL under Admin → Lead auto-text.
   Blank = SMS only.
6. **Admin → Lead auto-text:** set a **test number**, keep **test mode ON**, send
   a **sample**, confirm it lands, then turn **test mode OFF** and **enable**.
   Optionally add per-province numbers in the sender map.

## Config (Admin → Lead auto-text, stored in AppSetting)

| Setting | Key | Default |
|---|---|---|
| Enabled | `leadText.enabled` | `false` |
| Test mode | `leadText.testMode` | `true` |
| Test number | `leadText.testNumber` | — |
| MMS image URL | `leadText.mediaUrl` | — |
| Sender map (JSON province→number) | `leadText.senderMap` | — (uses `TWILIO_FROM_NUMBER`) |
| Daytime window start/end (local hour) | `leadText.quietStart` / `leadText.quietEnd` | `8` / `21` |

## Compliance

- **Implied consent** from the lead inquiry (~6 months) covers this relevant,
  transactional message. Every text carries business identification + **STOP**.
- Opt-outs are recorded (`SmsOptOut`) and re-checked before every send; the
  inbound webhook and Twilio's carrier-level opt-out both feed it.
- Keep the message transactional (acknowledgement + callback), not promotional.

## Code

- `src/lib/leadText.ts` — config, enqueue (dedupe/opt-out/flag), EN/FR render,
  province timezone + window, sender pick, sweep (MMS→SMS), opt-out helpers.
- `src/lib/sms.ts` — `sendSms` with MMS (`mediaUrl`) + `from` override.
- Wiring: `src/app/(dealer)/dealer/leads/scanActions.ts`, `src/lib/leadNotify.ts`.
- Endpoints: `src/app/api/cron/lead-text-sweep/route.ts`,
  `src/app/api/sms/inbound/route.ts`.
- Admin: `src/app/(admin)/admin/lead-texting/`.
- Models: `LeadTextOutbox`, `SmsOptOut` (migration `20261009010000_lead_text_outbox`).
