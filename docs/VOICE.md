# Twilio Voice — call recording (groundwork, OFF)

Status: **not live.** The portal is *prepared* to record phone calls (the
confirmation call in particular) the way the booking site does, but nothing
dials, records, or reaches Twilio yet. This note is the map for turning it on
later. Read with `src/lib/voice.ts` (the config/enable gate) and the
`CallRecording` model in `prisma/schema.prisma`.

## Why it's built this way

- **Same Twilio account as SMS.** `src/lib/sms.ts` already talks to Twilio for
  texting. Voice reuses the *same* `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` —
  one account, one bill — so there's nothing new to sign up for.
- **Recordings live on the deal.** The `CallRecording` table hangs off
  `Application`, so a recording is attached to the customer's deal/profile and is
  pulled up exactly like documents and the confirmation record — no separate
  store. The audio is kept in our own storage (`recordingStorageKey`), not
  hot-linked from Twilio, so it stays and stays access-controlled.
- **Dormant until configured.** `voiceEnabled()` is false until the env vars
  below are set. While off, the deal page's "Call recording" panel shows an
  inactive notice and no call path runs.

## To turn it on later (deliberate, not automatic)

1. **Env vars** (Render → the portal service), on top of the existing SMS ones:
   - `TWILIO_VOICE_CALLER_ID` — the verified E.164 number calls show as.
   - `TWILIO_TWIML_APP_SID` — a TwiML App (`AP…`) whose Voice URL points at our
     call webhook.
   - `VOICE_RECORDING_ENABLED=1` — actually record (dual-channel).
   - `VOICE_WEBHOOK_SECRET` — a shared secret our webhooks require.
2. **Build the webhooks** (the part intentionally NOT written yet):
   - an API route that returns TwiML to start the call and begin recording,
   - a status/recording-callback route that, on `recording completed`, downloads
     the audio to our storage and writes a `CallRecording` row for the deal,
   - signature/secret verification on both (never trust an unauthenticated POST).
3. **Consent.** Canadian call recording is one-party consent federally, but play
   an audible "this call may be recorded" notice first (all-party consent is the
   safe practice). Put it in the TwiML before `<Record>`.
4. **UI.** Flip the deal page's `CallRecordingPanel` to list rows from
   `CallRecording` with a player that streams from our storage via a
   signed/access-checked route (reuse the document-download pattern).

## What is in the repo today

- `src/lib/voice.ts` — `voiceEnabled()`, `voiceRecordingEnabled()`,
  `voiceConfig()`, `voiceStatusLabel()`. No network calls.
- `CallRecording` model + `20261004130000_call_recording` migration (an empty,
  additive table; safe to ship — nothing writes to it yet).
- `CallRecordingPanel` on the staff deal page, showing the inactive state.
