import 'server-only';
import { prisma } from './db';
import { getSettings } from './settings';
import { toE164, sendSms } from './sms';
import { bookingUrlFor } from './leadBooking';
import { parseWorkdays, isWorkday } from './businessDays';

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
  // Only send the reminder/missed-window/reactivation texts on working days
  // (the welcome/confirm text is never gated — it always goes out).
  followupWorkdaysOnly: 'leadText.followupWorkdaysOnly',
  followupWorkdays: 'leadText.followupWorkdays',
  // Include a self-booking link in the follow-up texts (Phase 2).
  bookingLink: 'leadText.bookingLink',
  // Aged-lead reactivation (Phase 2).
  reactivation: 'leadText.reactivation',
  reactivationDays: 'leadText.reactivationDays',
  reactivationMaxDays: 'leadText.reactivationMaxDays',
} as const;

export type LeadTextSource = 'HD_SHEET' | 'SCANNED' | 'MAILIN';
// Which message in the sequence this row is.
export type LeadTextKind = 'CONFIRM' | 'DAY1' | 'MISSED_WINDOW' | 'REACTIVATION';

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
  followupWorkdaysOnly: boolean; // hold reminders until a working day
  followupWorkdays: Set<number>; // which weekdays reminders may send (0=Sun..6=Sat)
  bookingLink: boolean; // append a self-booking link to the follow-up texts
  reactivation: boolean; // text aged, still-unworked leads once more
  reactivationDays: number; // a lead must be at least this old to be reactivated
  reactivationMaxDays: number; // and no older than this (stays within implied consent)
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
    // Working-days gate for reminders is opt-in; default day set is Mon–Fri.
    followupWorkdaysOnly: s[LEAD_TEXT_KEYS.followupWorkdaysOnly] === 'true',
    followupWorkdays: parseWorkdays(s[LEAD_TEXT_KEYS.followupWorkdays]),
    // Self-booking link is opt-in (off until the booking page is ready to share).
    bookingLink: s[LEAD_TEXT_KEYS.bookingLink] === 'true',
    // Reactivation is opt-in. Default window: 7 days old, up to 150 days (well
    // inside CASL's 6-month implied-consent window for an inquiry).
    reactivation: s[LEAD_TEXT_KEYS.reactivation] === 'true',
    reactivationDays: (() => { const n = Number(s[LEAD_TEXT_KEYS.reactivationDays]); return Number.isFinite(n) && n >= 1 ? n : 7; })(),
    reactivationMaxDays: (() => { const n = Number(s[LEAD_TEXT_KEYS.reactivationMaxDays]); return Number.isFinite(n) && n >= 2 ? n : 150; })(),
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

/**
 * Public link to the SMS program-info / opt-out page (/sms). CASL requires each
 * commercial message to identify the sender and give valid contact info; when it
 * isn't practical to put the full mailing address in a text, the regs let that
 * live on a readily-accessible web page linked from the message. This is that link.
 */
export function smsInfoUrl(): string {
  const base = (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
  return `${base}/sms`;
}

/**
 * On-demand HELP reply — the identification + contact info a customer gets back
 * if they text HELP/AIDE/INFO. Kept GSM-7-friendly and short.
 */
export function helpReplyBody(province?: string | null): string {
  const fr = leadTextLang(province) === 'fr';
  return fr
    ? `Home Depot Home Services (service assure par Georgian Water & Air). Aide: 1-866-840-2789 ou info@georgianwaterandair.ca. Repondez STOP pour vous desabonner.`
    : `Home Depot Home Services (serviced by Georgian Water & Air). Help: 1-866-840-2789 or info@georgianwaterandair.ca. Reply STOP to opt out.`;
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

// ---------------------------------------------------------------------------
// Message templates (editable) + personalization
// ---------------------------------------------------------------------------

// Merge fields an admin can drop into a template. Kept short + obvious.
export const LEAD_TEXT_TOKENS: { token: string; label: string; hint: string }[] = [
  { token: '{{first_name}}', label: 'First name', hint: "The customer's first name (falls back to a friendly greeting)" },
  { token: '{{at_address}}', label: 'At their address', hint: 'e.g. " at Scott St in Barrie" — the whole clause, or nothing if unknown' },
  { token: '{{street}}', label: 'Street', hint: 'Just the street name, e.g. "Scott St"' },
  { token: '{{city}}', label: 'City', hint: 'e.g. "Barrie"' },
  { token: '{{booking_link}}', label: 'Booking link', hint: 'Self-booking page link (its line is dropped if no link)' },
  { token: '{{info_link}}', label: 'Info/opt-out link', hint: 'The /sms program-info page (CASL)' },
];

/** The customer's first name from a full name ("Robyn Scott" → "Robyn"). */
export function firstNameOf(name?: string | null): string {
  return (name || '').trim().split(/\s+/)[0] || '';
}

/** The street NAME from a full address ("118 Scott St" → "Scott St"), dropping a
 *  leading house/unit number. Falls back to the input when nothing is left. */
export function streetNameOf(address?: string | null): string {
  const s = (address || '').trim();
  if (!s) return '';
  const stripped = s.replace(/^[\s#.\-]*\d+[A-Za-z]?(?:\s*-\s*\d+[A-Za-z]?)?\s+/, '').trim();
  return stripped || s;
}

export interface LeadTextVarsInput {
  firstName?: string | null; // full name is fine — the first word is used
  street?: string | null; // street name (or a full address — handled)
  city?: string | null;
  bookingUrl?: string | null;
  infoUrl?: string | null;
}

/** Resolve merge-field values (with graceful fallbacks) for a language. */
export function leadTextVars(input: LeadTextVarsInput, lang: 'en' | 'fr'): Record<string, string> {
  const fr = lang === 'fr';
  const first = firstNameOf(input.firstName);
  const street = streetNameOf(input.street);
  const city = (input.city || '').trim();
  let at = '';
  if (street && city) at = fr ? ` a ${street}, ${city}` : ` at ${street} in ${city}`;
  else if (street) at = fr ? ` a ${street}` : ` at ${street}`;
  else if (city) at = fr ? ` a ${city}` : ` in ${city}`;
  return {
    // No name → "Hi there," (EN) / "Bonjour," (FR, trailing comma tidied up).
    first_name: first || (fr ? '' : 'there'),
    at_address: at,
    street: street || (fr ? 'votre adresse' : 'your place'),
    city: city || (fr ? 'votre secteur' : 'your area'),
    booking_link: input.bookingUrl || '',
    info_link: input.infoUrl || '',
  };
}

// Link tokens whose whole line is removed when they have no value (so we never
// text "Book yourself:" or "Info:" with nothing after). Keep each on its own line.
const LINE_STRIP_IF_EMPTY = new Set(['booking_link', 'info_link']);

/** Fill a template's {{tokens}} and tidy spacing/punctuation. GSM-7 friendly in,
 *  GSM-7 friendly out. */
export function renderLeadTextTemplate(body: string, vars: Record<string, string>): string {
  let out = body;
  for (const [name, val] of Object.entries(vars)) {
    const token = `{{${name}}}`;
    if (val === '' && LINE_STRIP_IF_EMPTY.has(name)) {
      out = out.split('\n').filter((line) => !line.includes(token)).join('\n');
    } else {
      out = out.split(token).join(val);
    }
  }
  return out
    .replace(/[ \t]+([,.;!?])/g, '$1') // "Bonjour ," → "Bonjour,"
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * The built-in message templates — friendly, personalized, and spaced into short
 * blocks that read well on a phone. Kept GSM-7-friendly (straight quotes, hyphens,
 * no accents/guillemets) so the SMS fallback stays to as few segments as possible.
 * Admins can override any of these (stored per kind + language); these are the
 * defaults and the fallback.
 */
export const DEFAULT_LEAD_TEXTS: Record<LeadTextKind, Record<'en' | 'fr', string>> = {
  CONFIRM: {
    en: `Hi {{first_name}}, it's Home Depot Home Services (serviced by Georgian Water & Air).\n\nWe got your request for a free in-home water test{{at_address}}.\n\nA team member will call within 24-48 hrs to book a time. Our call shows as "HD Home Services". Msg & data rates may apply.\n\nReply STOP to opt out.\nInfo: {{info_link}}`,
    fr: `Bonjour {{first_name}}, ici Home Depot Home Services (service assure par Georgian Water & Air).\n\nNous avons recu votre demande d'evaluation de l'eau a domicile gratuite{{at_address}}.\n\nUn membre de l'equipe vous appellera d'ici 24-48 h pour planifier. Des frais peuvent s'appliquer.\n\nRepondez STOP pour vous desabonner.\nInfos: {{info_link}}`,
  },
  DAY1: {
    en: `Hi {{first_name}}, a quick reminder from Home Depot Home Services about your free in-home water test{{at_address}}.\n\nWe'll call soon to book - or reply with a day and time that works and we'll call then.\n\nBook yourself: {{booking_link}}\nReply STOP to opt out.\nInfo: {{info_link}}`,
    fr: `Bonjour {{first_name}}, petit rappel de Home Depot Home Services au sujet de votre evaluation de l'eau a domicile{{at_address}}.\n\nNous vous appellerons bientot - ou repondez avec un jour et une heure qui vous conviennent.\n\nReservez: {{booking_link}}\nRepondez STOP pour vous desabonner.\nInfos: {{info_link}}`,
  },
  MISSED_WINDOW: {
    en: `Hi {{first_name}}, it's Home Depot Home Services - sorry we haven't connected yet about your free water test{{at_address}}.\n\nWe'll try again within 36 hrs. If a certain day or time is easier, just reply.\n\nBook yourself: {{booking_link}}\nReply STOP to opt out.\nInfo: {{info_link}}`,
    fr: `Bonjour {{first_name}}, ici Home Depot Home Services - desole de ne pas vous avoir joint au sujet de votre evaluation de l'eau{{at_address}}.\n\nNous reessaierons d'ici 36 h. Si un jour ou une heure vous convient mieux, repondez.\n\nReservez: {{booking_link}}\nRepondez STOP pour vous desabonner.\nInfos: {{info_link}}`,
  },
  REACTIVATION: {
    en: `Hi {{first_name}}, it's Home Depot Home Services - your free in-home water test{{at_address}} is still available whenever you're ready.\n\nReply YES and we'll call to book.\nReply STOP to opt out.\nInfo: {{info_link}}`,
    fr: `Bonjour {{first_name}}, ici Home Depot Home Services - votre evaluation de l'eau a domicile gratuite{{at_address}} est toujours disponible.\n\nRepondez OUI et nous vous appellerons.\nRepondez STOP pour vous desabonner.\nInfos: {{info_link}}`,
  },
};

/** AppSetting key holding an admin's override for one template. */
export function leadTextTemplateKey(kind: LeadTextKind, lang: 'en' | 'fr'): string {
  return `leadText.tmpl.${kind}.${lang}`;
}

/**
 * Render a customer message from the (possibly overridden) template for its kind +
 * language, with personalization merged in. Async because it reads the override.
 */
export async function composeLeadText(opts: LeadTextVarsInput & { kind: LeadTextKind; province?: string | null }): Promise<string> {
  const lang = leadTextLang(opts.province);
  const key = leadTextTemplateKey(opts.kind, lang);
  const s = await getSettings([key]);
  const body = (s[key] || '').trim() || DEFAULT_LEAD_TEXTS[opts.kind][lang];
  return renderLeadTextTemplate(body, leadTextVars(opts, lang));
}

/**
 * Pure render from the BUILT-IN default template (no DB override) — used for the
 * admin previews and tests. `source` is accepted for signature compatibility but
 * no longer changes the body (the templates are source-agnostic now).
 */
export function renderLeadTextBody(
  source: LeadTextSource,
  province?: string | null,
  kind: LeadTextKind = 'CONFIRM',
  opts?: LeadTextVarsInput,
): string {
  const lang = leadTextLang(province);
  void source;
  return renderLeadTextTemplate(DEFAULT_LEAD_TEXTS[kind][lang], leadTextVars(opts ?? {}, lang));
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
  street?: string | null; // street (name or full address) for personalization
  city?: string | null;
}): Promise<{ queued: boolean; reason?: string }> {
  const cfg = await leadTextConfig();
  if (!cfg.enabled) return { queued: false, reason: 'disabled' };

  const phone = toE164(input.phone);
  if (!phone) return { queued: false, reason: 'bad-number' };

  const opted = await prisma.smsOptOut.findUnique({ where: { phone } });
  if (opted) return { queued: false, reason: 'opted-out' };

  const province = (input.province || '').toUpperCase() || null;
  const customerName = input.customerName?.trim() || null;
  const street = streetNameOf(input.street) || null;
  const city = input.city?.trim() || null;

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
        street,
        city,
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
            street,
            city,
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
      where: { leadKey: { in: [`${baseLeadKey}#d1`, `${baseLeadKey}#mw`, `${baseLeadKey}#re`] }, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  } catch (e) {
    console.error('[leadText] cancelLeadFollowups failed', e);
  }
}

/**
 * Queue a one-time "still available?" reactivation text for aged, still-unworked
 * scanned/mail-in leads (status NEW, no booking activity, within the configured
 * age window). Deduped by the "#re" key so each lead is reactivated at most once.
 * Best-effort; returns how many were queued.
 */
export async function enqueueReactivationTexts(limit = 300): Promise<number> {
  const cfg = await leadTextConfig();
  if (!cfg.enabled || !cfg.reactivation) return 0;

  const now = Date.now();
  const olderThan = new Date(now - cfg.reactivationDays * 24 * 60 * 60 * 1000);
  const notOlderThan = new Date(now - cfg.reactivationMaxDays * 24 * 60 * 60 * 1000);

  const leads = await prisma.scannedLead.findMany({
    where: {
      status: 'NEW',
      bookingStatus: null,
      phone: { not: null },
      createdAt: { lte: olderThan, gte: notOlderThan },
    },
    select: { id: true, phone: true, customerName: true, address: true, city: true, postalCode: true, dealerId: true, uploadedByGwa: true },
    take: limit,
  });

  let queued = 0;
  for (const l of leads) {
    const phone = toE164(l.phone);
    if (!phone) continue;
    const opted = await prisma.smsOptOut.findUnique({ where: { phone } });
    if (opted) continue;
    try {
      await prisma.leadTextOutbox.create({
        data: {
          leadKey: `s:${l.id}#re`,
          source: l.uploadedByGwa ? 'MAILIN' : 'SCANNED',
          kind: 'REACTIVATION',
          dealerId: l.dealerId,
          province: provinceFromPostalCode(l.postalCode),
          phone,
          customerName: l.customerName,
          street: streetNameOf(l.address) || null,
          city: l.city?.trim() || null,
          scheduledFor: new Date(),
          status: 'PENDING',
        },
      });
      queued += 1;
    } catch {
      // Already reactivated (dedupe on the #re key) — skip.
    }
  }
  return queued;
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

  // First, queue any aged-lead reactivations due this run (best-effort).
  if (cfg.reactivation) {
    try { await enqueueReactivationTexts(); } catch (e) { console.error('[leadText] reactivation enqueue failed', e); }
  }

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

    // Working-days gate — reminders only (the CONFIRM welcome text is never held).
    // A lead that lands Fri–Sun still gets its welcome right away, but the day-1,
    // missed-window and reactivation texts wait for the next configured working day,
    // so we don't nudge customers when no bookers are in to call.
    const isFollowup = row.kind === 'DAY1' || row.kind === 'MISSED_WINDOW' || row.kind === 'REACTIVATION';
    if (isFollowup && cfg.followupWorkdaysOnly) {
      if (!isWorkday(now, provinceTimezone(row.province), cfg.followupWorkdays)) {
        counts.held += 1;
        continue; // not a working day in the customer's zone — try a later sweep
      }
      // Don't bombard: if a weekend hold has bunched two reminders for the same
      // lead onto one day, send only the earlier one now and leave the next for
      // tomorrow (a ~12h floor between reminders to the same customer).
      const base = row.leadKey.replace(/#(d1|mw|re)$/, '');
      const recentSibling = await prisma.leadTextOutbox.findFirst({
        where: {
          leadKey: { in: [`${base}#d1`, `${base}#mw`, `${base}#re`], not: row.leadKey },
          status: 'SENT',
          sentAt: { gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) },
        },
        select: { leadKey: true },
      });
      if (recentSibling) {
        counts.held += 1;
        continue;
      }
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
    if (row.kind === 'DAY1' || row.kind === 'MISSED_WINDOW' || row.kind === 'REACTIVATION') {
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

    const body = await composeLeadText({
      kind: row.kind as LeadTextKind,
      province: row.province,
      firstName: row.customerName,
      street: row.street,
      city: row.city,
      bookingUrl,
      infoUrl: smsInfoUrl(),
    });
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

// STOP / START / HELP keyword detection (EN + FR), used by the inbound webhook.
const STOP_WORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit', 'arret', 'arrete', 'desabonner']);
const START_WORDS = new Set(['start', 'unstop', 'yes', 'oui']);
const HELP_WORDS = new Set(['help', 'info', 'aide']);

export function classifyInboundSms(body: string): 'stop' | 'start' | 'help' | 'other' {
  const w = (body || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (STOP_WORDS.has(w)) return 'stop';
  if (START_WORDS.has(w)) return 'start';
  if (HELP_WORDS.has(w)) return 'help';
  return 'other';
}
