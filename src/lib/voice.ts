import 'server-only';

/**
 * Twilio Voice — GROUNDWORK ONLY, OFF BY DEFAULT.
 *
 * This prepares the portal to record confirmation calls the way the booking site
 * does, without turning anything on. Like `sms.ts`, it runs in NOT-CONFIGURED
 * mode until the env vars below are set: `voiceEnabled()` is false, no call is
 * ever placed, and the UI shows an inactive "Call recording" panel. Nothing here
 * dials, records, or reaches Twilio yet — wiring the call/recording webhooks is a
 * later, deliberate step (see docs/VOICE.md).
 *
 * It reuses the SAME Twilio account as SMS (`sms.ts`) — one account, one bill:
 *   TWILIO_ACCOUNT_SID    - Twilio Account SID ("AC..."), shared with SMS
 *   TWILIO_AUTH_TOKEN     - Twilio Auth Token, shared with SMS
 *   TWILIO_VOICE_CALLER_ID - the verified number calls show as (E.164, e.g. +17058120320)
 *   TWILIO_TWIML_APP_SID  - the TwiML App ("AP...") that points Twilio at our call webhook
 *   VOICE_RECORDING_ENABLED - "1" to record calls (dual-channel); consent handling applies
 *   VOICE_WEBHOOK_SECRET  - shared secret we require on inbound status/recording webhooks
 *
 * Canadian call recording: at least one-party consent federally, but all-party
 * consent is the safe practice — an audible "this call may be recorded" notice
 * must play before recording. That belongs in the TwiML when recording is turned
 * on; it is NOT implemented here.
 */

export interface VoiceConfig {
  accountSid: string;
  authToken: string;
  callerId: string;
  twimlAppSid: string;
  recordingEnabled: boolean;
}

/**
 * True only when every credential needed to place a recorded call is present.
 * Until then the feature stays dormant and callers must degrade gracefully.
 */
export function voiceEnabled(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_VOICE_CALLER_ID &&
    process.env.TWILIO_TWIML_APP_SID
  );
}

/** Should calls be recorded (only meaningful when voiceEnabled())? */
export function voiceRecordingEnabled(): boolean {
  return voiceEnabled() && process.env.VOICE_RECORDING_ENABLED === '1';
}

/** The resolved config, or null when not configured. Never throws. */
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

// A short, human description of the current voice state for admin/system-health
// surfaces. Keeps the "why is this off" explanation in one place.
export function voiceStatusLabel(): string {
  if (voiceEnabled()) return voiceRecordingEnabled() ? 'Live — calls recorded' : 'Live — recording off';
  return 'Not set up';
}
