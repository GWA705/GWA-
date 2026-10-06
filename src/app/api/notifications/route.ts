import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import {
  listNotifications,
  unreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  maybePruneNotifications,
} from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/** The signed-in user's notifications + unread count (polled by the bell). */
export async function GET() {
  const session = await requireSession();
  void maybePruneNotifications();
  const [unread, items] = await Promise.all([
    unreadNotificationCount(session.userId),
    listNotifications(session.userId, 60),
  ]);
  return NextResponse.json({ unread, items });
}

/** Mark one notification read ({ id }) or all of them ({ all: true }). */
export async function POST(req: NextRequest) {
  const session = await requireSession();
  const body = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean };
  if (body.all) {
    await markAllNotificationsRead(session.userId);
  } else if (body.id) {
    await markNotificationRead(session.userId, body.id);
  }
  return NextResponse.json({ ok: true, unread: await unreadNotificationCount(session.userId) });
}
