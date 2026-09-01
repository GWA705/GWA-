'use server';

import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import { rateLimit } from '@/lib/ratelimit';
import { onboardSchema } from '@/lib/validation';
import { ONBOARD_CODE_KEY } from '@/lib/onboard';
import type { Prisma } from '@prisma/client';

export interface OnboardState {
  error?: string;
  ok?: boolean;
}

/**
 * Public new-dealer intake submit. No session — protected by the shared access
 * code an admin sets, plus a per-IP rate limit. Creates an OnboardRequest that
 * GWA reviews in Admin → User requests. Nothing is granted automatically.
 */
export async function submitOnboardRequestAction(_prev: OnboardState, formData: FormData): Promise<OnboardState> {
  const h = headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const rl = await rateLimit(`onboard:${ip}`, 5, 3600);
  if (!rl.ok) return { error: 'Too many submissions from here. Please try again later.' };

  const configured = ((await getSetting(ONBOARD_CODE_KEY)) || '').trim();
  if (!configured) {
    return { error: 'This form isn’t accepting submissions right now. Please contact Georgian Water & Air.' };
  }
  const code = String(formData.get('accessCode') || '').trim();
  if (!code || code.toLowerCase() !== configured.toLowerCase()) {
    return { error: 'That access code isn’t right — check the code in your invitation.' };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get('payload') || '{}'));
  } catch {
    return { error: 'Something went wrong — please try again.' };
  }
  const parsed = onboardSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const d = parsed.data;

  await prisma.onboardRequest.create({
    data: {
      company: d.company,
      contactName: d.contactName,
      email: d.email,
      phone: d.phone || null,
      city: d.city || null,
      note: d.note || null,
      people: d.people as unknown as Prisma.InputJsonValue,
    },
  });

  return { ok: true };
}
