# Dealer insights & automated digest — plan

Planned 2026-09-13 with Sean. Goal: give each office (dealer) periodic, branded
"here's how you're doing" feedback — lead trends, financing mix (incl. HD credit
cards), VOC — and add tools that make the portal materially more valuable to a
dealer. **Decisions locked** are marked ✅.

## Decisions locked
- ✅ Build BOTH an on-screen digest page AND an emailed digest.
- ✅ Cadence: **weekly** (Mon, prior week) AND **monthly** (1st, prior month).
- ✅ Prioritize all four add-ons after the digest: speed-to-lead, peer
  benchmarking, conversion funnel, HD-promotion overlay.

## What we can source today (no new integrations)
- **Financing mix** from the journal reader's `financeBucket`:
  HD Credit Cards = `HDCC`, FinanceIt = `HDFINIT`, plus `HDUEI`, `GHSFINIT`,
  cash/cheque, etc. Paid $ via `buildFundingReport` (OK deals by date paid).
- **Leads** (`readLeads` + `readLeadCalls`): per-lead date + store + latest call
  outcome → volume, contacted, booked/sold, No-Good, by type, weekly/monthly trend.
- **VOC** (`loadVocReport`): completed reviews, avg rating, rep standings.
- **Office = dealer** with HD stores (`getOffice`), users/emails, and a logo.
- **SMTP live**, `notify.ts` + per-user notify prefs, authenticated cron endpoints,
  bilingual (DeepL + FR dict), report kit + dealer branding.

## The digest — contents (per office, per period, with prior-period deltas)
- Leads received (▲/▼ vs last period), contacted rate, booked/sold, No-Good, top types.
- Lead-volume trend (the weekly/monthly chart), office-scoped.
- Financing: # financed, **# HD Credit Cards**, FinanceIt vs cash, $ funded.
- VOC: completed, avg rating, top reps / contest standing.
- 1–2 plain-language highlight lines ("Leads up 22% vs last week…").
- "View full report" link to the branded, printable portal report.

## Build phases
1. ✅ **Digest engine + web page** — `buildDealerDigest(dealerId, period, offset)`;
   branded `/dealer/reports/digest` ("Snapshot") tab.
2. ✅ **Email + send** — `renderDigestBodyHtml` + `sendDealerDigest`
   (`digestSend.ts`); `Dealer.insightsEnabled` (off by default); recipients =
   every report user at the office; admin **test-send to self** before enabling.
3. ✅ **Schedule** — `/api/cron/dealer-digest?period=week|month` (Bearer
   CRON_SECRET), `DigestLog` dedupe so an office is never emailed twice for the
   same period. **OPS TODO:** add two scheduled crons — weekly (Mon) `?period=week`
   and monthly (1st) `?period=month` — reusing the existing `CRON_SECRET`.
4. **Polish (pending)** — FR translation of the digest, per-user
   subscribe/unsubscribe + one-click unsubscribe link, smart-highlight tuning.

## Add-ons (after the digest) — prioritized
1. **Speed-to-lead + uncalled alerts** — time from lead received → first contact;
   flag leads uncalled > N hours. (Uses leadCall timestamps.)
2. **Peer benchmarking** — anonymized "your office vs network average".
3. **Conversion funnel** — lead→contacted→booked→sold→funded with drop-off,
   per office and per rep.
4. **HD promotion overlay** — tag promo dates; annotate the trend chart to show
   what each promo did.

## Other candidates (not scheduled)
Trend MAP (reuse the existing LeadsMap — leads/deals by geography over time),
goals/pace-to-goal, rep coaching card, first-class contest module (extends VOC
standings), push/SMS nudges (web push already configured), testimonials feed from
5-star VOCs, scheduled CSV/PDF export, anomaly alerts.

## Caveats
Financing/VOC completeness depends on the journal + VOC uploads; rep/office
attribution depends on the journal match rate (validate on first VOC upload).
Every digest states its basis, like the reports do.
