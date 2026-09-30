'use server';

import { requireRole } from '@/lib/session';
import { isSuperAdmin, canAdminSection } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { fillMissingPostals, type PostalFillChunk } from '@/lib/postalFill';

export interface PostalFillState {
  ok?: boolean;
  error?: string;
  result?: PostalFillChunk;
}

/**
 * Fill missing postal codes on scanned leads from their address (Google, confident
 * matches only). Leadership only. Runs one cursor-paged chunk per call — the
 * button drives it to the end — so a big backlog never blocks a single request.
 */
export async function fillMissingPostalsAction(afterId?: string | null): Promise<PostalFillState> {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!isSuperAdmin(user) && !canAdminSection(user, 'leads')) {
    return { error: 'You don’t have access to do this.' };
  }

  const result = await fillMissingPostals(afterId);

  if (!result.configured) {
    return { error: 'Address lookup isn’t set up here (GOOGLE_MAPS_API_KEY).' };
  }

  // Log only chunks that changed something, to keep the audit trail readable.
  if (result.filled || result.failed) {
    await audit({
      actorId: user.userId,
      action: 'STATUS_CHANGE',
      entityType: 'ScannedLead',
      detail: `Postal fill — filled:${result.filled} blank:${result.blank} failed:${result.failed}`,
    });
  }

  return { ok: true, result };
}
