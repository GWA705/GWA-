import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';

// Store (or refresh) the current user's browser push subscription. Idempotent:
// keyed on the endpoint, so re-subscribing the same browser updates in place and
// re-points it at the current user.
export async function POST(req: Request) {
  const session = await requireSession();
  let body: { subscription?: PushSubscriptionJSON; userAgent?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const sub = body.subscription;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh,
      auth,
      userId: session.userId,
      userAgent: body.userAgent?.slice(0, 300) ?? null,
    },
    update: {
      p256dh,
      auth,
      userId: session.userId,
      userAgent: body.userAgent?.slice(0, 300) ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}

type PushSubscriptionJSON = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};
