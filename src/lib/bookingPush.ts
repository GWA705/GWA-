import 'server-only';

/**
 * Push a confirmed scanned lead to the booking system so it lands on a booker's
 * calling screen (portal.ghsbarrie.ca → the booking app's /api/intake/portal).
 *
 * Fire-and-forget and completely fail-safe: a booking outage, a missing config,
 * or a slow response must never stop a lead being saved in the portal. It is
 * also inert until configured — with no BOOKING_INTAKE_URL / PORTAL_INTAKE_TOKEN
 * it simply does nothing, so nothing breaks before go-live.
 *
 * Env:
 *   BOOKING_INTAKE_URL   e.g. https://gwa-booking-staging.fly.dev/api/intake/portal
 *   PORTAL_INTAKE_TOKEN  the shared secret, matching the booking app's value
 */

export interface BookingLead {
  /** The scanned lead's id — the booking side dedupes on this, so a re-save
   * never creates the customer twice. */
  id: string;
  customerName: string | null;
  phone: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  occupation?: string | null;
  spouseName?: string | null;
  spousePhone?: string | null;
  bestTimeToContact?: string | null;
  waterNotes?: string | null;
  storeNumber?: string | null;
}

export async function pushLeadToBooking(lead: BookingLead): Promise<void> {
  const url = process.env.BOOKING_INTAKE_URL?.trim();
  const token = process.env.PORTAL_INTAKE_TOKEN?.trim();
  // Not configured yet, or nothing worth booking — do nothing, quietly.
  if (!url || !token) return;
  if (!lead.customerName || !lead.phone) return;

  const body = {
    applicationId: lead.id,
    name: lead.customerName,
    phone: lead.phone,
    address: lead.address ?? null,
    city: lead.city ?? null,
    postalCode: lead.postalCode ?? null,
    occupation: lead.occupation ?? null,
    spouseName: lead.spouseName ?? null,
    spousePhone: lead.spousePhone ?? null,
    bestTimeToContact: lead.bestTimeToContact ?? null,
    notes: lead.waterNotes ?? null,
    storeNumber: lead.storeNumber ?? null,
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.error(`[bookingPush] booking intake returned ${res.status} for scanned lead ${lead.id}`);
    }
  } catch (e) {
    // Never surface to the caller — the lead is already saved in the portal.
    console.error('[bookingPush] could not reach the booking system', e);
  }
}
