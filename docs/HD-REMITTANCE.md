# Home Depot remittance → auto-fund

How Home Depot payments flow into the portal and mark deals **Funded**.

## What it does

A remittance (HD pays us Mon/Wed/Fri) lists invoices by **HD ID #**, which is the
portal's **HD Customer #** (`hdReference` on a deal), plus any chargebacks.
Ingesting one:

- matches each line to a deal by `hdReference`,
- marks a matched, positive deal **FUNDED** (a money-free status event — the
  dealer sees "Funded", never the dollar amount),
- flags **chargebacks** with an internal note on the deal for the refund flow,
- lists **unmatched** lines for a reviewer to chase.

**All dollar figures are internal** (reviewer/admin only). They live on
`HdRemittanceLine`; nothing from a remittance is ever rendered on a dealer page.

Reviewers/admins see it at **Deals → HD Remittances** (`/staff/remittances`):
enter one by hand, or view what the webhook posted, drill into each line, and see
the running "unmatched" attention count.

## Three ways in (all supported)

0. **Upload the HD PDF in the portal** (Deals → HD Remittances → *Upload the HD
   remittance PDF*). The portal extracts the invoice rows and document number
   from Home Depot's "Remittance Advice" PDF and processes it — no Google
   dependency, works from a phone. The raw HD PDF has no customer names, so lines
   show HD # + amount only (matching to a deal is by HD # regardless). Parser:
   `parseHdRemittanceText()` in `src/lib/hdRemittance.ts`.


### 1. Automatic — webhook from the Google Apps Script

The existing "GWA Remittance Processor" already parses the HD PDF and matches
names. Add one call at the end of `buildAndSendReport_` (after it builds
`matched`) to POST the lines into the portal:

```javascript
// After matched/matchedDebits are built, before/after sendEmail_:
function postToPortal_(matched, matchedDebits, docNumber, payDate) {
  const lines = [];
  matched.forEach(m => lines.push({
    hdIdNumber: m.hdIdNumber, amount: m.netAmount,
    customerName: m.customerName, invoiceDate: m.invoiceDate
  }));
  matchedDebits.filter(d => d.type === "CHARGEBACK").forEach(d => lines.push({
    hdIdNumber: d.hdIdNumber, amount: -Math.abs(d.amount),
    customerName: d.customerName, invoiceDate: d.invoiceDate, isChargeback: true
  }));
  UrlFetchApp.fetch("https://portal.ghsbarrie.ca/api/hd-remittance/ingest", {
    method: "post", contentType: "application/json",
    headers: { Authorization: "Bearer " + CRON_SECRET },  // same secret as the cron jobs
    payload: JSON.stringify({ documentNumber: docNumber, paymentDate: payDate, lines }),
    muteHttpExceptions: true
  });
}
```

Add `CRON_SECRET` as a Script Property (same value as on the `gwa-portal`
service). The endpoint is **idempotent by `documentNumber`**, so a re-run or a
manual entry of the same remittance won't double-fund.

**Endpoint:** `POST /api/hd-remittance/ingest`
**Auth:** `Authorization: Bearer <CRON_SECRET>`
**Body:**

```json
{
  "documentNumber": "12345678",
  "documentDate": "09/09/2026",
  "paymentDate": "09/09/2026",
  "lines": [
    { "hdIdNumber": "800251590", "amount": 8246.07, "customerName": "LAURA LETIEC", "invoiceDate": "09/01/2026" },
    { "hdIdNumber": "800244079", "amount": -9148.83, "isChargeback": true }
  ]
}
```

Returns `{ ok, lineCount, funded, chargebacks, unmatched:[…] }`.

### 2. Manual — paste in the portal

**Deals → HD Remittances → Enter a remittance manually.** Paste one line per row:

```
800251590, 8246.07, LAURA LETIEC
800244079, -9148.83, ALEXA OLIVARES
```

`HD ID, amount, customer name` — a negative amount is a chargeback.

## Notes

- Matching is by digits of `hdReference`; if two deals share an HD #, the newest
  wins.
- A deal already `FUNDED` (or declined/withdrawn/draft) is left as-is; only its
  line is linked.
- Reused secret: this reuses `CRON_SECRET` (already set on the service and the
  cron jobs) — no new environment variable.
