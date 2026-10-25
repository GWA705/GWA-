'use server';

import { revalidatePath } from 'next/cache';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { createIdTagRequest, markIdTagEmailed } from '@/lib/idTag';
import { sendIdTagNewRepEmail, sendIdTagExistingRepEmail, sendIdTagTrainingInviteEmail, sendIdTagInboxNotice } from '@/lib/idTag-email';
import { getIdTagInboxEmail } from '@/lib/settings';
import { putDocument } from '@/lib/storage';
import { emailEnabled } from '@/lib/email';
import type { IdTagKind } from '@prisma/client';

function appBase(): string {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}

export interface IdTagSubmitState {
  error?: string;
  ok?: boolean;
  message?: string;
  needsTraining?: boolean;
  /** The created request id + email, so the form can offer "Send training email". */
  id?: string;
  personEmail?: string;
}

/** Submit one person for a Home Depot ID tag. Collects first/last, cell, email
 *  and an optional headshot; matches their training certificate; logs the
 *  request; and fires the right email. Training is a nudge — a missing
 *  certificate (or headshot) never blocks the add, but the headshot is needed
 *  before the card can be finished. */
export async function submitIdTagAction(_prev: IdTagSubmitState, formData: FormData): Promise<IdTagSubmitState> {
  const session = await requireDealerAccess();
  if (!session.dealerId) return { error: 'No office is linked to your account.' };

  const first = String(formData.get('personFirst') || '').trim();
  const last = String(formData.get('personLast') || '').trim();
  const name = `${first} ${last}`.trim();
  const email = String(formData.get('personEmail') || '').trim();
  const phone = String(formData.get('personPhone') || '').trim();
  const kind: IdTagKind = String(formData.get('kind') || 'NEW') === 'EXISTING' ? 'EXISTING' : 'NEW';

  if (first.length < 1 || last.length < 1) return { error: 'Please enter the person’s first and last name.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Please enter a valid email address (or leave it blank).' };

  // Optional headshot → S3. Best-effort: a storage hiccup must not fail the add.
  let headshotKey: string | null = null;
  const file = formData.get('headshot');
  if (file && typeof file === 'object' && 'arrayBuffer' in file && (file as File).size > 0) {
    const f = file as File;
    if (f.size > 8 * 1024 * 1024) return { error: 'Headshot is too large — please keep it under 8 MB.' };
    try {
      const buf = Buffer.from(await f.arrayBuffer());
      const ext = (f.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || '.jpg').toLowerCase();
      headshotKey = `idtags/${session.dealerId}/${Date.now()}-headshot${ext}`;
      await putDocument(headshotKey, buf);
    } catch (e) {
      console.error('[idTag] headshot upload failed; continuing without it', e);
      headshotKey = null;
    }
  }

  const res = await createIdTagRequest({
    dealerId: session.dealerId,
    submittedById: session.userId,
    personName: name,
    personFirst: first,
    personLast: last,
    personEmail: email || null,
    personPhone: phone || null,
    headshotKey,
    kind,
  });

  const dealer = await prisma.dealer.findUnique({ where: { id: session.dealerId }, select: { name: true, idTagTempPassword: true } });
  const office = dealer?.name || 'your office';

  // Fire the appropriate rep email (best-effort — never fails the submission).
  if (email) {
    if (res.sendScreeningEmail) {
      const sent = await sendIdTagNewRepEmail(email, name, { password: dealer?.idTagTempPassword });
      if (sent) await markIdTagEmailed(res.id);
    } else if (res.sendWelcomeEmail) {
      const sent = await sendIdTagExistingRepEmail(email, name, office);
      if (sent) await markIdTagEmailed(res.id);
    }
  }

  // Copy the dedicated ID-tag inbox so the team sees every new request.
  try {
    await sendIdTagInboxNotice(await getIdTagInboxEmail(), { personName: name, office, kind, certified: res.certified, hasHeadshot: !!headshotKey });
  } catch { /* best-effort */ }

  revalidatePath('/dealer/id-tags');

  const noHeadshot = !headshotKey;
  const delayNote = noHeadshot ? ' Heads up — no headshot yet, so their card will be delayed until one is added.' : '';
  if (kind === 'NEW' && !res.certified) {
    return {
      ok: true,
      needsTraining: true,
      id: res.id,
      personEmail: email || undefined,
      message: `${name} isn’t certified yet — send them the Home Depot training below.${delayNote}`,
    };
  }
  return {
    ok: true,
    id: res.id,
    personEmail: email || undefined,
    message: (kind === 'EXISTING'
      ? `${name} added to your roster${email ? ' and emailed a welcome' : ''}.`
      : `${name} submitted${email ? ' — the background-check email is on its way' : ''}.`) + delayNote,
  };
}

export interface TrainingInviteState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/** Email one person the office's Home Depot in-store training link, straight
 *  from the dealer's ID-tags list. */
export async function sendTrainingInviteAction(_prev: TrainingInviteState, formData: FormData): Promise<TrainingInviteState> {
  const session = await requireDealerAccess();
  if (!session.dealerId) return { error: 'No office is linked to your account.' };
  const id = String(formData.get('id') || '').trim();
  if (!id) return { error: 'Missing person.' };

  const tag = await prisma.homeDepotIdTag.findFirst({
    where: { id, dealerId: session.dealerId },
    select: { personName: true, personEmail: true },
  });
  if (!tag) return { error: 'That person wasn’t found.' };
  if (!tag.personEmail) return { error: 'No email on file for this person — add one first.' };

  const dealer = await prisma.dealer.findUnique({ where: { id: session.dealerId }, select: { name: true, trainingToken: true } });
  if (!dealer?.trainingToken) return { error: 'Your office has no training link yet — create one on your Training page.' };
  if (!emailEnabled()) return { error: 'Email is off here (log-only) — nothing was sent.' };

  const link = `${appBase()}/training/${dealer.trainingToken}`;
  const sent = await sendIdTagTrainingInviteEmail(tag.personEmail, tag.personName, link, dealer.name || 'your office');
  revalidatePath('/dealer/id-tags');
  return sent
    ? { ok: true, message: `Training email sent to ${tag.personEmail}.` }
    : { error: 'Could not send the email — please try again.' };
}
