import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';

// Remove a browser push subscription (the user turned desktop notifications off).
export async function POST(req: Request) {
  const session = await requireSession();
  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!body.endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });

  // Scope the delete to this user so one user can't remove another's subscription.
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: body.endpoint, userId: session.userId },
  });
  return NextResponse.json({ ok: true });
}
