import webpush from 'web-push';
import type { Role } from '@prisma/client';
import { prisma } from './db';

/**
 * Web Push (browser desktop notifications). Best-effort, like email: a failure
 * to send never breaks the action that triggered it. Notifications carry only a
 * low-sensitivity label (first name + last initial) and a link into the portal —
 * no full names or personal data in the payload.
 *
 * Requires a VAPID keypair in env:
 *   VAPID_PUBLIC_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY  (same value)
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT   (a mailto: or https: contact URL; optional)
 * Generate a pair with:  npx web-push generate-vapid-keys
 */

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  const subject = process.env.VAPID_SUBJECT || 'mailto:portal@ghsbarrie.ca';
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function pushEnabled(): boolean {
  return !!(
    (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) &&
    process.env.VAPID_PRIVATE_KEY
  );
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string; // path to open on click, e.g. /staff/applications/<id>
  tag?: string; // collapse key so repeats replace instead of stacking
};

/** Send a payload to every subscription belonging to a user; prune dead ones. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configure()) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await deliver(subs, payload);
}

/**
 * Send to all active users in the given roles (e.g. reviewers/admins). `exclude`
 * skips a user id (e.g. the actor who caused the event).
 */
export async function sendPushToRoles(
  roles: Role[],
  payload: PushPayload,
  opts: { exclude?: string } = {},
): Promise<void> {
  if (!configure()) return;
  const subs = await prisma.pushSubscription.findMany({
    where: {
      user: {
        role: { in: roles },
        active: true,
        ...(opts.exclude ? { id: { not: opts.exclude } } : {}),
      },
    },
  });
  await deliver(subs, payload);
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

async function deliver(subs: Sub[], payload: PushPayload): Promise<void> {
  if (subs.length === 0) return;
  const body = JSON.stringify(payload);
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        // 404/410 mean the subscription is gone — drop it so we stop trying.
        if (status === 404 || status === 410) dead.push(s.id);
        else console.error('[push] send failed', status ?? err);
      }
    }),
  );
  if (dead.length) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } }).catch(() => {});
  }
}
