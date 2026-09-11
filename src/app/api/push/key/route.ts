import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * The VAPID public key the browser needs to create a push subscription. Served
 * at RUNTIME (not baked into the client bundle at build time) so setting the
 * key in the server environment takes effect immediately — no rebuild — and it
 * can never silently vanish on a later image rebuild. The public key is not a
 * secret (it's handed to every browser that subscribes); the private key stays
 * server-side only. Returns { key: null } when push isn't configured yet, which
 * the UI shows as "not configured on the server."
 */
export async function GET() {
  await requireSession();
  const key = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
  return NextResponse.json({ key });
}
