import 'server-only';
import { prisma } from './db';

/**
 * Durable, per-user in-app notifications — the "home" a phone/web push lacks.
 * `recordNotifications` is called by the notifier layer (notify.ts, leadNotify,
 * sla, …) alongside the email/push send, so every alert a user gets is also
 * something they can scroll back to, with a per-item read state. Best-effort:
 * recording a feed row must never break the real notification.
 */

export interface NotificationInput {
  title: string;
  body?: string | null;
  url?: string | null;
  category?: string | null;
  applicationId?: string | null;
  customerName?: string | null;
}

/** Pull an application id out of a deep link (e.g. /staff/applications/<id>). */
export function applicationIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/applications\/([a-zA-Z0-9]+)/);
  return m && m[1] !== 'new' ? m[1] : null;
}

/** Write one notification row per recipient. Never throws. */
export async function recordNotifications(userIds: Array<string | null | undefined>, n: NotificationInput): Promise<void> {
  const ids = Array.from(new Set(userIds.filter((x): x is string => !!x)));
  if (ids.length === 0 || !n.title) return;
  const applicationId = n.applicationId ?? applicationIdFromUrl(n.url);
  try {
    await prisma.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        title: n.title,
        body: n.body ?? null,
        url: n.url ?? null,
        category: n.category ?? null,
        applicationId,
        customerName: n.customerName ?? null,
      })),
    });
  } catch (e) {
    console.error('[notifications] record failed', e);
  }
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export interface NotificationVM {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  category: string | null;
  applicationId: string | null;
  customerName: string | null;
  read: boolean;
  createdAtISO: string;
}

export async function listNotifications(userId: string, limit = 60): Promise<NotificationVM[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 200),
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    url: r.url,
    category: r.category,
    applicationId: r.applicationId,
    customerName: r.customerName,
    read: r.readAt !== null,
    createdAtISO: r.createdAt.toISOString(),
  }));
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

/** Keep the table bounded: drop notifications older than N days (any read state). */
export async function pruneOldNotifications(days = 60): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const res = await prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return res.count;
}

// Opportunistic prune: runs at most every 6h per server process, triggered off
// normal reads, so the table stays bounded without a dedicated cron.
let _lastPrune = 0;
export async function maybePruneNotifications(): Promise<void> {
  const now = Date.now();
  if (now - _lastPrune < 6 * 3_600_000) return;
  _lastPrune = now;
  try {
    await pruneOldNotifications(60);
  } catch (e) {
    console.error('[notifications] prune failed', e);
  }
}
