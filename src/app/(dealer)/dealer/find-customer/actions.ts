'use server';

import { getSession } from '@/lib/session';
import { searchCustomers, canSearchAllCustomers, type CustomerSearchResult } from '@/lib/customerSearch';
import { updateJournalRowCells } from '@/lib/journal';
import { clearJournalCache } from '@/lib/reporting/journalRead';
import { prisma } from '@/lib/db';
import { encryptOptional } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/ratelimit';

// Shared by the dealer and staff Find-customer pages. Branches by the caller's
// role inside searchCustomers; enforces the master toggle, rate limit and audit.
export async function customerSearchAction(query: string): Promise<CustomerSearchResult> {
  const user = await getSession();
  if (!user) return { status: 'disabled' };
  return searchCustomers(user, query);
}

export interface UpdateCustomerInput {
  year: number;
  tab: string;
  row: number;
  lastName: string;
  applicationId?: string | null;
  phone?: string;
  address?: string;
  email?: string;
}

export interface UpdateCustomerResult {
  ok: boolean;
  message: string;
}

/**
 * Update a customer's contact details from the search snapshot. Writes phone /
 * address back to the journal row, and — when the row is a portal deal — the
 * portal record too (including email, which the journal has no column for). Only
 * the GWA team (full customer-search grant) may edit; every change is audited.
 */
export async function updateCustomerInfoAction(input: UpdateCustomerInput): Promise<UpdateCustomerResult> {
  const user = await getSession();
  if (!user) return { ok: false, message: 'Please sign in again.' };
  if (!(await canSearchAllCustomers(user))) {
    return { ok: false, message: 'You don’t have access to edit customer information.' };
  }

  // Basic guards.
  if (!input.tab || !input.row || !input.lastName || !Number.isFinite(input.year)) {
    return { ok: false, message: 'Missing the journal row reference — reload the search and try again.' };
  }
  const phone = (input.phone ?? '').trim();
  const address = (input.address ?? '').trim();
  const email = (input.email ?? '').trim();
  if (!phone && !address && !email) return { ok: false, message: 'Nothing to change.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'That email address doesn’t look valid.' };
  }

  const rl = await rateLimit(`cust-edit:${user.userId}`, 30, 60);
  if (!rl.ok) return { ok: false, message: 'Too many changes at once — wait a moment and try again.' };

  // 1. Journal row (phone / address).
  let journalNote = '';
  if (phone || address) {
    try {
      const res = await updateJournalRowCells(
        input.year,
        input.tab,
        input.row,
        { phone: phone || null, address: address || null },
        input.lastName,
      );
      if (res.error && res.wrote.length === 0) return { ok: false, message: res.error };
      journalNote = res.error ? ` (${res.error})` : '';
    } catch (e) {
      console.error('[customer-edit] journal write failed', e);
      return { ok: false, message: 'Could not update the journal. The service account may not have edit access to that sheet.' };
    }
  }

  // 2. Portal deal, when this row came from one.
  if (input.applicationId) {
    const data: Record<string, unknown> = {};
    if (phone) data.applicantPhone = phone;
    if (email) data.applicantEmail = email;
    if (address) data.applicantAddressEnc = encryptOptional(address);
    if (Object.keys(data).length > 0) {
      await prisma.application.update({ where: { id: input.applicationId }, data }).catch((e) => {
        console.error('[customer-edit] portal update failed', e);
      });
    }
  } else if (email) {
    // No portal record and the journal has no email column — nothing to save it to.
    journalNote += ' Email isn’t stored in the journal, so it wasn’t saved for this deal (no portal record).';
  }

  await audit({
    actorId: user.userId,
    action: 'USER_UPDATE',
    entityType: 'JournalCustomer',
    entityId: `${input.tab}:${input.row}`,
    detail: `Edited customer contact (${[phone && 'phone', address && 'address', email && 'email'].filter(Boolean).join(', ')})${input.applicationId ? ` · app ${input.applicationId}` : ''}`,
  });

  // Next search should reflect the change.
  clearJournalCache();

  return { ok: true, message: `Saved.${journalNote}` };
}
