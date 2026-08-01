import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

const SECRET = 'test-webhook-secret';
process.env.FINANCEIT_WEBHOOK_SECRET = SECRET;

// Import AFTER setting the env so the module reads it (it reads at call time).
import { verifyWebhook } from '../src/lib/financeit';

function sign(ts: string, body: string): string {
  return crypto.createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex');
}

describe('verifyWebhook', () => {
  const body = JSON.stringify({ id: 'evt_1', type: 'ping' });
  const ts = String(Math.floor(Date.now() / 1000));

  it('accepts a valid signature + fresh timestamp', () => {
    expect(verifyWebhook(body, sign(ts, body), ts).ok).toBe(true);
  });

  it('accepts a sha256= prefixed signature', () => {
    expect(verifyWebhook(body, `sha256=${sign(ts, body)}`, ts).ok).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(verifyWebhook(`${body} `, sign(ts, body), ts).ok).toBe(false);
  });

  it('rejects a stale timestamp (replay protection)', () => {
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    const r = verifyWebhook(body, sign(old, body), old);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('timestamp_skew');
  });

  it('rejects a missing signature', () => {
    expect(verifyWebhook(body, null, ts).ok).toBe(false);
  });
});
