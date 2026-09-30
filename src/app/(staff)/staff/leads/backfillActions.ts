'use server';

import { requireRole } from '@/lib/session';
import { isSuperAdmin, canAdminSection } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { pushLeadsToBooking, type BookingBackfillResult } from '@/lib/bookingPush';

export interface BackfillState {
  ok?: boolean;
  error?: string;
  result?: BookingBackfillResult;
}

/**
 * One-time sweep of the scanned leads that were saved before the live booking
 * feed was switched on, so the existing backlog reaches a booker's screen too —
 * from then on new scans push themselves as they're confirmed.
 *
 * Leadership only (same gate as the all-offices leads view). Safe to run again:
 * the booking side dedupes on the lead id, so nothing is ever doubled.
 */
export async function backfillScannedLeadsToBookingAction(): Promise<BackfillState> {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!isSuperAdmin(user) && !canAdminSection(user, 'leads')) {
    return { error: 'You don’t have access to do this.' };
  }

  // Only leads that can actually be booked — a name and a phone. Ordered oldest
  // first so the backlog lands in the order it came in.
  const leads = await prisma.scannedLead.findMany({
    where: { customerName: { not: null }, phone: { not: null } },
    select: {
      id: true, customerName: true, phone: true, address: true, city: true, postalCode: true,
      occupation: true, spouseName: true, spousePhone: true, bestTimeToContact: true,
      waterNotes: true, storeNumber: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const result = await pushLeadsToBooking(leads);

  if (!result.configured) {
    return { error: 'The booking feed isn’t switched on here yet (BOOKING_INTAKE_URL / PORTAL_INTAKE_TOKEN).' };
  }

  await audit({
    actorId: user.userId,
    action: 'STATUS_CHANGE',
    entityType: 'ScannedLead',
    detail: `Backfill to booking — sent:${result.sent} created:${result.created} duplicate:${result.duplicate} skipped:${result.skipped} failed:${result.failed}`,
  });

  return { ok: true, result };
}
