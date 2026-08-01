import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { pushEnabled, sendPushToUser } from '@/lib/push';

// Send a test desktop notification to the current user's own browsers, so they
// can confirm notifications are working right after enabling them.
export async function POST() {
  const session = await requireSession();
  if (!pushEnabled()) {
    return NextResponse.json({ error: 'Push is not configured on the server.' }, { status: 503 });
  }
  await sendPushToUser(session.userId, {
    title: 'GWA Portal',
    body: 'Desktop notifications are on. You’ll see deal activity here.',
    url: session.role === 'DEALER_USER' ? '/dealer' : '/staff',
    tag: 'gwa-test',
  });
  return NextResponse.json({ ok: true });
}
