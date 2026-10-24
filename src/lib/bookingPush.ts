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

/** Booking's status-sync URL, derived from the lead-intake URL so there's no
 * second env var to set: .../api/intake/portal -> .../api/intake/portal-status. */
function bookingStatusUrl(): string | null {
  const base = process.env.BOOKING_INTAKE_URL?.trim();
  if (!base) return null;
  return base.replace(/\/api\/intake\/portal\/?$/, '/api/intake/portal-status');
}

/** Booking's sold-customer URL, derived the same way:
 * .../api/intake/portal -> .../api/intake/portal/sold. */
function bookingSoldUrl(): string | null {
  const base = process.env.BOOKING_INTAKE_URL?.trim();
  if (!base) return null;
  return base.replace(/\/api\/intake\/portal\/?$/, '/api/intake/portal/sold');
}

/** The shared coarse status vocabulary the two systems agree on. */
export type CoarseStatus = 'new' | 'working' | 'spoke' | 'booked' | 'sold' | 'nogood';

/** A scanned lead's own status (NEW | CONTACTED | NO_GOOD) as a coarse status. */
export function coarseFromScannedStatus(status: string): CoarseStatus {
  if (status === 'NO_GOOD') return 'nogood';
  if (status === 'CONTACTED') return 'working';
  return 'new';
}

/** A logged call outcome as a coarse status (null = a plain note, nothing to sync). */
export function coarseFromCallOutcome(outcome: string): CoarseStatus | null {
  switch (outcome) {
    case 'SOLD': return 'sold';
    case 'BOOKED': return 'booked';
    case 'SPOKE': return 'spoke';
    case 'NOT_INTERESTED': return 'nogood';
    case 'LEFT_MESSAGE':
    case 'NO_ANSWER': return 'working';
    default: return null; // NOTE and anything unknown
  }
}

/**
 * Tell booking the portal-side status of a scanned lead, so a lead the office
 * marks NO GOOD (or works up to booked/sold) reflects on the booker's screen.
 * Fire-and-forget and inert until configured. Booking applies it with guardrails
 * so it can never downgrade a booker's own progress.
 */
export async function pushScannedStatusToBooking(
  applicationId: string,
  status: CoarseStatus,
  bookingRef?: string | null,
): Promise<void> {
  const url = bookingStatusUrl();
  const token = process.env.PORTAL_INTAKE_TOKEN?.trim();
  const ref = (bookingRef ?? '').trim();
  // Need something to match on: a portal application id, or the Home Depot
  // booking id (which reaches a lead that came into booking via the HD feed).
  if (!url || !token || (!applicationId && !ref)) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ applicationId, status, ...(ref ? { bookingRef: ref } : {}) }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) console.error(`[bookingPush] status sync returned ${res.status} for ${applicationId || ref}`);
  } catch (e) {
    console.error('[bookingPush] could not push status to booking', e);
  }
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

// ---------------------------------------------------------------------------
// Sold customers → the booking system's CUSTOMER list (not the call board)
// ---------------------------------------------------------------------------

/** One equipment line on a sold deal, as the booking catalogue matches it. */
export interface BookingProduct {
  /** The portal's journal code (booking's Product.sku) — the stable match key. */
  sku?: string | null;
  /** Friendly name — the fallback match key, and the name on create. */
  name?: string | null;
}

/**
 * A funded portal deal, shaped for the booking system's sold-customer feed. It
 * lands as a CUSTOMER (the post-sale household record), never a call-board lead.
 * `cancelled: true` reverses a sale we previously sent (the deal was withdrawn).
 */
export interface BookingSoldCustomer {
  /** The portal application id — booking's stable key for this sale. */
  applicationId: string;
  cancelled?: boolean;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  spouseName?: string | null;
  spousePhone?: string | null;
  /** ISO date the deal funded; booking defaults to "now" if absent. */
  soldAt?: string | null;
  products?: BookingProduct[];
}

/**
 * Send one sold customer to booking. Fire-and-forget and fully fail-safe (a
 * booking outage never affects the portal), and inert until BOOKING_INTAKE_URL +
 * PORTAL_INTAKE_TOKEN are set. A sold push needs a name and a phone; a cancel
 * (reverse) needs only the applicationId.
 */
export async function pushSoldCustomerToBooking(sale: BookingSoldCustomer): Promise<void> {
  const url = bookingSoldUrl();
  const token = process.env.PORTAL_INTAKE_TOKEN?.trim();
  if (!url || !token || !sale.applicationId) return;
  if (!sale.cancelled && (!sale.name || !sale.phone)) return; // nothing worth a customer record

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(sale),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) console.error(`[bookingPush] sold feed returned ${res.status} for ${sale.applicationId}`);
  } catch (e) {
    console.error('[bookingPush] could not push sold customer to booking', e);
  }
}

/** Reverse a previously-sent sold customer in booking (the portal deal was
 *  cancelled). Fire-and-forget, inert until configured. */
export async function pushCancelledSaleToBooking(applicationId: string): Promise<void> {
  if (!applicationId) return;
  await pushSoldCustomerToBooking({ applicationId, cancelled: true });
}

/**
 * Sweep a set of sold customers to booking in one go — for the one-time backfill
 * of deals that funded before the sold feed was switched on. Safe to re-run:
 * booking dedupes a customer by phone and stamps each sale's equipment with the
 * portal deal id, so a resend never doubles anyone. Reports what happened.
 */
export async function pushSoldCustomersToBooking(sales: BookingSoldCustomer[]): Promise<BookingBackfillResult> {
  const url = bookingSoldUrl();
  const token = process.env.PORTAL_INTAKE_TOKEN?.trim();
  const configured = Boolean(url && token);
  const result: BookingBackfillResult = { configured, sent: 0, created: 0, duplicate: 0, skipped: 0, failed: 0 };
  if (!configured || !url || !token) return result;

  const sendable = sales.filter((s) => s.applicationId && (s.cancelled || (s.name && s.phone)));
  const SOLD_BATCH = 100; // the booking sold endpoint's per-request limit

  for (let i = 0; i < sendable.length; i += SOLD_BATCH) {
    const chunk = sendable.slice(i, i + SOLD_BATCH);
    result.sent += chunk.length;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ sales: chunk }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        console.error(`[bookingPush] sold backfill batch returned ${res.status}`);
        result.failed += chunk.length;
        continue;
      }
      const json = (await res.json()) as { results?: { outcome?: string }[] };
      for (const r of json.results ?? []) {
        if (r.outcome === 'CREATED') result.created += 1;
        else if (r.outcome === 'MERGED' || r.outcome === 'CANCELLED') result.duplicate += 1;
        else result.skipped += 1; // REJECTED / SKIPPED
      }
    } catch (e) {
      console.error('[bookingPush] sold backfill could not reach the booking system', e);
      result.failed += chunk.length;
    }
  }

  return result;
}
