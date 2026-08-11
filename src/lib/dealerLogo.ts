import 'server-only';
import crypto from 'crypto';
import path from 'path';
import { prisma } from '@/lib/db';
import { putDocument, deleteDocument } from '@/lib/storage';
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from '@/lib/constants';

/**
 * Apply a logo change from a submitted profile form. Call AFTER the profile row
 * is upserted. Stores a newly uploaded image (replacing any previous one) or
 * clears it when "remove logo" is ticked. Returns an error string to surface, or
 * {} on success / no-op.
 */
export async function applyDealerLogo(dealerId: string, form: FormData): Promise<{ error?: string }> {
  const remove = form.get('removeLogo') === 'on';
  const file = form.get('logo');
  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile && !remove) return {};

  const existing = await prisma.dealerProfile.findUnique({
    where: { dealerId },
    select: { logoStorageKey: true },
  });

  if (hasFile) {
    const f = file as File;
    if (f.size > MAX_FILE_BYTES) return { error: 'Logo is too large (max 15 MB).' };
    if (!f.type.startsWith('image/') || !ALLOWED_MIME_TYPES.includes(f.type)) {
      return { error: 'Logo must be an image (JPG, PNG, or WEBP).' };
    }
    const ext = path.extname(f.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '') || '.img';
    const key = `dealer-logos/${dealerId}/${crypto.randomBytes(8).toString('hex')}${ext}`;
    try {
      await putDocument(key, Buffer.from(await f.arrayBuffer()));
    } catch {
      return { error: 'The logo could not be saved. Please try again.' };
    }
    await prisma.dealerProfile.update({ where: { dealerId }, data: { logoStorageKey: key, logoMime: f.type } });
    if (existing?.logoStorageKey) await deleteDocument(existing.logoStorageKey).catch(() => {});
    return {};
  }

  // remove
  if (existing?.logoStorageKey) {
    await deleteDocument(existing.logoStorageKey).catch(() => {});
    await prisma.dealerProfile.update({ where: { dealerId }, data: { logoStorageKey: null, logoMime: null } });
  }
  return {};
}
