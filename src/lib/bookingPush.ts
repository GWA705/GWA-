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

/** Where the booking feed lives and the secret to sign with — null if not set up. */
function bookingConfig(): { url: string; token: string } | null {
  const url = process.env.BOOKING_INTAKE_URL?.trim();
  const token = process.env.PORTAL_INTAKE_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

/** Shape one scanned lead the way the booking intake expects it. */
function toBookingPayload(lead: BookingLead) {
  return {
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
}

export async function pushLeadToBooking(lead: BookingLead): Promise<void> {
  const cfg = bookingConfig();
  // Not configured yet, or nothing worth booking — do nothing, quietly.
  if (!cfg) return;
  if (!lead.customerName || !lead.phone) return;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(toBookingPayload(lead)),
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

/** What one backfill run did. `configured` is false when the feed isn't set up. */
export interface BookingBackfillResult {
  configured: boolean;
  /** Leads we attempted to send (those with a name and a phone). */
  sent: number;
  /** Landed on the board for the first time. */
  created: number;
  /** Already on the board — the retry-safe no-op. */
  duplicate: number;
  /** Booking refused them (do-not-call, card data, no valid phone, …). */
  skipped: number;
  /** Batches booking couldn't be reached for — safe to run again. */
  failed: number;
}

const BATCH = 50; // the booking endpoint's per-request limit

/**
 * Sweep a set of scanned leads to the booking board in one go — for the one-time
 * backfill of the leads that were scanned before the live feed was switched on.
 *
 * Safe to run more than once: the booking side dedupes on the lead id, so leads
 * already sent come back DUPLICATE and are never doubled. Unlike the per-lead
 * push this one reports what happened, so an admin can see it worked.
 */
export async function pushLeadsToBooking(leads: BookingLead[]): Promise<BookingBackfillResult> {
  const cfg = bookingConfig();
  const result: BookingBackfillResult = { configured: !!cfg, sent: 0, created: 0, duplicate: 0, skipped: 0, failed: 0 };
  if (!cfg) return result;

  const sendable = leads.filter((l) => l.customerName && l.phone);

  for (let i = 0; i < sendable.length; i += BATCH) {
    const chunk = sendable.slice(i, i + BATCH);
    result.sent += chunk.length;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.token}` },
        body: JSON.stringify({ leads: chunk.map(toBookingPayload) }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        console.error(`[bookingPush] backfill batch returned ${res.status}`);
        result.failed += chunk.length;
        continue;
      }
      const json = (await res.json()) as { results?: { outcome?: string }[] };
      for (const r of json.results ?? []) {
        if (r.outcome === 'CREATED') result.created += 1;
        else if (r.outcome === 'DUPLICATE') result.duplicate += 1;
        else result.skipped += 1; // REJECTED / DNC
      }
    } catch (e) {
      console.error('[bookingPush] backfill could not reach the booking system', e);
      result.failed += chunk.length;
    }
  }

  return result;
}
