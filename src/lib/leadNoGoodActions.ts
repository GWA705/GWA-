'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from './session';
import { isInternal } from './rbac';
import { audit } from './audit';
import { rateLimit } from './ratelimit';
import { readLeads, clearLeadsCache, parseLeadRowId, dealerStoreNumbers, cleanNoGoodReason } from './leads';
import { markLeadNoGood, unmarkLeadNoGood } from './leadsWrite';

/**
 * Mark a lead "No Good" in the portal and write it back to the HD Leads Log
 * Google Sheet, in the exact format the office's Apps Script uses (col O =
 * "No Good", col P = reason, col Q = "Pending — Report to HD", red row). The
 * sheet stays the single source of truth — we write, then bust the read cache
 * so the portal reflects it. A reason is required, and the person who flagged
 * it (their portal login name) is recorded in the reason cell.
 *
 * Dealers may only flag leads that belong to one of their own HD stores; staff
 * may flag any lead.
 */
export async function markLeadNoGoodAction(input: {
  rowId: string;
  bookingId: string;
  reason: string;
}): Promise<{ error?: string }> {
  const user = await getSession();
  if (!user) return { error: 'Please sign in again.' };

  // Keep only the human reason — strip any HD lead email that got pasted in.
  const reason = cleanNoGoodReason(String(input.reason || ''));
  if (!reason) return { error: 'A reason is required to mark a lead No Good.' };

  const parsed = parseLeadRowId(String(input.rowId || ''));
  if (!parsed) return { error: 'Could not identify that lead.' };

  const bookingId = String(input.bookingId || '').trim();
  if (!bookingId) return { error: 'That lead has no booking ID, so it can’t be written back to the log.' };

  const rl = await rateLimit(`leadnogood:${user.userId}`, 30, 60);
  if (!rl.ok) return { error: 'Too many updates — wait a moment.' };

  // Confirm the lead exists and (for dealers) belongs to this office.
  const { leads } = await readLeads();
  const lead = leads.find((l) => l.rowId === input.rowId);
  if (!lead) return { error: 'That lead is no longer in the log — refresh and try again.' };
  if (!isInternal(user)) {
    if (!user.dealerId) return { error: 'Your account isn’t linked to an office.' };
    const stores = await dealerStoreNumbers(user.dealerId);
    if (!stores.includes(lead.storeNumber)) return { error: 'That lead belongs to another office.' };
  }

  const res = await markLeadNoGood(parsed.tab, bookingId, reason, user.name);
  if (!res.ok) return { error: res.error || 'Could not update the leads log.' };

  clearLeadsCache();
  await audit({ actorId: user.userId, action: 'STATUS_CHANGE', entityType: 'Lead', detail: `No Good · ${bookingId} · ${reason.slice(0, 120)}` });
  revalidatePath('/dealer/leads');
  revalidatePath('/staff/leads');
  return {};
}

/** Reverse a No-Good flag (restores col O = "Forwarded", clears P/Q + shading). */
export async function unmarkLeadNoGoodAction(input: {
  rowId: string;
  bookingId: string;
}): Promise<{ error?: string }> {
  const user = await getSession();
  if (!user) return { error: 'Please sign in again.' };

  const parsed = parseLeadRowId(String(input.rowId || ''));
  if (!parsed) return { error: 'Could not identify that lead.' };

  const bookingId = String(input.bookingId || '').trim();
  if (!bookingId) return { error: 'That lead has no booking ID.' };

  const rl = await rateLimit(`leadnogood:${user.userId}`, 30, 60);
  if (!rl.ok) return { error: 'Too many updates — wait a moment.' };

  const { leads } = await readLeads();
  const lead = leads.find((l) => l.rowId === input.rowId);
  if (!lead) return { error: 'That lead is no longer in the log — refresh and try again.' };
  if (!isInternal(user)) {
    if (!user.dealerId) return { error: 'Your account isn’t linked to an office.' };
    const stores = await dealerStoreNumbers(user.dealerId);
    if (!stores.includes(lead.storeNumber)) return { error: 'That lead belongs to another office.' };
  }

  const res = await unmarkLeadNoGood(parsed.tab, bookingId);
  if (!res.ok) return { error: res.error || 'Could not update the leads log.' };

  clearLeadsCache();
  await audit({ actorId: user.userId, action: 'STATUS_CHANGE', entityType: 'Lead', detail: `Un-flagged No Good · ${bookingId}` });
  revalidatePath('/dealer/leads');
  revalidatePath('/staff/leads');
  return {};
}
