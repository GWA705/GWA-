import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { classifyInboundSms, recordOptOut, removeOptOut } from '@/lib/leadText';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
function twiml(body = EMPTY_TWIML) {
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/xml' } });
}

/**
 * Validate Twilio's X-Twilio-Signature (HMAC-SHA1 of the full URL + the POST
 * params sorted by key and concatenated as key+value, base64, keyed by the auth
 * token). Behind a proxy the reconstructed URL can differ, so this is best-effort
 * and the caller treats a failure conservatively (STOP is always honoured; START
 * is only acted on when the request is verified).
 */
function verifyTwilioSignature(req: NextRequest, params: Record<string, string>): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const sig = req.headers.get('x-twilio-signature');
  if (!token || !sig) return false;
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const url = `${proto}://${host}${req.nextUrl.pathname}`;
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  const expected = crypto.createHmac('sha1', token).update(Buffer.from(data, 'utf-8')).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

/**
 * Twilio inbound-SMS webhook. Honours STOP / ARRET (opt-out) and START (opt back
 * in) so customer replies are respected and logged — a backstop to Twilio's own
 * carrier-level opt-out handling. Replies with empty TwiML so we don't double up
 * on Twilio's standard confirmation.
 */
export async function POST(req: NextRequest) {
  let params: Record<string, string> = {};
  try {
    const form = await req.formData();
    for (const [k, v] of form.entries()) params[k] = typeof v === 'string' ? v : '';
  } catch {
    return twiml();
  }

  const from = params.From || '';
  const body = params.Body || '';
  if (!from) return twiml();

  const verified = verifyTwilioSignature(req, params);
  const kind = classifyInboundSms(body);

  try {
    if (kind === 'stop') {
      // Always honour an opt-out, verified or not — it's the safe direction.
      await recordOptOut(from, 'STOP');
    } else if (kind === 'start' && verified) {
      // Only re-enable texts on a verified request.
      await removeOptOut(from);
    }
  } catch (e) {
    console.error('[sms-inbound] handling failed', e);
  }

  return twiml();
}
