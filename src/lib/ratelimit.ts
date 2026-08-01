import { headers } from 'next/headers';
import { prisma } from './db';

/**
 * Durable fixed-window rate limiter, backed by the DB so limits hold across the
 * multiple app instances Render runs (an in-memory limiter would not). Each call
 * counts one hit against `key` within a rolling `windowSeconds` window.
 *
 * Fails OPEN on a limiter/DB error — a limiter outage should not lock users out
 * of the whole app — but logs so it is visible.
 */
export interface RateResult {
  ok: boolean;
  retryAfterSec: number;
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
    console.error('[ratelimit] error (failing open)', e);
    return { ok: true, retryAfterSec: 0 };
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
