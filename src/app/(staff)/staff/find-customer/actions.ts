'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { notifyNewNote } from '@/lib/notify';
import { findCardData, CARD_BLOCK_MESSAGE } from '@/lib/cardscan';
import { isGlobalSearchEnabled } from '@/lib/settings';
import { canSearchAllCustomers } from '@/lib/customerSearch';
import { normalizeCallPhone } from '@/lib/customerCalls';
import { getOverride, appOverrideKey, overlay } from '@/lib/customerOverride';

export interface MsgState {
  ok?: boolean;
  error?: string;
}

/**
 * A GWA agent leaves a message for the customer's office after a call — stored as
 * a dealer-visible note on the deal, which notifies the office (email + in-portal)
 * that the customer called and what about.
 */
export async function messageOfficeAction(applicationId: string, _prev: MsgState, formData: FormData): Promise<MsgState> {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await isGlobalSearchEnabled()) || !(await canSearchAllCustomers(user))) return { error: 'You don’t have access to do this.' };

  const message = String(formData.get('message') || '').trim();
  if (message.length < 2) return { error: 'Write a message for the office.' };

  const card = findCardData(message);
  if (card.blocked) {
    await audit({ actorId: user.userId, action: 'CARD_DATA_BLOCKED', entityType: 'Application', entityId: applicationId, detail: 'Office message blocked — card data detected' });
    return { error: CARD_BLOCK_MESSAGE };
  }

  const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { id: true } });
  if (!app) return { error: 'Customer not found.' };

  await prisma.note.create({
    data: { applicationId, authorId: user.userId, body: `📞 Customer called GWA — ${message}`, internal: false },
  });
  await notifyNewNote(applicationId, 'REVIEWER');
  await audit({ actorId: user.userId, action: 'CUSTOMER_SEARCH', entityType: 'Application', entityId: applicationId, detail: 'messaged office about a customer call' });
  return { ok: true };
}

export interface CallState {
  ok?: boolean;
  error?: string;
}

/**
 * Log a call from a customer — a short, dated note that powers the "how many
 * times have they called" snapshot. When "forward" is set, it ALSO notifies the
 * office that owns the customer, reusing the same dealer-visible-note + notify
 * path as messageOfficeAction (and stamps the call as forwarded).
 */
export async function logCustomerCallAction(applicationId: string, _prev: CallState, formData: FormData): Promise<CallState> {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await isGlobalSearchEnabled()) || !(await canSearchAllCustomers(user))) return { error: 'You don’t have access to do this.' };

  const note = String(formData.get('note') || '').trim();
  const forward = String(formData.get('forward') || '') === 'on';
  if (note.length < 2) return { error: 'Add a short note about the call.' };
  if (note.length > 2000) return { error: 'Note is too long.' };

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, applicantFirstName: true, applicantLastName: true, applicantPhone: true, dealerId: true },
  });
  if (!app) return { error: 'Customer not found.' };

  // Only block card data when the note will leave our walls (forwarded to the office).
  if (forward) {
    const card = findCardData(note);
    if (card.blocked) {
      await audit({ actorId: user.userId, action: 'CARD_DATA_BLOCKED', entityType: 'Application', entityId: applicationId, detail: 'Customer-call forward blocked — card data detected' });
      return { error: CARD_BLOCK_MESSAGE };
    }
  }

  // Count/store by the EFFECTIVE phone (apply any saved contact correction) so
  // the snapshot matches the number shown on the page and spans the customer's
  // deals consistently.
  const ov = await getOverride(appOverrideKey(app.id));
  const effPhone = overlay(app.applicantPhone ?? '', ov?.phone);

  const customerName = `${app.applicantFirstName} ${app.applicantLastName}`.trim();
  await prisma.customerCall.create({
    data: {
      applicationId,
      customerName,
      customerPhone: normalizeCallPhone(effPhone),
      note,
      loggedById: user.userId,
      officeDealerId: forward ? app.dealerId : null,
      forwardedToOfficeAt: forward ? new Date() : null,
    },
  });

  if (forward) {
    await prisma.note.create({
      data: { applicationId, authorId: user.userId, body: `📞 Customer called GWA — ${note}`, internal: false },
    });
    await notifyNewNote(applicationId, 'REVIEWER');
  }

  await audit({
    actorId: user.userId,
    action: 'CUSTOMER_SEARCH',
    entityType: 'Application',
    entityId: applicationId,
    detail: forward ? 'logged a customer call + forwarded to office' : 'logged a customer call',
  });
  revalidatePath(`/staff/find-customer/${applicationId}`);
  return { ok: true };
}

/**
 * Forward an ALREADY-logged call to the office that owns the customer — the
 * after-the-fact version of the "also notify the office" checkbox. Reaches the
 * office by in-portal notification + email (notifyNewNote), stamps the call as
 * forwarded, and is idempotent (a second click is a no-op).
 */
export async function forwardCustomerCallAction(callId: string): Promise<CallState> {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await isGlobalSearchEnabled()) || !(await canSearchAllCustomers(user))) return { error: 'You don’t have access to do this.' };

  const call = await prisma.customerCall.findUnique({
    where: { id: callId },
    select: { id: true, note: true, applicationId: true, forwardedToOfficeAt: true, application: { select: { dealerId: true } } },
  });
  if (!call) return { error: 'Call not found.' };
  if (call.forwardedToOfficeAt) return { ok: true }; // already forwarded

  const card = findCardData(call.note);
  if (card.blocked) {
    await audit({ actorId: user.userId, action: 'CARD_DATA_BLOCKED', entityType: 'Application', entityId: call.applicationId, detail: 'Customer-call forward blocked — card data detected' });
    return { error: CARD_BLOCK_MESSAGE };
  }

  await prisma.$transaction([
    prisma.note.create({ data: { applicationId: call.applicationId, authorId: user.userId, body: `📞 Customer called GWA — ${call.note}`, internal: false } }),
    prisma.customerCall.update({ where: { id: callId }, data: { forwardedToOfficeAt: new Date(), officeDealerId: call.application.dealerId } }),
  ]);
  await notifyNewNote(call.applicationId, 'REVIEWER');
  await audit({ actorId: user.userId, action: 'CUSTOMER_SEARCH', entityType: 'Application', entityId: call.applicationId, detail: 'forwarded a logged customer call to the office' });
  revalidatePath(`/staff/find-customer/${call.applicationId}`);
  return { ok: true };
}
