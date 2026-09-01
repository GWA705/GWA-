'use server';

import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import { rateLimit } from '@/lib/ratelimit';
import { onboardSchema } from '@/lib/validation';
import { ONBOARD_CODE_KEY } from '@/lib/onboard';
import { putDocument } from '@/lib/storage';
import crypto from 'crypto';
import path from 'path';
import type { Prisma } from '@prisma/client';

const LOGO_MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

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

  const created = await prisma.onboardRequest.create({
    data: {
      company: d.company,
      legalName: d.legalName || null,
      contactName: d.contactName,
      email: d.email,
      phone: d.phone || null,
      officePhone: d.officePhone || null,
      officeEmail: d.officeEmail || null,
      address: d.address || null,
      city: d.city || null,
      province: d.province || null,
      postal: d.postal || null,
      mailingAddress: d.mailingAddress || null,
      note: d.note || null,
      people: d.people as unknown as Prisma.InputJsonValue,
    },
  });

  // Optional company logo (image only, size-capped). A bad file just isn't saved
  // — it never blocks the request.
  const logo = formData.get('logo') as File | null;
  if (logo && typeof logo !== 'string' && logo.size > 0 && logo.size <= LOGO_MAX_BYTES && LOGO_TYPES.includes(logo.type)) {
    try {
      const ext = path.extname(logo.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '') || '.img';
      const key = `onboard/${created.id}/logo-${crypto.randomBytes(6).toString('hex')}${ext}`;
      await putDocument(key, Buffer.from(await logo.arrayBuffer()));
      await prisma.onboardRequest.update({ where: { id: created.id }, data: { logoStorageKey: key, logoMime: logo.type } });
    } catch {
      /* logo is optional — ignore a storage hiccup */
    }
  }

  return { ok: true };
}
