/**
 * Pure, dependency-free lead-text template pieces — shared by the server (sending)
 * and the admin editor (client, for the live preview). No `server-only` import.
 */

// Which message in the sequence a template is for.
export type LeadTextKind = 'CONFIRM' | 'DAY1' | 'MISSED_WINDOW' | 'REACTIVATION';

export const LEAD_TEXT_KINDS: { key: LeadTextKind; label: string; when: string }[] = [
  { key: 'CONFIRM', label: 'Confirmation', when: 'Sent the moment a lead lands' },
  { key: 'DAY1', label: 'Day-1 reminder', when: "If we haven't reached them (~24h)" },
  { key: 'MISSED_WINDOW', label: 'Missed-window', when: 'We missed the 24-48h promise (~48h)' },
  { key: 'REACTIVATION', label: 'Reactivation', when: 'Aged, still-unworked lead (7+ days)' },
];

// Merge fields an admin can drop into a template.
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
    first_name: first || (fr ? '' : 'there'),
    at_address: at,
    street: street || (fr ? 'votre adresse' : 'your place'),
    city: city || (fr ? 'votre secteur' : 'your area'),
    booking_link: input.bookingUrl || '',
    info_link: input.infoUrl || '',
  };
}

// Link tokens whose whole line is removed when empty (keep each on its own line).
const LINE_STRIP_IF_EMPTY = new Set(['booking_link', 'info_link']);

/** Fill a template's {{tokens}} and tidy spacing/punctuation. */
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
    .replace(/[ \t]+([,.;!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * The built-in message templates — friendly, personalized, spaced into short
 * phone-readable blocks. GSM-7 friendly; every message identifies the sender and
 * carries STOP + the /sms info link. Admins can override any of these.
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

/** SMS segment estimate for a rendered body (GSM-7: 160 single, 153/segment concat). */
export function smsSegments(text: string): number {
  const len = text.length;
  if (len === 0) return 1;
  return len <= 160 ? 1 : Math.ceil(len / 153);
}
