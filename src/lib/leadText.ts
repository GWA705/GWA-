import 'server-only';
import { prisma } from './db';
import { getSettings } from './settings';
import { toE164, sendSms } from './sms';

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
} as const;

export type LeadTextSource = 'HD_SHEET' | 'SCANNED' | 'MAILIN';

export interface LeadTextConfig {
  enabled: boolean;
  testMode: boolean;
  testNumber: string | null;
  mediaUrl: string | null;
  senderMap: Record<string, string>;
  quietStart: number; // local hour, inclusive
  quietEnd: number; // local hour, exclusive
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
  return {
    enabled: s[LEAD_TEXT_KEYS.enabled] === 'true',
    // Default to test mode unless explicitly turned off — safest default.
    testMode: s[LEAD_TEXT_KEYS.testMode] !== 'false',
    testNumber: s[LEAD_TEXT_KEYS.testNumber] || null,
    mediaUrl: s[LEAD_TEXT_KEYS.mediaUrl] || null,
    senderMap,
    quietStart: Number.isFinite(qs) ? qs : 8,
    quietEnd: Number.isFinite(qe) ? qe : 21,
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
export function renderLeadTextBody(source: LeadTextSource, province?: string | null): string {
  if (leadTextLang(province) === 'fr') {
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

  try {
    await prisma.leadTextOutbox.create({
      data: {
        leadKey: input.leadKey,
        source: input.source,
        dealerId: input.dealerId ?? null,
        province: (input.province || '').toUpperCase() || null,
        phone,
        customerName: input.customerName?.trim() || null,
        scheduledFor: new Date(),
        status: 'PENDING',
      },
    });
    return { queued: true };
  } catch {
    // Unique leadKey violation → already queued. That's the dedupe working.
    return { queued: false, reason: 'duplicate' };
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

    const to = cfg.testMode ? cfg.testNumber : row.phone;
    if (!to) {
      // Test mode with no test number configured — don't send anything.
      counts.skipped += 1;
      continue;
    }

    const body = renderLeadTextBody(row.source as LeadTextSource, row.province);
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
