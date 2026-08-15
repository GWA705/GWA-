'use server';

import { getSession } from '@/lib/session';
import { searchCustomers, canSearchAllCustomers, type CustomerSearchResult } from '@/lib/customerSearch';
import { appOverrideKey, rowOverrideKey } from '@/lib/customerOverride';
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
  // Identify the record. A portal deal → applicationId; a journal-only row →
  // year+tab+row. At least one path must be provided.
  applicationId?: string | null;
  year?: number;
  tab?: string;
  row?: number;
  customerName?: string;
  phone?: string;
  address?: string;
  email?: string;
}

export interface UpdateCustomerResult {
  ok: boolean;
  message: string;
  updatedByName?: string;
  updatedAt?: string; // ISO
}

/**
 * Correct a customer's contact details. The original journal row and portal
 * application are NEVER modified — the correction is saved to a separate
 * overrides table and overlaid when the customer is shown, with a "last updated"
 * stamp. Only the GWA team (full customer-search grant) may edit; rate-limited
 * and audited.
 */
export async function updateCustomerInfoAction(input: UpdateCustomerInput): Promise<UpdateCustomerResult> {
  const user = await getSession();
  if (!user) return { ok: false, message: 'Please sign in again.' };
  if (!(await canSearchAllCustomers(user))) {
    return { ok: false, message: 'You don’t have access to edit customer information.' };
  }

  // Resolve the override key from whichever identity we were given.
  let key: string | null = null;
  if (input.applicationId) {
    key = appOverrideKey(input.applicationId);
  } else if (input.tab && input.row && Number.isFinite(input.year)) {
    key = rowOverrideKey(input.year as number, input.tab, input.row);
  }
  if (!key) return { ok: false, message: 'Missing the record reference — reload the search and try again.' };

  // Empty string clears that field's override (falls back to the original).
  const norm = (v: string | undefined) => {
    const t = (v ?? '').trim();
    return t.length ? t : null;
  };
  const phone = norm(input.phone);
  const address = norm(input.address);
  const email = norm(input.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'That email address doesn’t look valid.' };
  }

  const rl = await rateLimit(`cust-edit:${user.userId}`, 30, 60);
  if (!rl.ok) return { ok: false, message: 'Too many changes at once — wait a moment and try again.' };

  const actorName = (await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true } }))?.name ?? null;

  const saved = await prisma.customerContactOverride.upsert({
    where: { key },
    create: {
      key,
      applicationId: input.applicationId ?? null,
      year: input.year ?? null,
      tab: input.tab ?? null,
      row: input.row ?? null,
      customerName: input.customerName ?? null,
      phone,
      address,
      email,
      updatedById: user.userId,
      updatedByName: actorName,
    },
    update: {
      phone,
      address,
      email,
      customerName: input.customerName ?? undefined,
      updatedById: user.userId,
      updatedByName: actorName,
    },
  });

  // Portal deals: also update the live application so the correction shows across
  // the whole portal (deal page, dealer view, reviewer entry). Only non-empty
  // values are written — we never blank an existing field. The sales journal is
  // NEVER modified; its search view shows the correction via the override above.
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
  }

  await audit({
    actorId: user.userId,
    action: 'USER_UPDATE',
    entityType: 'CustomerContactOverride',
    entityId: key,
    detail: `Corrected customer contact (${[phone && 'phone', address && 'address', email && 'email'].filter(Boolean).join(', ') || 'cleared'})${input.applicationId ? ' · portal record updated' : ''}`,
  });

  return { ok: true, message: 'Saved.', updatedByName: saved.updatedByName ?? undefined, updatedAt: saved.updatedAt.toISOString() };
}
