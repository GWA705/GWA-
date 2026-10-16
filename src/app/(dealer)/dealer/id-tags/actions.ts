'use server';

import { revalidatePath } from 'next/cache';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { createIdTagRequest, markIdTagEmailed } from '@/lib/idTag';
import { sendIdTagNewRepEmail, sendIdTagExistingRepEmail } from '@/lib/idTag-email';
import type { IdTagKind } from '@prisma/client';

export interface IdTagSubmitState {
  error?: string;
  ok?: boolean;
  message?: string;
  needsTraining?: boolean;
}

/** Submit one person for a Home Depot ID tag. Matches their training certificate,
 *  logs the request, and fires the right email (new → background check; existing
 *  → welcome). Training is a nudge: a missing certificate never blocks the add. */
export async function submitIdTagAction(_prev: IdTagSubmitState, formData: FormData): Promise<IdTagSubmitState> {
  const session = await requireDealerAccess();
  if (!session.dealerId) return { error: 'No office is linked to your account.' };

  const name = String(formData.get('personName') || '').trim();
  const email = String(formData.get('personEmail') || '').trim();
  const phone = String(formData.get('personPhone') || '').trim();
  const kind: IdTagKind = String(formData.get('kind') || 'NEW') === 'EXISTING' ? 'EXISTING' : 'NEW';

  if (name.length < 2) return { error: 'Please enter the person’s full name.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Please enter a valid email address (or leave it blank).' };

  const res = await createIdTagRequest({
    dealerId: session.dealerId,
    submittedById: session.userId,
    personName: name,
    personEmail: email || null,
    personPhone: phone || null,
    kind,
  });

  // Fire the appropriate email (best-effort — never fails the submission).
  if (email) {
    const dealer = await prisma.dealer.findUnique({ where: { id: session.dealerId }, select: { name: true } });
    const office = dealer?.name || 'your office';
    if (res.sendScreeningEmail) {
      const sent = await sendIdTagNewRepEmail(email, name);
      if (sent) await markIdTagEmailed(res.id);
    } else if (res.sendWelcomeEmail) {
      const sent = await sendIdTagExistingRepEmail(email, name, office);
      if (sent) await markIdTagEmailed(res.id);
    }
  }

  revalidatePath('/dealer/id-tags');

  if (kind === 'NEW' && !res.certified) {
    return {
      ok: true,
      needsTraining: true,
      message: `${name} isn’t certified yet. Send them your training link below — once they finish, they move into the ID-tag queue automatically.`,
    };
  }
  return {
    ok: true,
    message: kind === 'EXISTING'
      ? `${name} added to your roster${email ? ' and emailed a welcome' : ''}.`
      : `${name} submitted${email ? ' — the background-check email is on its way' : ''}.`,
  };
}
