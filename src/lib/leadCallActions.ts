'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from './db';
import { getSession } from './session';
import { isInternal } from './rbac';
import { audit } from './audit';
import { rateLimit } from './ratelimit';
import { LEAD_CALL_OUTCOMES } from './leadCalls';

/**
 * Log a follow-up call (or a plain note) on a lead. Available to any signed-in
 * dealer or staff user. Dealers' calls are attributed to their own office. The
 * lead itself lives in the Google Sheet — we only store the activity, keyed to
 * the lead's stable key (see leadKeyOf).
 */
export async function logLeadCallAction(input: {
  leadKey: string;
  outcome: string;
  note?: string;
}): Promise<{ error?: string }> {
  const user = await getSession();
  if (!user) return { error: 'Please sign in again.' };
  if (!(LEAD_CALL_OUTCOMES as readonly string[]).includes(input.outcome)) return { error: 'Unknown outcome.' };
  const leadKey = String(input.leadKey || '').trim().slice(0, 160);
  if (!leadKey) return { error: 'Missing lead.' };

  const rl = await rateLimit(`leadcall:${user.userId}`, 60, 60);
  if (!rl.ok) return { error: 'Too many updates — wait a moment.' };

  try {
    await prisma.leadCall.create({
      data: {
        leadKey,
        dealerId: isInternal(user) ? null : user.dealerId ?? null,
        outcome: input.outcome,
        note: (input.note ?? '').trim().slice(0, 500) || null,
        actorId: user.userId,
        actorName: user.name,
      },
    });
  } catch {
    return { error: 'Call tracking isn’t available yet — try again in a minute.' };
  }
  await audit({ actorId: user.userId, action: 'STATUS_CHANGE', entityType: 'LeadCall', detail: `${input.outcome} · ${leadKey}` });
  revalidatePath('/dealer/leads');
  revalidatePath('/staff/leads');
  return {};
}

/** Undo/remove a logged call (only the person who logged it, or staff). */
export async function deleteLeadCallAction(id: string): Promise<{ error?: string }> {
  const user = await getSession();
  if (!user) return { error: 'Please sign in again.' };
  try {
    const call = await prisma.leadCall.findUnique({ where: { id }, select: { actorId: true } });
    if (!call) return {};
    if (!isInternal(user) && call.actorId !== user.userId) return { error: 'You can only remove your own entries.' };
    await prisma.leadCall.delete({ where: { id } });
  } catch {
    return { error: 'Could not remove that.' };
  }
  revalidatePath('/dealer/leads');
  revalidatePath('/staff/leads');
  return {};
}
