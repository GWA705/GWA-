import 'server-only';

/**
 * Outbound SMS — provider-agnostic, currently with a Twilio path.
 *
 * The portal has no SMS provider wired in yet, so this runs in NOT-CONFIGURED
 * mode by default: `smsEnabled()` is false and `sendSms` returns without sending.
 * Everything that calls it degrades gracefully (e.g. the review request falls
 * back to email only). To switch texting on, set the Twilio env vars below — no
 * code change needed:
 *
 *   TWILIO_ACCOUNT_SID   - your Twilio Account SID (starts "AC...")
 *   TWILIO_AUTH_TOKEN    - your Twilio Auth Token
 *   TWILIO_FROM_NUMBER   - the sending number in E.164 (e.g. +17058120320), or a
 *                          Messaging Service SID (starts "MG...") in the same var
 *
 * Canadian business texting requires the number to be registered (A2P 10DLC for
 * long codes, or toll-free verification) before carriers will deliver reliably.
 */

export function smsEnabled(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

/**
 * Normalize a North-American phone to E.164 (+1XXXXXXXXXX). Returns null when the
 * input doesn't look like a valid 10-digit NANP number, so we never text a
 * malformed number.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) {
    // Already international — accept +1XXXXXXXXXX (11 digits after the +1).
    return /^\+1\d{10}$/.test(d) ? d : /^\+\d{8,15}$/.test(d) ? d : null;
  }
  d = d.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  return null;
}

export interface SendSmsResult {
  sent: boolean;
  channel?: 'SMS' | 'MMS';
  sid?: string;
  reason?: string; // 'not-configured' | 'bad-number' | an error message
}

/**
 * Send a text. Pass `mediaUrl` to send an MMS (a publicly reachable image URL
 * Twilio can fetch); omit it for a plain SMS. `from` overrides the default
 * TWILIO_FROM_NUMBER (used to pick a per-province sending number); it may be a
 * plain E.164 number or a Messaging Service SID (MG…).
 */
export async function sendSms(args: {
  to: string;
  body: string;
  mediaUrl?: string | null;
  from?: string | null;
}): Promise<SendSmsResult> {
  const to = toE164(args.to);
  if (!to) return { sent: false, reason: 'bad-number' };

  if (!smsEnabled()) {
    // Mask the number so no PII lands in logs while SMS is off.
    const masked = to.replace(/^(\+\d{2})\d+(\d{2})$/, '$1***$2');
    console.log(`[sms:not-configured] would text ${masked} (${args.body.length} chars${args.mediaUrl ? ', +media' : ''})`);
    return { sent: false, reason: 'not-configured' };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = (args.from && args.from.trim()) || process.env.TWILIO_FROM_NUMBER!;
  const isMms = !!(args.mediaUrl && args.mediaUrl.trim());

  const form = new URLSearchParams();
  form.set('To', to);
  // A Messaging Service SID (MG...) goes in MessagingServiceSid; a plain number
  // goes in From.
  if (from.startsWith('MG')) form.set('MessagingServiceSid', from);
  else form.set('From', from);
  form.set('Body', args.body);
  if (isMms) form.append('MediaUrl', args.mediaUrl!.trim());

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[sms] send failed', res.status, detail.slice(0, 300));
      return { sent: false, channel: isMms ? 'MMS' : 'SMS', reason: `http_${res.status}` };
    }
    const json = (await res.json().catch(() => null)) as { sid?: string } | null;
    return { sent: true, channel: isMms ? 'MMS' : 'SMS', sid: json?.sid };
  } catch (err) {
    console.error('[sms] send error', err);
    return { sent: false, reason: err instanceof Error ? err.message : 'error' };
  }
}
