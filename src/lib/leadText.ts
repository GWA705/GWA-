import 'server-only';
import { prisma } from './db';
import { getSettings } from './settings';
import { toE164, sendSms } from './sms';
import { bookingUrlFor } from './leadBooking';

/**
 * Customer "we received your request" auto-text.
 *
 * When a new lead lands (an in-store scanned card, a mailed-in card, or an online
 * HD Leads Log row), we text the customer once to say their in-home water
 * assessment request was received and a team member will call within 24-48 hrs to
 * schedule. Message identifies as "Home Depot Home Services (serviced by Georgian
 * Water & Air)" and carries a STOP opt-out (CASL).
 *
 * Everything is OFF until `leadText.enabled` is set, and defaults to TEST MODE
 * (texts only the configured test number) so it can't blast real customers by
 * accident. Sends go out only within the customer's local daytime window
 * (default 8am-9pm, by province), MMS with a branded image falling back to SMS.
 *
 * Config lives in AppSetting (see LEAD_TEXT_KEYS); the sweep is driven by the
 * cron endpoint /api/cron/lead-text-sweep.
 */

export const LEAD_TEXT_KEYS = {
  enabled: 'leadText.enabled',
  testMode: 'leadText.testMode',
  testNumber: 'leadText.testNumber',
  mediaUrl: 'leadText.mediaUrl',
  senderMap: 'leadText.senderMap',
  quietStart: 'leadText.quietStart',
  quietEnd: 'leadText.quietEnd',
  // Follow-up sequence (scanned/mail-in leads only).
  followups: 'leadText.followups',
  day1Hours: 'leadText.day1Hours',
  missHours: 'leadText.missHours',
  // Include a self-booking link in the follow-up texts (Phase 2).
  bookingLink: 'leadText.bookingLink',
} as const;

export type LeadTextSource = 'HD_SHEET' | 'SCANNED' | 'MAILIN';
// Which message in the sequence this row is.
export type LeadTextKind = 'CONFIRM' | 'DAY1' | 'MISSED_WINDOW';

export interface LeadTextConfig {
  enabled: boolean;
  testMode: boolean;
  testNumber: string | null;
  mediaUrl: string | null;
  senderMap: Record<string, string>;
  quietStart: number; // local hour, inclusive
  quietEnd: number; // local hour, exclusive
  followups: boolean; // schedule the DAY1 + MISSED_WINDOW follow-ups
  day1Hours: number; // hours after the confirm to send the day-1 reminder
  missHours: number; // hours after the confirm to send the missed-window text
  bookingLink: boolean; // append a self-booking link to the follow-up texts
}

export async function leadTextConfig(): Promise<LeadTextConfig> {
  const s = await getSettings(Object.values(LEAD_TEXT_KEYS));
  let senderMap: Record<string, string> = {};
  try {
    const raw = s[LEAD_TEXT_KEYS.senderMap];
    if (raw) senderMap = JSON.parse(raw) as Record<string, string>;
  } catch {
    senderMap = {};
  }
  const qs = Number(s[LEAD_TEXT_KEYS.quietStart]);
  const qe = Number(s[LEAD_TEXT_KEYS.quietEnd]);
  const d1 = Number(s[LEAD_TEXT_KEYS.day1Hours]);
  const mw = Number(s[LEAD_TEXT_KEYS.missHours]);
  return {
    enabled: s[LEAD_TEXT_KEYS.enabled] === 'true',
    // Default to test mode unless explicitly turned off — safest default.
    testMode: s[LEAD_TEXT_KEYS.testMode] !== 'false',
    testNumber: s[LEAD_TEXT_KEYS.testNumber] || null,
    mediaUrl: s[LEAD_TEXT_KEYS.mediaUrl] || null,
    senderMap,
    quietStart: Number.isFinite(qs) ? qs : 8,
    quietEnd: Number.isFinite(qe) ? qe : 21,
    // Follow-ups on by default once the feature itself is enabled.
    followups: s[LEAD_TEXT_KEYS.followups] !== 'false',
    day1Hours: Number.isFinite(d1) && d1 > 0 ? d1 : 24,
    missHours: Number.isFinite(mw) && mw > 0 ? mw : 48,
    // Self-booking link is opt-in (off until the booking page is ready to share).
    bookingLink: s[LEAD_TEXT_KEYS.bookingLink] === 'true',
  };
}

// Province (2-letter) → IANA timezone, so the daytime window is the customer's
// local time, not the server's.
const PROVINCE_TZ: Record<string, string> = {
  BC: 'America/Vancouver',
  AB: 'America/Edmonton',
  SK: 'America/Regina',
  MB: 'America/Winnipeg',
  ON: 'America/Toronto',
  QC: 'America/Toronto',
  NB: 'America/Moncton',
  NS: 'America/Halifax',
  PE: 'America/Halifax',
  NL: 'America/St_Johns',
  YT: 'America/Whitehorse',
  NT: 'America/Yellowknife',
  NU: 'America/Iqaluit',
};
const DEFAULT_TZ = 'America/Toronto';

export function provinceTimezone(province?: string | null): string {
  return (province && PROVINCE_TZ[province.toUpperCase()]) || DEFAULT_TZ;
}

export function localHour(now: Date, tz: string): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(now);
  // "24" at midnight on some platforms → mod 24.
  return parseInt(h, 10) % 24;
}

export function inDaytimeWindow(now: Date, province: string | null | undefined, startH: number, endH: number): boolean {
  const h = localHour(now, provinceTimezone(province));
  return h >= startH && h < endH;
}

// Best-effort province from a Canadian postal code's first letter (scanned cards
// capture a postal code, not a province). Used for timezone + language + sender.
const POSTAL_PROVINCE: Record<string, string> = {
  A: 'NL', B: 'NS', C: 'PE', E: 'NB', G: 'QC', H: 'QC', J: 'QC',
  K: 'ON', L: 'ON', M: 'ON', N: 'ON', P: 'ON', R: 'MB', S: 'SK', T: 'AB', V: 'BC', Y: 'YT',
  // X = NT/NU — can't disambiguate from the first letter; leave unmapped.
};
export function provinceFromPostalCode(postal?: string | null): string | null {
  const c = (postal || '').trim().charAt(0).toUpperCase();
  return POSTAL_PROVINCE[c] ?? null;
}

// Quebec → French; everywhere else → English. (CASL/Bill 96 friendly.)
export function leadTextLang(province?: string | null): 'en' | 'fr' {
  return (province || '').toUpperCase() === 'QC' ? 'fr' : 'en';
}

/**
 * The customer message. Kept GSM-7-friendly (straight quotes, hyphens, no
 * guillemets/em-dashes) so the SMS fallback stays to as few segments as possible.
 * Source changes only the "how we received it" phrase.
 */
export function renderLeadTextBody(
  source: LeadTextSource,
  province?: string | null,
  kind: LeadTextKind = 'CONFIRM',
  opts?: { bookingUrl?: string | null },
): string {
  const fr = leadTextLang(province) === 'fr';
  // Self-booking line, inserted before the STOP opt-out when a link is provided.
  const book = opts?.bookingUrl
    ? fr
      ? ` Ou reservez une heure vous-meme: ${opts.bookingUrl}.`
      : ` Or pick a time yourself: ${opts.bookingUrl}.`
    : '';
  const stop = fr ? ' Repondez STOP pour vous desabonner.' : ' Reply STOP to opt out.';

  if (kind === 'DAY1') {
    // ~24h reminder, sent only if the lead hasn't been contacted/booked yet.
    const base = fr
      ? `Home Depot Home Services (service assure par Georgian Water & Air): petit rappel au sujet de votre evaluation ` +
          `de l'eau a domicile. Un membre de l'equipe vous appellera bientot - ou repondez avec un jour et une heure qui ` +
          `vous conviennent et nous appellerons a ce moment.`
      : `Home Depot Home Services (serviced by Georgian Water & Air): a quick reminder about your in-home water assessment. ` +
          `A team member will call you soon to schedule - or reply with a day and time that works and we'll call then.`;
    return base + book + stop;
  }

  if (kind === 'MISSED_WINDOW') {
    // ~48h: we missed the 24-48h promise. Acknowledge and re-set a keepable window.
    const base = fr
      ? `Home Depot Home Services (service assure par Georgian Water & Air): nous sommes desoles de ne pas vous avoir ` +
          `encore joint au sujet de votre evaluation de l'eau a domicile gratuite. Nous vous rappellerons d'ici 36 heures. ` +
          `Si un jour ou une heure vous convient mieux, repondez simplement.`
      : `Home Depot Home Services (serviced by Georgian Water & Air): we're sorry we haven't reached you yet about your ` +
          `free in-home water assessment. We'll call you again within 36 hours. If a specific day or time is easier, just ` +
          `reply and we'll work around you.`;
    return base + book + stop;
  }

  // CONFIRM — on landing.
  if (fr) {
    const via =
      source === 'MAILIN'
        ? 'votre demande envoyee par la poste'
        : source === 'SCANNED'
          ? 'votre demande faite en magasin Home Depot'
          : 'votre demande Home Depot';
    return (
      `Home Depot Home Services (service assure par Georgian Water & Air): Nous avons recu ${via} ` +
      `pour une evaluation de l'eau a domicile. Un membre de l'equipe vous appellera d'ici 24-48 h pour planifier. ` +
      `Notre appel s'affichera "HD Home Services". Des frais peuvent s'appliquer. Repondez STOP pour vous desabonner.`
    );
  }
  const via =
    source === 'MAILIN'
      ? 'your mail-in request'
      : source === 'SCANNED'
        ? 'the request you made at your Home Depot store'
        : 'your Home Depot water assessment request';
  return (
    `Home Depot Home Services (serviced by Georgian Water & Air): We received ${via} for an in-home water assessment. ` +
    `A team member will call you within 24-48 hrs to schedule. Our call will show as "HD Home Services". ` +
    `Msg & data rates may apply. Reply STOP to opt out.`
  );
}

// province → sending number; falls back to the "default" entry, else undefined
// (sms.ts then uses TWILIO_FROM_NUMBER).
export function pickSender(province: string | null | undefined, map: Record<string, string>): string | undefined {
  const p = (province || '').toUpperCase();
  return (p && map[p]) || map.default || undefined;
}

/**
 * Queue a customer text for a new lead. Deduped by leadKey (one text per lead).
 * No-ops quietly when the feature is off, the number is unusable, or the customer
 * has opted out — a texting hiccup must never block saving the lead, so callers
 * also wrap this in try/catch.
 */
export async function enqueueLeadText(input: {
  leadKey: string;
  source: LeadTextSource;
  phone: string | null | undefined;
  customerName?: string | null;
  province?: string | null;
  dealerId?: string | null;
}): Promise<{ queued: boolean; reason?: string }> {
  const cfg = await leadTextConfig();
  if (!cfg.enabled) return { queued: false, reason: 'disabled' };

  const phone = toE164(input.phone);
  if (!phone) return { queued: false, reason: 'bad-number' };

  const opted = await prisma.smsOptOut.findUnique({ where: { phone } });
  if (opted) return { queued: false, reason: 'opted-out' };

  const province = (input.province || '').toUpperCase() || null;
  const customerName = input.customerName?.trim() || null;

  try {
    await prisma.leadTextOutbox.create({
      data: {
        leadKey: input.leadKey,
        source: input.source,
        kind: 'CONFIRM',
        dealerId: input.dealerId ?? null,
        province,
        phone,
        customerName,
        scheduledFor: new Date(),
        status: 'PENDING',
      },
    });
  } catch {
    // Unique leadKey violation → already queued. That's the dedupe working.
    return { queued: false, reason: 'duplicate' };
  }

  // Schedule the follow-up sequence. Only for leads the portal tracks a status
  // on (scanned + mail-in) so the sweep can cancel them once the lead is worked;
  // HD-sheet online leads get the confirmation only. Best-effort — a failure here
  // must never undo the confirmation that already queued.
  if (cfg.followups && (input.source === 'SCANNED' || input.source === 'MAILIN')) {
    const now = Date.now();
    const followups: { suffix: string; kind: LeadTextKind; hours: number }[] = [
      { suffix: '#d1', kind: 'DAY1', hours: cfg.day1Hours },
      { suffix: '#mw', kind: 'MISSED_WINDOW', hours: cfg.missHours },
    ];
    for (const f of followups) {
      try {
        await prisma.leadTextOutbox.create({
          data: {
            leadKey: `${input.leadKey}${f.suffix}`,
            source: input.source,
            kind: f.kind,
            dealerId: input.dealerId ?? null,
            province,
            phone,
            customerName,
            scheduledFor: new Date(now + f.hours * 60 * 60 * 1000),
            status: 'PENDING',
          },
        });
      } catch {
        // Already scheduled (dedupe) — fine.
      }
    }
  }

  return { queued: true };
}

/**
 * Cancel the pending follow-up texts for a lead once it's been worked (contacted,
 * booked, or marked no-good). The confirmation (if still pending) is left alone —
 * the customer should still get their "we received it" acknowledgement. Keyed by
 * the lead's base key (e.g. "s:<id>"); cancels its "#d1"/"#mw" rows.
 */
export async function cancelLeadFollowups(baseLeadKey: string): Promise<void> {
  try {
    await prisma.leadTextOutbox.updateMany({
      where: { leadKey: { in: [`${baseLeadKey}#d1`, `${baseLeadKey}#mw`] }, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  } catch (e) {
    console.error('[leadText] cancelLeadFollowups failed', e);
  }
}

export interface SweepCounts {
  sent: number;
  failed: number;
  skipped: number;
  held: number; // outside the local daytime window — left for a later sweep
}

/**
 * Send the due, in-window queued texts. Called by the cron endpoint. MMS (with
 * the configured branded image) is tried first; on failure it retries as plain
 * SMS. In test mode every message goes to the configured test number instead of
 * the customer.
 */
export async function processDueLeadTexts(limit = 200): Promise<SweepCounts> {
  const cfg = await leadTextConfig();
  const counts: SweepCounts = { sent: 0, failed: 0, skipped: 0, held: 0 };
  if (!cfg.enabled) return counts;

  const now = new Date();
  const due = await prisma.leadTextOutbox.findMany({
    where: { status: 'PENDING', scheduledFor: { lte: now } },
    orderBy: { scheduledFor: 'asc' },
    take: limit * 4, // over-fetch; many may be outside their local daytime window
  });

  for (const row of due) {
    if (counts.sent + counts.failed >= limit) break;

    if (!inDaytimeWindow(now, row.province, cfg.quietStart, cfg.quietEnd)) {
      counts.held += 1;
      continue; // leave PENDING; a later sweep in-window picks it up
    }

    const opted = await prisma.smsOptOut.findUnique({ where: { phone: row.phone } });
    if (opted) {
      await prisma.leadTextOutbox.update({ where: { leadKey: row.leadKey }, data: { status: 'OPTED_OUT' } });
      counts.skipped += 1;
      continue;
    }

    // Follow-up guard: never send a DAY1/MISSED_WINDOW text if the lead has since
    // been worked (contacted, booked, or marked no-good) or deleted — cancel it.
    // This backstops the cancellation hooks so a missed hook can't text a customer
    // a booker already reached. Also grab the self-booking link for the message.
    let bookingUrl: string | null = null;
    if (row.kind === 'DAY1' || row.kind === 'MISSED_WINDOW') {
      const leadId = row.leadKey.match(/^s:([^#]+)/)?.[1];
      if (leadId) {
        const lead = await prisma.scannedLead.findUnique({ where: { id: leadId }, select: { status: true, bookingStatus: true, bookingToken: true } });
        const worked = !lead || lead.status !== 'NEW' || !!lead.bookingStatus;
        if (worked) {
          await prisma.leadTextOutbox.update({ where: { leadKey: row.leadKey }, data: { status: 'CANCELLED' } });
          counts.skipped += 1;
          continue;
        }
        if (cfg.bookingLink && lead.bookingToken) bookingUrl = bookingUrlFor(lead.bookingToken);
      }
    }

    const to = cfg.testMode ? cfg.testNumber : row.phone;
    if (!to) {
      // Test mode with no test number configured — don't send anything.
      counts.skipped += 1;
      continue;
    }

    const body = renderLeadTextBody(row.source as LeadTextSource, row.province, row.kind as LeadTextKind, { bookingUrl });
    const from = pickSender(row.province, cfg.senderMap);

    let result = await sendSms({ to, body, mediaUrl: cfg.mediaUrl || undefined, from });
    if (!result.sent && cfg.mediaUrl) {
      // MMS failed — fall back to plain SMS so the customer still hears from us.
      result = await sendSms({ to, body, from });
    }

    if (result.sent) {
      await prisma.leadTextOutbox.update({
        where: { leadKey: row.leadKey },
        data: { status: 'SENT', channel: result.channel ?? null, twilioSid: result.sid ?? null, sentAt: new Date(), attempts: { increment: 1 } },
      });
      counts.sent += 1;
    } else {
      const attempts = row.attempts + 1;
      await prisma.leadTextOutbox.update({
        where: { leadKey: row.leadKey },
        data: { status: attempts >= 5 ? 'FAILED' : 'PENDING', attempts, error: (result.reason || 'error').slice(0, 200) },
      });
      counts.failed += 1;
    }
  }

  return counts;
}

/** Record a STOP/opt-out and cancel any queued texts to that number. */
export async function recordOptOut(phoneRaw: string, source = 'STOP'): Promise<boolean> {
  const phone = toE164(phoneRaw);
  if (!phone) return false;
  await prisma.smsOptOut.upsert({ where: { phone }, create: { phone, source }, update: {} });
  await prisma.leadTextOutbox.updateMany({ where: { phone, status: 'PENDING' }, data: { status: 'OPTED_OUT' } });
  return true;
}

/** Undo an opt-out (e.g. the customer replies START). */
export async function removeOptOut(phoneRaw: string): Promise<boolean> {
  const phone = toE164(phoneRaw);
  if (!phone) return false;
  await prisma.smsOptOut.deleteMany({ where: { phone } });
  return true;
}

// STOP / START keyword detection (EN + FR), used by the inbound webhook.
const STOP_WORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit', 'arret', 'arrete', 'desabonner']);
const START_WORDS = new Set(['start', 'unstop', 'yes', 'oui']);

export function classifyInboundSms(body: string): 'stop' | 'start' | 'other' {
  const w = (body || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (STOP_WORDS.has(w)) return 'stop';
  if (START_WORDS.has(w)) return 'start';
  return 'other';
}
