# Call Recordings — Bell Total Connect (Dubber) → portal

Status: **BUILT on the `staging` branch (deploys to `gwa-portal-staging`). NOT on
production.** Paused mid-integration — resume from this doc.

## What it does
Pulls customer call recordings from Bell Total Connect (which is powered by
**Dubber**, a cloud call-recording platform with a REST API), matches each one
to a deal by the customer's phone number, stores the audio encrypted, and shows
it on the deal page. Also supports manual upload of a recording to a deal.

## What's DONE (committed on `staging`)
- **Data model** — `CallRecording` (prisma/schema.prisma) + migration
  `20260814060000_call_recordings`. Fields: source (`dubber`|`manual`),
  `externalId` (unique, dedupes Dubber re-pulls), from/to numbers, `matchedPhone`,
  `startedAt`, `durationSec`, `storageKey`, `mime`, `sizeBytes`, `transcript`,
  `applicationId` (FK, SetNull), `dealerId`, `uploadedById`.
- **`src/lib/dubber.ts`** — Dubber API client. OAuth2 client-credentials
  (Mashery key+secret) with a cached token; `dubberListRecordings(since)` and
  `dubberDownloadRecording(rec)`. **Inert until `DUBBER_API_KEY` +
  `DUBBER_API_SECRET` are set.** Response fields are normalized defensively.
- **`src/lib/callRecordings.ts`** — `normalizePhone` (last 10 digits),
  `matchApplicationByPhone` (closest-in-time), `ingestDubberRecording` (dedupe +
  download + store + create), `sweepCallRecordings` (pull since newest stored, or
  7 days back), `attachManualRecording`, `listRecordingsForApplication`,
  `deleteRecording`.
- **`src/app/api/call-recordings/[id]/audio/route.ts`** — authenticated,
  access-controlled (internal any; dealer own-deal only), audited playback +
  `?download=1`. Encrypted at rest, no public URLs.
- **`src/app/api/cron/call-recordings/route.ts`** — scheduled sweep, Bearer
  `CRON_SECRET`, no-ops when Dubber unconfigured.
- **Deal page** — `CallRecordings.tsx` section: inline `<audio>` player,
  download, manual upload, staff delete. Wired into
  `src/app/(staff)/staff/applications/[id]/page.tsx`. Server actions
  `uploadCallRecordingAction` / `deleteCallRecordingAction` in
  `src/app/(staff)/actions.ts`.

## What's LEFT to do
1. **Get the Dubber Mashery API key** (key + secret) from the Dubber developer
   platform via the Bell account. May need Bell to enable API access (add-on/cost).
2. **Set env on the staging service:** `DUBBER_API_KEY`, `DUBBER_API_SECRET`
   (optionally `DUBBER_API_BASE`, `DUBBER_ACCOUNT_ID`).
3. **Add a Render Cron Job** on staging → `GET /api/cron/call-recordings` with
   header `Authorization: Bearer <CRON_SECRET>`, every ~15–30 min.
4. **Verify + tune the Dubber client against the REAL API** — the endpoints
   (`/oauth/token`, `/v3/recordings`, `/v3/recordings/{id}/media`) and field
   names in `dubber.ts` follow Dubber's docs but must be confirmed on the live
   account. Grab one real recording payload / any cron error and adjust
   `normalize()` + the URLs.
5. **Tune phone matching** once real call metadata is seen (from/to direction,
   number formatting). Consider co-applicant phone + lead phone as match sources.
6. **Decide retention** (recordings are sensitive PII — set a purge window) and
   confirm consent-to-record wording (PIPEDA).
7. When happy in staging, **promote to production** (merge `staging` →
   `claude/pci-credit-application-portal-vi7d6r`).

## Testable NOW in staging without any Dubber setup
Open a deal → **Call recordings** → **Upload recording** (any audio file) → it
plays inline and downloads. That validates storage + playback + auth end-to-end.

## Notes
- Recordings that don't match a deal by phone are still stored, just with
  `applicationId = null` (a future "unmatched recordings" review screen could
  let staff link them by hand).
- Bell Total Connect Call Recording portal: `callrecording.totalconnect.bell.ca`.
- Dubber API getting-started: support.dubber.net (Mashery key + secret).
