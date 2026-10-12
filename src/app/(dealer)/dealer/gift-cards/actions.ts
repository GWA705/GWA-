'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireDealerAccess } from '@/lib/session';
import { audit } from '@/lib/audit';
import { notifyGiftCardNote } from '@/lib/notify';
import { getT } from '@/i18n/server';

export interface GiftCardActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Clean an optional phone; returns '' when blank, or null when clearly invalid. */
function cleanPhone(raw: string): string | null {
  const t = raw.trim();
  if (!t) return '';
  const digits = t.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return t;
}

export interface BulkRow {
  name?: string;
  email?: string;
  phone?: string;
  amount?: string | number;
}
export interface BulkResult {
  created: number;
  errors: string[];
}

/**
 * Bulk-create gift-card requests from an uploaded spreadsheet (name, email,
 * optional cell, optional amount — defaults to $25). Validates every row; valid
 * ones are created and any problems are returned line-by-line so the dealer can
 * fix and re-upload. Nothing is created if the whole batch is empty/oversized.
 */
export async function bulkCreateGiftCardRequestsAction(rows: BulkRow[]): Promise<BulkResult> {
  const t = getT();
  const session = await requireDealerAccess();
  if (!session.dealerId) return { created: 0, errors: [t('actionMsg.giftCards.loginNotAttached')] };
  if (!Array.isArray(rows) || rows.length === 0) return { created: 0, errors: [t('actionMsg.giftCards.noRows')] };
  if (rows.length > 500) return { created: 0, errors: [t('actionMsg.giftCards.tooManyRows')] };

  const data: { dealerId: string; requestedById: string; customerName: string; customerEmail: string; customerPhone: string | null; amount: number }[] = [];
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const line = i + 2; // account for the header row + 1-based numbering
    const name = String(r.name ?? '').replace(/\s+/g, ' ').trim();
    const email = String(r.email ?? '').trim().toLowerCase();
    const phone = cleanPhone(String(r.phone ?? ''));
    const amtRaw = String(r.amount ?? '').replace(/[$,\s]/g, '');
    const amount = amtRaw === '' ? 25 : Number(amtRaw);

    if (!name && !email) return; // silently skip fully blank rows
    if (!name) { errors.push(t('actionMsg.giftCards.rowMissingName', { line })); return; }
    if (!EMAIL_RE.test(email)) { errors.push(t('actionMsg.giftCards.rowInvalidEmail', { line, email: email || t('actionMsg.giftCards.blank') })); return; }
    if (phone === null) { errors.push(t('actionMsg.giftCards.rowCellDigits', { line })); return; }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) { errors.push(t('actionMsg.giftCards.rowAmountRange', { line })); return; }

    data.push({ dealerId: session.dealerId!, requestedById: session.userId, customerName: name, customerEmail: email, customerPhone: phone || null, amount });
  });

  if (data.length > 0) {
    await prisma.giftCardRequest.createMany({ data });
    await audit({ actorId: session.userId, action: 'ORDER_SUBMIT', entityType: 'GiftCardRequest', entityId: 'bulk', detail: `Bulk gift-card request: ${data.length} created` });
    revalidatePath('/dealer/gift-cards');
  }
  return { created: data.length, errors: errors.slice(0, 25) };
}

/**
 * A dealer requests a Home Depot gift card for a customer who completed a water
 * test. Goes into the PENDING queue GWA sends from Guusto.
 */
export async function createGiftCardRequestAction(
  _prev: GiftCardActionState,
  formData: FormData,
): Promise<GiftCardActionState> {
  const t = getT();
  const session = await requireDealerAccess();
  if (!session.dealerId) return { error: t('actionMsg.giftCards.loginNotAttached') };

  const customerName = String(formData.get('customerName') || '').replace(/\s+/g, ' ').trim();
  const customerEmail = String(formData.get('customerEmail') || '').trim().toLowerCase();
  const customerPhone = cleanPhone(String(formData.get('customerPhone') || ''));
  const amountRaw = String(formData.get('amount') || '').replace(/[$,\s]/g, '');
  const amount = Number(amountRaw);

  if (!customerName) return { error: t('actionMsg.giftCards.enterCustomerName') };
  if (!EMAIL_RE.test(customerEmail)) return { error: t('actionMsg.giftCards.enterValidCustomerEmail') };
  if (customerPhone === null) return { error: t('actionMsg.giftCards.enterValidCell') };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) return { error: t('actionMsg.giftCards.enterCardAmount') };

  const gc = await prisma.giftCardRequest.create({
    data: {
      dealerId: session.dealerId,
      requestedById: session.userId,
      customerName,
      customerEmail,
      customerPhone: customerPhone || null,
      amount,
    },
  });
  await audit({ actorId: session.userId, action: 'ORDER_SUBMIT', entityType: 'GiftCardRequest', entityId: gc.id, detail: `Gift-card request: ${customerName} <${customerEmail}> $${amount}` });
  revalidatePath('/dealer/gift-cards');
  return { ok: true, message: t('actionMsg.giftCards.requestSubmitted') };
}

/**
 * A dealer corrects a request's contact details (e.g. the customer called to say
 * they never got the card because the email was wrong, or wants it by text). Kept
 * available even after it was sent, so a bad email can be fixed and re-sent. Flags
 * it for staff and drops an automatic note so they see what changed.
 */
export async function editGiftCardRequestAction(
  _prev: GiftCardActionState,
  formData: FormData,
): Promise<GiftCardActionState> {
  const t = getT();
  const session = await requireDealerAccess();
  const id = String(formData.get('requestId') || '');
  const gc = await prisma.giftCardRequest.findUnique({ where: { id } });
  if (!gc || gc.dealerId !== session.dealerId) return { error: t('actionMsg.giftCards.requestNotFound') };
  if (gc.status === 'CANCELLED') return { error: t('actionMsg.giftCards.requestCancelled') };

  const customerName = String(formData.get('customerName') || '').replace(/\s+/g, ' ').trim();
  const customerEmail = String(formData.get('customerEmail') || '').trim().toLowerCase();
  const customerPhone = cleanPhone(String(formData.get('customerPhone') || ''));
  if (!customerName) return { error: t('actionMsg.giftCards.enterCustomerName') };
  if (!EMAIL_RE.test(customerEmail)) return { error: t('actionMsg.giftCards.enterValidCustomerEmail') };
  if (customerPhone === null) return { error: t('actionMsg.giftCards.enterValidCell') };

  const changes: string[] = [];
  if (customerName !== gc.customerName) changes.push(`name → ${customerName}`);
  if (customerEmail !== gc.customerEmail) changes.push(`email → ${customerEmail}`);
  if ((customerPhone || null) !== (gc.customerPhone ?? null)) changes.push(`cell → ${customerPhone || '(none)'}`);
  if (changes.length === 0) return { ok: true, message: t('actionMsg.giftCards.noChanges') };

  await prisma.giftCardRequest.update({
    where: { id },
    data: {
      customerName,
      customerEmail,
      customerPhone: customerPhone || null,
      staffUnread: true,
      notes: { create: { authorId: session.userId, fromDealer: true, body: `Updated contact info: ${changes.join(', ')}.` } },
    },
  });
  await audit({ actorId: session.userId, action: 'ORDER_SUBMIT', entityType: 'GiftCardRequest', entityId: id, detail: `Gift-card contact edited: ${changes.join(', ')}` });
  void notifyGiftCardNote(id, true);
  revalidatePath('/dealer/gift-cards');
  return { ok: true, message: t('actionMsg.giftCards.detailsUpdated') };
}

/** A dealer adds a note to the request's thread (visible to staff). */
export async function addGiftCardNoteAction(
  _prev: GiftCardActionState,
  formData: FormData,
): Promise<GiftCardActionState> {
  const t = getT();
  const session = await requireDealerAccess();
  const id = String(formData.get('requestId') || '');
  const body = String(formData.get('body') || '').trim();
  if (!body) return { error: t('actionMsg.giftCards.enterMessage') };
  if (body.length > 2000) return { error: t('actionMsg.giftCards.messageTooLong') };
  const gc = await prisma.giftCardRequest.findUnique({ where: { id } });
  if (!gc || gc.dealerId !== session.dealerId) return { error: t('actionMsg.giftCards.requestNotFound') };

  await prisma.giftCardRequest.update({
    where: { id },
    data: { staffUnread: true, notes: { create: { authorId: session.userId, fromDealer: true, body } } },
  });
  void notifyGiftCardNote(id, true);
  revalidatePath('/dealer/gift-cards');
  return { ok: true, message: t('actionMsg.giftCards.messageSent') };
}

/** A dealer cancels their own still-pending request (typo, duplicate, etc.). */
export async function cancelGiftCardRequestAction(id: string): Promise<void> {
  const session = await requireDealerAccess();
  const gc = await prisma.giftCardRequest.findUnique({ where: { id } });
  // Only the owning dealer, and only while still pending.
  if (!gc || gc.dealerId !== session.dealerId || gc.status !== 'PENDING') return;
  await prisma.giftCardRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
  revalidatePath('/dealer/gift-cards');
}
