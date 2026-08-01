# FinanceIt API integration

This describes the **security scaffolding** for integrating with FinanceIt —
inbound webhooks and outbound API calls. It ships **dormant**: nothing activates
until the env vars are set, so it's safe to deploy today. When you sit down with
FinanceIt's API docs, you plug in the real secret, endpoints, event names, and
handlers.

## What's built (ready now)

- **Inbound webhook endpoint:** `POST /api/webhooks/financeit`
  - **HMAC-SHA256 signature verification** over the raw request body (timing-safe).
  - **Replay protection** via a signed, recent timestamp (default ±5 min).
  - **Idempotency:** each delivery's event id is unique in the `WebhookEvent`
    table, so FinanceIt's retries are recorded once and never re-processed.
  - **Body-size cap** (64 KB) and **per-IP rate limit**.
  - Every delivery is recorded in `WebhookEvent` and written to the audit log.
- **Outbound client:** `financeitFetch()` in `src/lib/financeit.ts`
  - TLS verification on, hard timeout (10s), bounded exponential backoff on
    GET 5xx/network errors, credentials from env only, never logged.
- **Data model:** `WebhookEvent` (source, eventId unique, type, status,
  applicationId, error, timestamps).

## What you provide / confirm before go-live

1. **Secret & keys** (set in Render → Environment):
   - `FINANCEIT_WEBHOOK_SECRET` — the HMAC secret FinanceIt signs webhooks with.
   - `FINANCEIT_API_KEY` — bearer/API key for outbound calls.
   - `FINANCEIT_API_BASE` — the real outbound base URL.
2. **Signature scheme** — the code defaults to HMAC-SHA256 over
   `"<timestamp>.<rawBody>"`, signature in header `x-financeit-signature`
   (a `sha256=` prefix and comma-separated lists are tolerated), timestamp in
   `x-financeit-timestamp`. **Confirm FinanceIt's actual header names + signed
   string** and adjust `verifyWebhook()` / the route if they differ.
3. **Event contract** — the field names for the event id/type (the route tries
   `id`/`event_id`/`eventId` and `type`/`event_type`/`eventType`) and the list of
   event types you care about (approval, decline, funding status, …).
4. **Handlers** — implement each event in `dispatch()` in the route. Do the deal
   state change **in a transaction** and set `WebhookEvent.status` to `PROCESSED`.
   Until then, unknown events are safely recorded as `IGNORED` and never mutate a
   deal.
5. **IP allowlist (optional)** — if FinanceIt publishes source IP ranges, add an
   allowlist check as defense-in-depth on top of the HMAC.

## Still recommended for the lender flow (tracked in SECURITY-AUDIT.md)

- A reconciliation job (poll FinanceIt for deals in non-terminal states) so a
  missed webhook doesn't strand a deal.
- Security-event monitoring/alerting (webhook signature failures, API error
  rates, PII-access spikes).
- Production KMS for the encryption master key.
- A third-party penetration test before processing real deals.

## Testing before go-live

- With the secret set, send a signed test payload (compute
  `HMAC-SHA256("<ts>.<body>", secret)`); a valid one returns `{ ok: true }`,
  a tampered one returns 401, and a repeat of the same event id returns
  `{ ok: true, duplicate: true }` without re-processing.
