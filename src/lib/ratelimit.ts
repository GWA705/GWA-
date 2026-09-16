import { headers } from 'next/headers';
import { prisma } from './db';

/**
 * Durable fixed-window rate limiter, backed by the DB so limits hold across the
 * multiple app instances Render runs (an in-memory limiter would not). Each call
 * counts one hit against `key` within a rolling `windowSeconds` window.
 *
 * If the DB is unavailable it falls back to a **per-instance in-memory** limiter
 * rather than failing fully open — so brute-force protection on login/MFA/reset
 * doesn't disappear during a DB blip. (Per-instance is weaker than the shared DB
 * window but far better than no limit; on the current single-instance deploy it's
 * effectively global.)
 */
export interface RateResult {
  ok: boolean;
  retryAfterSec: number;
}

// In-memory fallback window, used only when the DB call throws.
const memWindows = new Map<string, { count: number; resetAt: number }>();

function memRateLimit(key: string, limit: number, windowSeconds: number): RateResult {
  const now = Date.now();
  // Opportunistic prune so the map can't grow without bound during an outage.
  if (memWindows.size > 5000) {
    for (const [k, w] of memWindows) if (w.resetAt <= now) memWindows.delete(k);
  }
  const cur = memWindows.get(key);
  if (!cur || cur.resetAt <= now) {
    memWindows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, retryAfterSec: 0 };
  }
  if (cur.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }
  cur.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);
  try {
    const existing = await prisma.rateLimit.findUnique({ where: { key } });
    if (!existing || existing.resetAt <= now) {
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
      return { ok: true, retryAfterSec: 0 };
    }
    if (existing.count >= limit) {
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000)),
      };
    }
    await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    return { ok: true, retryAfterSec: 0 };
  } catch (e) {
    console.error('[ratelimit] DB error — using in-memory fallback', e);
    return memRateLimit(key, limit, windowSeconds);
  }
}

/** Best-effort client IP from the proxy headers (Render sits behind a proxy). */
export function clientIp(): string {
  const h = headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown'
  );
}
