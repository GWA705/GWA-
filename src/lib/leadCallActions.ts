'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from './db';
import { getSession } from './session';
import { isInternal } from './rbac';
import { audit } from './audit';
import { rateLimit } from './ratelimit';
import { LEAD_CALL_OUTCOMES } from './leadCalls';
import { getScannedLeadForViewer } from './scannedLeads';
import { pushScannedStatusToBooking, coarseFromCallOutcome } from './bookingPush';
import { readLeads, parseLeadRowId, findLeadByBooking } from './leads';
import { writeLeadDeal } from './leadsWrite';

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

  // Office isolation: a dealer may only log against a lead their office owns.
  // For a scanned lead the key carries its id, so we can verify ownership here
  // (staff/impersonation handled by getScannedLeadForViewer). HD-lead keys are
  // derived from sheet data the dealer already only sees for their own stores,
  // and reads are office-scoped (see readLeadCalls), so a stray write can't
  // surface in another office.
  if (!isInternal(user) && leadKey.startsWith('scanned:')) {
    const scannedId = leadKey.slice('scanned:'.length);
    const owned = await getScannedLeadForViewer(scannedId, user);
    if (!owned) return { error: 'Not found.' };
  }

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
  // For a scanned lead (key `scanned:<id>`), reflect the call outcome on the
  // booker's screen. Fail-safe and inert until configured.
  if (leadKey.startsWith('scanned:')) {
    const coarse = coarseFromCallOutcome(input.outcome);
    if (coarse) await pushScannedStatusToBooking(leadKey.slice('scanned:'.length), coarse, undefined, isInternal(user) ? null : user.dealerId ?? null);
  } else if (leadKey.startsWith('b:')) {
    // An HD-feed lead (keyed by Home Depot booking id). When it's sold or booked
    // here, record it on the shared HD Leads Log (col U) so the booking system
    // stops offering it for a call, and push the status live as a backstop —
    // keyed on the booking id both apps share. Fire-and-forget.
    const coarse = coarseFromCallOutcome(input.outcome);
    const bookingId = leadKey.slice(2).trim();
    if (bookingId && (coarse === 'sold' || coarse === 'booked')) {
      try {
        const { leads } = await readLeads();
        const parsed = (() => {
          const lead = findLeadByBooking(leads, bookingId);
          return lead ? parseLeadRowId(lead.rowId) : null;
        })();
        if (parsed) await writeLeadDeal(parsed.tab, bookingId, coarse);
      } catch (e) {
        console.error('[leadCall] could not write deal to the leads log', e);
      }
      await pushScannedStatusToBooking('', coarse, bookingId);
    }
  }
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
