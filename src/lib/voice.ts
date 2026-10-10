import 'server-only';
import { getSettings } from './settings';
import { toE164 } from './sms';
import { provinceTimezone, localHour } from './leadText';

/**
 * Twilio Voice. Two concerns live here, both reusing the SAME Twilio account as
 * SMS (`sms.ts`) — one account, one bill:
 *
 *  1. CALL-RECORDING GROUNDWORK (off by default) — prepares the portal to record
 *     confirmation calls the way the booking site does. Dormant until the env
 *     vars below are set; nothing dials or records yet (see docs/VOICE.md).
 *
 *  2. LIVE-AGENT "CLICK TO CALL" — the self-booking page can connect a customer
 *     to a booker during staffed hours (rings the bookers' line, then dials the
 *     customer and bridges them). Configured in Admin → Lead auto-text and stored
 *     in AppSetting; only the number already on the lead is ever dialed.
 *
 *   TWILIO_ACCOUNT_SID    - Twilio Account SID ("AC..."), shared with SMS
 *   TWILIO_AUTH_TOKEN     - Twilio Auth Token, shared with SMS
 *   TWILIO_VOICE_CALLER_ID - the verified number calls show as (recording groundwork)
 *   TWILIO_TWIML_APP_SID  - the TwiML App ("AP...") for the call webhook (groundwork)
 *   VOICE_RECORDING_ENABLED - "1" to record calls (dual-channel); consent handling applies
 *
 * Canadian call recording: all-party consent is the safe practice — an audible
 * "this call may be recorded" notice must play before recording. Not implemented
 * here; it belongs in the TwiML when recording is turned on.
 */

// ---------------------------------------------------------------------------
// 1. Call-recording groundwork (unchanged, off by default)
// ---------------------------------------------------------------------------

export interface VoiceConfig {
  accountSid: string;
  authToken: string;
  callerId: string;
  twimlAppSid: string;
  recordingEnabled: boolean;
}

export function voiceEnabled(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_VOICE_CALLER_ID &&
    process.env.TWILIO_TWIML_APP_SID
  );
}

export function voiceRecordingEnabled(): boolean {
  return voiceEnabled() && process.env.VOICE_RECORDING_ENABLED === '1';
}

export function voiceConfig(): VoiceConfig | null {
  if (!voiceEnabled()) return null;
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    callerId: process.env.TWILIO_VOICE_CALLER_ID!,
    twimlAppSid: process.env.TWILIO_TWIML_APP_SID!,
    recordingEnabled: process.env.VOICE_RECORDING_ENABLED === '1',
  };
}

export function voiceStatusLabel(): string {
  if (voiceEnabled()) return voiceRecordingEnabled() ? 'Live — calls recorded' : 'Live — recording off';
  return 'Not set up';
}

// ---------------------------------------------------------------------------
// 2. Live-agent "click to call"
// ---------------------------------------------------------------------------

export const VOICE_KEYS = {
  clickToCall: 'voice.clickToCall',
  bookingLine: 'voice.bookingLine', // the bookers' phone/hunt-group to connect
  fromNumber: 'voice.fromNumber', // caller ID (falls back to TWILIO_FROM_NUMBER)
  hoursStart: 'voice.hoursStart',
  hoursEnd: 'voice.hoursEnd',
} as const;

export interface ClickToCallConfig {
  clickToCall: boolean;
  bookingLine: string | null;
  fromNumber: string | null;
  hoursStart: number;
  hoursEnd: number;
}

export async function clickToCallConfig(): Promise<ClickToCallConfig> {
  const s = await getSettings(Object.values(VOICE_KEYS));
  const hs = Number(s[VOICE_KEYS.hoursStart]);
  const he = Number(s[VOICE_KEYS.hoursEnd]);
  return {
    clickToCall: s[VOICE_KEYS.clickToCall] === 'true',
    bookingLine: s[VOICE_KEYS.bookingLine] || null,
    fromNumber: s[VOICE_KEYS.fromNumber] || null,
    hoursStart: Number.isFinite(hs) ? hs : 9,
    hoursEnd: Number.isFinite(he) ? he : 21,
  };
}

/** Click-to-call only needs the shared SMS account creds (SID + token). */
export function twilioVoiceCredsPresent(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

function withinHours(cfg: ClickToCallConfig, province?: string | null): boolean {
  const h = localHour(new Date(), provinceTimezone(province));
  return h >= cfg.hoursStart && h < cfg.hoursEnd;
}

/** Is a live connect offerable right now (configured + staffed hours)? */
export async function clickToCallAvailable(province?: string | null): Promise<boolean> {
  const cfg = await clickToCallConfig();
  if (!cfg.clickToCall || !cfg.bookingLine || !twilioVoiceCredsPresent()) return false;
  return withinHours(cfg, province);
}

export interface ClickToCallResult { ok: boolean; reason?: string }

/** Connect a booker to this customer now. Uses the lead's stored phone only. */
export async function placeClickToCall(input: { customerPhone: string; province?: string | null }): Promise<ClickToCallResult> {
  const cfg = await clickToCallConfig();
  if (!cfg.clickToCall || !cfg.bookingLine || !twilioVoiceCredsPresent()) return { ok: false, reason: 'not-configured' };
  if (!withinHours(cfg, input.province)) return { ok: false, reason: 'after-hours' };

  const customer = toE164(input.customerPhone);
  if (!customer) return { ok: false, reason: 'bad-number' };
  const booker = toE164(cfg.bookingLine);
  if (!booker) return { ok: false, reason: 'bad-booking-line' };
  const from = (cfg.fromNumber && toE164(cfg.fromNumber)) || process.env.TWILIO_FROM_NUMBER || null;
  if (!from) return { ok: false, reason: 'no-from' };

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = process.env.TWILIO_AUTH_TOKEN!;
  // Booker hears the whisper, then Twilio dials the customer and bridges them.
  const twiml =
    `<?xml version="1.0" encoding="UTF-8"?><Response>` +
    `<Say voice="alice">Connecting you to a customer who asked about a Georgian Water and Air in-home water assessment. Please hold.</Say>` +
    `<Dial callerId="${from}" timeout="25"><Number>${customer}</Number></Dial>` +
    `</Response>`;

  const form = new URLSearchParams();
  form.set('To', booker);
  form.set('From', from);
  form.set('Twiml', twiml);

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    if (!res.ok) {
      const d = await res.text().catch(() => '');
      console.error('[voice] click-to-call failed', res.status, d.slice(0, 300));
      return { ok: false, reason: `http_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[voice] click-to-call error', e);
    return { ok: false, reason: e instanceof Error ? e.message : 'error' };
  }
}
