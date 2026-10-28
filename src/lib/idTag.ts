import 'server-only';
import { prisma } from './db';
import { getSetting, setSetting } from './settings';
import { putDocument, deleteDocument } from './storage';
import type { IdTagKind, IdTagStatus } from '@prisma/client';

// Rollout gate for the whole HD ID Tag feature (independent of training), so it
// can be hidden while it's being built. Stored as a JSON array of dealer ids:
//   non-empty list -> ONLY those offices see it,
//   unset / empty  -> default to the Georgian Water & Air office only (by name),
//                     so it stays hidden from every other office until an admin
//                     explicitly opens it up.
export const ID_TAG_OFFICES_KEY = 'idTag.enabledOffices';

export async function getIdTagEnabledOffices(): Promise<string[] | null> {
  const raw = await getSetting(ID_TAG_OFFICES_KEY);
  if (!raw) return null;
  try {
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

export async function setIdTagEnabledOffices(ids: string[]): Promise<void> {
  await setSetting(ID_TAG_OFFICES_KEY, ids.length ? JSON.stringify(ids) : '');
}

/** Whether an office can see/use the HD ID Tag feature. Non-empty allowlist =
 *  only those offices; no allowlist = the Georgian Water & Air office only. */
export async function isIdTagEnabledForDealer(dealerId: string | null | undefined): Promise<boolean> {
  if (!dealerId) return false;
  const list = await getIdTagEnabledOffices();
  if (list && list.length) return list.includes(dealerId);
  const dealer = await prisma.dealer.findUnique({ where: { id: dealerId }, select: { name: true } });
  return /georgian\s*water/i.test(dealer?.name || '');
}

// Home Depot ID-tag requests. Each person an office submits is matched against
// their training certificates (by office + normalized name / email). Training is
// a visible NUDGE, never a hard block: a person with no certificate is logged
// with status AWAITING_TRAINING and flagged until they complete it.

/** Normalize a name for case/punctuation-insensitive matching (mirrors journal norm). */
export function normName(s: string): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// ── Per-office standardized temporary password (Home Depot ID-tag onboarding) ──
// Each office gets ONE password that goes into every new-rep onboarding email,
// so the Entuitive screening sign-in is identical for everyone from that
// location. Reviewers set/override it in Staff → ID tags; a blank value falls
// back to the global screening password.

/**
 * Suggest a standardized password from an office name: a single location word
 * plus "123!", matching the house convention (e.g. "Georgian Water and Air,
 * Winnipeg" → "Winnipeg123!", "CAWS" → "CAWS123!"). The reviewer can edit it —
 * this is only a prefill.
 */
export function suggestIdTagPassword(name: string): string {
  const raw = String(name || '').trim();
  // Prefer the location after a comma ("… , Winnipeg"); else drop the common
  // "Georgian Water & Air" / "GWA" company prefix and take the first real word.
  let token = '';
  if (raw.includes(',')) {
    token = raw.split(',').pop()!.trim();
  } else {
    token = raw
      .replace(/georgian\s*water\s*(&|and)?\s*air/gi, '')
      .replace(/\bGWA\b/g, '')
      .trim();
  }
  token = (token.split(/\s+/).find(Boolean) || token).replace(/[^A-Za-z0-9]/g, '');
  if (!token) return 'Office123!';
  // Keep a short all-caps acronym as-is (CAWS); otherwise Title-case (Winnipeg).
  const isAcronym = token.length <= 5 && token === token.toUpperCase();
  const cased = isAcronym ? token : token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  return `${cased}123!`;
}

/** This office's standardized ID-tag password, or null when not set. */
export async function getDealerIdTagPassword(dealerId: string | null | undefined): Promise<string | null> {
  if (!dealerId) return null;
  const d = await prisma.dealer.findUnique({ where: { id: dealerId }, select: { idTagTempPassword: true } });
  return (d?.idTagTempPassword || '').trim() || null;
}

export interface OfficeIdTagPassword {
  id: string;
  name: string;
  /** The saved password (empty string when the office hasn't set one). */
  password: string;
  /** The suggested default, shown as a placeholder when none is saved. */
  suggestion: string;
}

/** Every active office with its saved ID-tag password + a suggested default. */
export async function listOfficeIdTagPasswords(): Promise<OfficeIdTagPassword[]> {
  const dealers = await prisma.dealer.findMany({
    where: { active: true },
    select: { id: true, name: true, idTagTempPassword: true },
    orderBy: { name: 'asc' },
  });
  return dealers.map((d) => ({
    id: d.id,
    name: d.name,
    password: (d.idTagTempPassword || '').trim(),
    suggestion: suggestIdTagPassword(d.name),
  }));
}

/** Save (or clear, when blank) one office's standardized ID-tag password. */
export async function setDealerIdTagPassword(dealerId: string, password: string): Promise<void> {
  await prisma.dealer.update({
    where: { id: dealerId },
    data: { idTagTempPassword: (password || '').trim() || null },
  });
}

// ── Per-office Entuitive "New User" profile ───────────────────────────────────
// Entered once per office; every person's Entuitive setup sheet auto-fills from
// it (plus the person's own name/email/cell and the office password above).

export interface OfficeEntuitiveProfile {
  companyName?: string;  // "Company Name" as Entuitive expects it
  street?: string;       // Street #
  streetName?: string;   // Street Name
  unit?: string;         // Unit/Apt #
  city?: string;
  province?: string;     // default Ontario
  postal?: string;
  phone?: string;        // office Phone #
  ext?: string;
  service?: string;      // e.g. "Water Treatment (Home Depot Canada)"
}

export const OFFICE_PROFILE_FIELDS: (keyof OfficeEntuitiveProfile)[] = [
  'companyName', 'street', 'streetName', 'unit', 'city', 'province', 'postal', 'phone', 'ext', 'service',
];

// Every office's Entuitive service is the same Home Depot program.
const ENTUITIVE_SERVICE_DEFAULT = 'Water Treatment (Home Depot Canada)';

// Canadian province abbreviation → the full name Entuitive expects.
const PROVINCES: Record<string, string> = {
  on: 'Ontario', qc: 'Quebec', ns: 'Nova Scotia', nb: 'New Brunswick',
  nl: 'Newfoundland and Labrador', nf: 'Newfoundland and Labrador',
  pe: 'Prince Edward Island', pei: 'Prince Edward Island', mb: 'Manitoba',
  sk: 'Saskatchewan', ab: 'Alberta', bc: 'British Columbia', yt: 'Yukon',
  nt: 'Northwest Territories', nu: 'Nunavut',
};
const PROVINCE_NAMES = new Set(Object.values(PROVINCES).map((s) => s.toLowerCase()));

/**
 * Best-effort split of a one-line office address (as stored in the Office
 * directory, e.g. "30 Damascus Road Unit 109, Bedford, NS, B4A0C1") into the
 * separate boxes Entuitive wants. Tolerant of missing pieces — whatever it can't
 * confidently parse is left blank for a human to fill. Never throws.
 */
export function parseOfficeAddress(address: string | null | undefined): Partial<OfficeEntuitiveProfile> {
  const out: Partial<OfficeEntuitiveProfile> = {};
  let s = String(address || '').trim();
  if (!s) return out;

  // Postal code (A1A 1A1, space optional) — pull it out first.
  const postal = s.match(/\b([A-Za-z]\d[A-Za-z])\s?(\d[A-Za-z]\d)\b/);
  if (postal) { out.postal = `${postal[1].toUpperCase()} ${postal[2].toUpperCase()}`; s = s.replace(postal[0], '').trim(); }

  let parts = s.split(',').map((p) => p.trim()).filter(Boolean);

  // Province: a whole comma-part that is a province, or the trailing token of one.
  for (let i = parts.length - 1; i >= 0; i--) {
    const key = parts[i].toLowerCase().replace(/\./g, '');
    if (PROVINCES[key]) { out.province = PROVINCES[key]; parts.splice(i, 1); break; }
    if (PROVINCE_NAMES.has(key)) { out.province = parts[i]; parts.splice(i, 1); break; }
    const toks = parts[i].split(/\s+/);
    const last = toks[toks.length - 1].toLowerCase().replace(/\./g, '');
    if (toks.length > 1 && PROVINCES[last]) { out.province = PROVINCES[last]; toks.pop(); parts[i] = toks.join(' '); break; }
  }

  const streetLine = parts.shift() || '';
  if (parts.length) out.city = parts[parts.length - 1]; // last remaining part is the city

  // Unit / Apt / Suite / # out of the street line.
  let sl = streetLine;
  const unit = sl.match(/\b(?:unit|apt|apartment|suite|ste|#)\s*\.?\s*([A-Za-z0-9-]+)/i);
  if (unit) { out.unit = unit[1]; sl = sl.replace(unit[0], ' ').replace(/\s{2,}/g, ' ').replace(/[,\s]+$/,'').trim(); }

  // Leading civic number (may carry a letter, e.g. 11A) then the street name.
  const m = sl.match(/^(\d+[A-Za-z]?)\s+(.*)$/);
  if (m) { out.street = m[1]; out.streetName = m[2].trim(); }
  else if (sl) { out.streetName = sl; }

  return out;
}

/** The Entuitive profile a directory record implies, before any manual override. */
export function deriveEntuitiveProfile(args: { name: string; businessName?: string | null; address?: string | null; phone?: string | null }): OfficeEntuitiveProfile {
  const parsed = parseOfficeAddress(args.address);
  const companyName = (args.businessName || args.name || '').trim();
  const phone = (args.phone || '').trim();
  return {
    ...(companyName ? { companyName } : {}),
    ...parsed,
    ...(phone ? { phone } : {}),
    service: ENTUITIVE_SERVICE_DEFAULT,
  };
}

/** A manually-saved profile layered over the directory-derived one, per field. */
export function mergeEntuitiveProfile(saved: OfficeEntuitiveProfile, derived: OfficeEntuitiveProfile): OfficeEntuitiveProfile {
  const out: OfficeEntuitiveProfile = {};
  for (const k of OFFICE_PROFILE_FIELDS) {
    const sv = (saved[k] ?? '').toString().trim();
    const v = sv || derived[k];
    if (v) out[k] = v;
  }
  return out;
}

/** The raw saved profile JSON (manual overrides only), or {} when unset. */
function savedProfileOf(json: unknown): OfficeEntuitiveProfile {
  return json && typeof json === 'object' && !Array.isArray(json) ? (json as OfficeEntuitiveProfile) : {};
}

/**
 * The office's effective Entuitive profile: the Office directory's company
 * name / address / phone (address auto-split), with any manually-saved field
 * taking precedence. So an office never has to re-type what the directory
 * already holds — saving is only to override or fill a gap.
 */
export async function getDealerEntuitiveProfile(dealerId: string | null | undefined): Promise<OfficeEntuitiveProfile> {
  if (!dealerId) return {};
  const d = await prisma.dealer.findUnique({
    where: { id: dealerId },
    select: { name: true, idTagOfficeProfile: true, profile: { select: { businessName: true, address: true, phone: true } } },
  });
  if (!d) return {};
  const derived = deriveEntuitiveProfile({ name: d.name, businessName: d.profile?.businessName, address: d.profile?.address, phone: d.profile?.phone });
  return mergeEntuitiveProfile(savedProfileOf(d.idTagOfficeProfile), derived);
}

/** Save one office's Entuitive profile (empty fields are dropped). */
export async function setDealerEntuitiveProfile(dealerId: string, profile: OfficeEntuitiveProfile): Promise<void> {
  const clean: Record<string, string> = {};
  for (const k of OFFICE_PROFILE_FIELDS) {
    const v = (profile[k] ?? '').toString().trim();
    if (v) clean[k] = v;
  }
  await prisma.dealer.update({
    where: { id: dealerId },
    data: { idTagOfficeProfile: clean },
  });
}

export interface OfficeIdTagSetup {
  id: string;
  name: string;
  password: string;         // saved password ('' when unset)
  suggestion: string;       // suggested default password
  profile: OfficeEntuitiveProfile;  // effective: directory-derived, saved fields win
  /** True when some fields come from the Office directory, not a manual save. */
  fromDirectory: boolean;
  /** True when the directory has no address on file (nothing to prefill). */
  directoryMissing: boolean;
}

/** Every active office with its ID-tag password + Entuitive profile, for the
 *  staff setup screen. The profile is directory-derived (company/address/phone
 *  from the Office directory, address auto-split) with any manual save on top. */
export async function listOfficeIdTagSetup(): Promise<OfficeIdTagSetup[]> {
  const dealers = await prisma.dealer.findMany({
    where: { active: true },
    select: { id: true, name: true, idTagTempPassword: true, idTagOfficeProfile: true, profile: { select: { businessName: true, address: true, phone: true } } },
    orderBy: { name: 'asc' },
  });
  return dealers.map((d) => {
    const saved = savedProfileOf(d.idTagOfficeProfile);
    const derived = deriveEntuitiveProfile({ name: d.name, businessName: d.profile?.businessName, address: d.profile?.address, phone: d.profile?.phone });
    const profile = mergeEntuitiveProfile(saved, derived);
    const savedKeys = OFFICE_PROFILE_FIELDS.filter((k) => (saved[k] ?? '').toString().trim());
    return {
      id: d.id,
      name: d.name,
      password: (d.idTagTempPassword || '').trim(),
      suggestion: suggestIdTagPassword(d.name),
      fromDirectory: savedKeys.length === 0 && OFFICE_PROFILE_FIELDS.some((k) => profile[k]),
      directoryMissing: !(d.profile?.address || '').trim(),
      profile,
    };
  });
}

export const ID_TAG_STATUS_LABEL: Record<IdTagStatus, string> = {
  AWAITING_TRAINING: 'Needs training',
  SUBMITTED: 'Submitted',
  BACKGROUND_CHECK: 'Background check',
  APPROVED: 'Approved',
  TAG_ISSUED: 'Tag issued',
  ACTIVE: 'Has tag / active',
  ON_HOLD: 'On hold',
  NOT_PROCEEDING: 'Not proceeding',
};

export type StatusTone = 'amber' | 'slate' | 'blue' | 'indigo' | 'green' | 'red';
/** Tailwind classes for each tone (pill backgrounds/text). */
export const TONE_CLASS: Record<StatusTone, string> = {
  amber: 'bg-amber-100 text-amber-800',
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-100 text-blue-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
};
export const ID_TAG_STATUS_TONE: Record<IdTagStatus, StatusTone> = {
  AWAITING_TRAINING: 'amber',
  SUBMITTED: 'slate',
  BACKGROUND_CHECK: 'blue',
  APPROVED: 'indigo',
  TAG_ISSUED: 'green',
  ACTIVE: 'green',
  ON_HOLD: 'amber',
  NOT_PROCEEDING: 'red',
};

/** The statuses a person can be moved to, given their kind. */
export function nextStatusesFor(kind: IdTagKind): IdTagStatus[] {
  if (kind === 'EXISTING') return ['ACTIVE', 'ON_HOLD', 'NOT_PROCEEDING'];
  return ['AWAITING_TRAINING', 'SUBMITTED', 'BACKGROUND_CHECK', 'APPROVED', 'TAG_ISSUED', 'ON_HOLD', 'NOT_PROCEEDING'];
}

const ALL_STATUSES: IdTagStatus[] = [
  'AWAITING_TRAINING', 'SUBMITTED', 'BACKGROUND_CHECK', 'APPROVED', 'TAG_ISSUED', 'ACTIVE', 'ON_HOLD', 'NOT_PROCEEDING',
];
export function isIdTagStatus(v: string): v is IdTagStatus {
  return (ALL_STATUSES as string[]).includes(v);
}

/** Find a passing training certificate for a person within their office. */
export async function findCertForPerson(
  dealerId: string,
  name: string,
  email?: string | null,
): Promise<{ id: string } | null> {
  const target = normName(name);
  if (!target) return null;
  const certs = await prisma.trainingCertification.findMany({
    where: { dealerId, passed: true },
    select: { id: true, traineeName: true, traineeEmail: true },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });
  const emailNorm = (email || '').trim().toLowerCase();
  if (emailNorm) {
    const byEmail = certs.find((c) => (c.traineeEmail || '').trim().toLowerCase() === emailNorm);
    if (byEmail) return { id: byEmail.id };
  }
  const byName = certs.find((c) => normName(c.traineeName) === target);
  return byName ? { id: byName.id } : null;
}

export interface CreateIdTagInput {
  dealerId: string;
  submittedById?: string | null;
  personName: string;
  personFirst?: string | null;
  personLast?: string | null;
  personEmail?: string | null;
  personPhone?: string | null;
  /** S3 key for the rep's headshot, when the dealer uploaded one at submit. */
  headshotKey?: string | null;
  kind: IdTagKind;
}

export interface CreateIdTagResult {
  id: string;
  status: IdTagStatus;
  certified: boolean;
  /** true when a new rep is certified and so the background-check email should fire. */
  sendScreeningEmail: boolean;
  /** true when an existing-tag rep should get the welcome email. */
  sendWelcomeEmail: boolean;
}

/** Create a request, matching the training cert and choosing the start status. */
export async function createIdTagRequest(input: CreateIdTagInput): Promise<CreateIdTagResult> {
  const cert = await findCertForPerson(input.dealerId, input.personName, input.personEmail);
  const certified = !!cert;
  let status: IdTagStatus;
  if (input.kind === 'EXISTING') status = 'ACTIVE';
  else status = certified ? 'SUBMITTED' : 'AWAITING_TRAINING';

  const rec = await prisma.homeDepotIdTag.create({
    data: {
      dealerId: input.dealerId,
      submittedById: input.submittedById || null,
      personName: input.personName.trim(),
      personFirst: (input.personFirst || '').trim() || null,
      personLast: (input.personLast || '').trim() || null,
      personEmail: (input.personEmail || '').trim() || null,
      personPhone: (input.personPhone || '').trim() || null,
      headshotKey: (input.headshotKey || '').trim() || null,
      kind: input.kind,
      status,
      certificationId: cert?.id || null,
      emailSentAt: null,
      // Existing-tag reps are active the moment they're added (billable event).
      activatedAt: status === 'ACTIVE' ? new Date() : null,
    },
    select: { id: true, status: true },
  });

  return {
    id: rec.id,
    status: rec.status,
    certified,
    sendScreeningEmail: input.kind === 'NEW' && certified,
    sendWelcomeEmail: input.kind === 'EXISTING',
  };
}

/** Mark that the onboarding/welcome email went out. */
export async function markIdTagEmailed(id: string): Promise<void> {
  await prisma.homeDepotIdTag.update({ where: { id }, data: { emailSentAt: new Date() } }).catch(() => {});
}

/** Manually set a request's status (admin/reviewer control). Stamps activatedAt
 *  the first time a rep reaches an active state (the billable event). */
export async function setIdTagStatus(id: string, status: IdTagStatus): Promise<void> {
  if (status === 'TAG_ISSUED' || status === 'ACTIVE') {
    await prisma.homeDepotIdTag.updateMany({ where: { id, activatedAt: null }, data: { activatedAt: new Date() } });
  }
  await prisma.homeDepotIdTag.update({ where: { id }, data: { status } });
}

/**
 * When a training certificate is created, advance any of this person's parked
 * (AWAITING_TRAINING, NEW) ID-tag requests to SUBMITTED and link the cert.
 * Returns the advanced requests so the caller can fire the background-check email.
 * Best-effort: never throws.
 */
export async function advancePendingIdTagsForCert(params: {
  dealerId: string;
  traineeName: string;
  traineeEmail?: string | null;
  certId: string;
}): Promise<Array<{ id: string; personName: string; personEmail: string | null }>> {
  try {
    const target = normName(params.traineeName);
    if (!target) return [];
    const pending = await prisma.homeDepotIdTag.findMany({
      where: { dealerId: params.dealerId, status: 'AWAITING_TRAINING', kind: 'NEW' },
      select: { id: true, personName: true, personEmail: true },
    });
    const emailNorm = (params.traineeEmail || '').trim().toLowerCase();
    const matches = pending.filter(
      (p) => normName(p.personName) === target
        || (!!emailNorm && (p.personEmail || '').trim().toLowerCase() === emailNorm),
    );
    if (!matches.length) return [];
    await prisma.homeDepotIdTag.updateMany({
      where: { id: { in: matches.map((m) => m.id) } },
      data: { status: 'SUBMITTED', certificationId: params.certId },
    });
    return matches.map((m) => ({ id: m.id, personName: m.personName, personEmail: m.personEmail }));
  } catch (e) {
    console.error('[idTag] advancePendingIdTagsForCert failed', e);
    return [];
  }
}

export interface IdTagRow {
  id: string;
  personName: string;
  personEmail: string | null;
  personPhone: string | null;
  kind: IdTagKind;
  status: IdTagStatus;
  certified: boolean;
  hasHeadshot: boolean;
  hasCard: boolean;
  cardIsImage: boolean;
  validUntil: Date | null;
  dealerId: string;
  dealerName?: string;
  createdAt: Date;
}

/** Whole days until `d` (negative once past); null when no date. */
export function daysUntil(d: Date | null | undefined): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

/** Tone for a days-to-expiry value: green > 30, amber ≤ 30, red once past. */
export function expiryTone(days: number | null): StatusTone {
  if (days === null) return 'slate';
  if (days < 0) return 'red';
  if (days <= 30) return 'amber';
  return 'green';
}

/** Short human label for a days-to-expiry value. */
export function expiryLabel(days: number | null): string {
  if (days === null) return '—';
  if (days < 0) return `expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'expires today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

/** All requests for one office, newest first. */
export async function listIdTagForDealer(dealerId: string): Promise<IdTagRow[]> {
  const rows = await prisma.homeDepotIdTag.findMany({
    where: { dealerId },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: { id: true, personName: true, personEmail: true, personPhone: true, kind: true, status: true, certificationId: true, headshotKey: true, cardFileKey: true, validUntil: true, dealerId: true, createdAt: true },
  });
  return rows.map(({ certificationId, headshotKey, cardFileKey, ...r }) => ({
    ...r, certified: !!certificationId, hasHeadshot: !!headshotKey, hasCard: !!cardFileKey,
    cardIsImage: /\.(png|jpe?g|webp|gif)$/i.test(cardFileKey || ''),
  }));
}

/** All requests across every office (admin/reviewer board). `q` searches the
 *  person's name and email (case-insensitive) so anyone can be found later. */
export async function listAllIdTags(filter?: { dealerId?: string; status?: IdTagStatus; q?: string }): Promise<IdTagRow[]> {
  const q = (filter?.q || '').trim();
  const rows = await prisma.homeDepotIdTag.findMany({
    where: {
      ...(filter?.dealerId ? { dealerId: filter.dealerId } : {}),
      ...(filter?.status ? { status: filter.status } : {}),
      ...(q
        ? { OR: [
            { personName: { contains: q, mode: 'insensitive' } },
            { personEmail: { contains: q, mode: 'insensitive' } },
            { personPhone: { contains: q } },
            { badgeNumber: { contains: q, mode: 'insensitive' } },
          ] }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
    select: {
      id: true, personName: true, personEmail: true, personPhone: true, kind: true, status: true,
      certificationId: true, headshotKey: true, cardFileKey: true, validUntil: true, dealerId: true, createdAt: true,
      dealer: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id, personName: r.personName, personEmail: r.personEmail, personPhone: r.personPhone,
    kind: r.kind, status: r.status, certified: !!r.certificationId, hasHeadshot: !!r.headshotKey,
    hasCard: !!r.cardFileKey, cardIsImage: /\.(png|jpe?g|webp|gif)$/i.test(r.cardFileKey || ''), validUntil: r.validUntil,
    dealerId: r.dealerId, dealerName: r.dealer?.name, createdAt: r.createdAt,
  }));
}

// ── Person detail (reviewer workspace) ────────────────────────────────────────

export interface IdTagDetail {
  id: string;
  dealerId: string;
  dealerName: string;
  personName: string;
  personFirst: string | null;
  personLast: string | null;
  personEmail: string | null;
  personPhone: string | null;
  kind: IdTagKind;
  status: IdTagStatus;
  certified: boolean;
  hasHeadshot: boolean;
  hasCard: boolean;
  cardIsImage: boolean;
  validUntil: Date | null;
  badgeNumber: string | null;
  entuitiveStatus: string | null;
  /** When the background-check / onboarding email was last sent, or null. */
  emailSentAt: Date | null;
  /** The office's standardized Entuitive password (for the setup sheet). */
  password: string | null;
  /** The office's Entuitive "New User" profile (company, address, etc.). */
  profile: OfficeEntuitiveProfile;
  createdAt: Date;
}

/** Full detail for one person — the reviewer's Entuitive setup sheet + card. */
export async function getIdTagDetail(id: string): Promise<IdTagDetail | null> {
  const r = await prisma.homeDepotIdTag.findUnique({
    where: { id },
    select: {
      id: true, dealerId: true, personName: true, personFirst: true, personLast: true,
      personEmail: true, personPhone: true, kind: true, status: true, certificationId: true,
      headshotKey: true, cardFileKey: true, validUntil: true, badgeNumber: true, entuitiveStatus: true, emailSentAt: true, createdAt: true,
      dealer: { select: { name: true, idTagTempPassword: true, idTagOfficeProfile: true, profile: { select: { businessName: true, address: true, phone: true } } } },
    },
  });
  if (!r) return null;
  const derivedProfile = deriveEntuitiveProfile({ name: r.dealer?.name || '', businessName: r.dealer?.profile?.businessName, address: r.dealer?.profile?.address, phone: r.dealer?.profile?.phone });
  const effectiveProfile = mergeEntuitiveProfile(savedProfileOf(r.dealer?.idTagOfficeProfile), derivedProfile);
  return {
    id: r.id, dealerId: r.dealerId, dealerName: r.dealer?.name || '',
    personName: r.personName, personFirst: r.personFirst, personLast: r.personLast,
    personEmail: r.personEmail, personPhone: r.personPhone,
    kind: r.kind, status: r.status, certified: !!r.certificationId,
    hasHeadshot: !!r.headshotKey, hasCard: !!r.cardFileKey,
    cardIsImage: /\.(png|jpe?g|webp|gif)$/i.test(r.cardFileKey || ''),
    validUntil: r.validUntil, badgeNumber: r.badgeNumber, entuitiveStatus: r.entuitiveStatus,
    emailSentAt: r.emailSentAt,
    password: (r.dealer?.idTagTempPassword || '').trim() || null,
    profile: effectiveProfile,
    createdAt: r.createdAt,
  };
}

/** Update the card-side fields read off / set against the Entuitive card. Pass a
 *  key only to change it (undefined leaves it as-is). */
export async function setIdTagCardInfo(
  id: string,
  data: { validUntil?: Date | null; badgeNumber?: string | null; entuitiveStatus?: string | null; cardFileKey?: string | null },
): Promise<void> {
  await prisma.homeDepotIdTag.update({
    where: { id },
    data: {
      // Changing validUntil restarts the reminder cycle (a renewal resets it).
      ...(data.validUntil !== undefined ? { validUntil: data.validUntil, expiryRemindStage: null } : {}),
      ...(data.badgeNumber !== undefined ? { badgeNumber: data.badgeNumber } : {}),
      ...(data.entuitiveStatus !== undefined ? { entuitiveStatus: data.entuitiveStatus } : {}),
      ...(data.cardFileKey !== undefined ? { cardFileKey: data.cardFileKey } : {}),
    },
  });
}

/** Look up the storage keys + the bits needed to auto-name a downloaded file.
 *  `startedDate` is the rep's training start date (from their certificate), or
 *  the added date as a fallback. */
export async function getIdTagFileKeys(id: string): Promise<{
  dealerId: string; headshotKey: string | null; cardFileKey: string | null;
  personName: string; badgeNumber: string | null; startedDate: string;
} | null> {
  const r = await prisma.homeDepotIdTag.findUnique({
    where: { id },
    select: { dealerId: true, headshotKey: true, cardFileKey: true, personName: true, badgeNumber: true, certificationId: true, createdAt: true },
  });
  if (!r) return null;
  let started = '';
  if (r.certificationId) {
    const cert = await prisma.trainingCertification.findUnique({ where: { id: r.certificationId }, select: { startDate: true } });
    started = (cert?.startDate || '').trim();
  }
  if (!started) started = r.createdAt.toISOString().slice(0, 10);
  return {
    dealerId: r.dealerId, headshotKey: r.headshotKey, cardFileKey: r.cardFileKey,
    personName: r.personName, badgeNumber: r.badgeNumber, startedDate: started,
  };
}

/** Replace (or set) a person's headshot: store the new image to S3, delete the
 *  old one, and update headshotKey. Returns false on a bad/missing/too-big file.
 *  Access is enforced by the caller (dealer owns it, or internal staff). */
export async function saveIdTagHeadshot(id: string, file: File | null | undefined): Promise<boolean> {
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file) || file.size === 0) return false;
  if (file.size > 8 * 1024 * 1024) return false;
  try {
    const cur = await prisma.homeDepotIdTag.findUnique({ where: { id }, select: { dealerId: true, headshotKey: true } });
    if (!cur) return false;
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || '.jpg').toLowerCase();
    const key = `idtags/${cur.dealerId}/${Date.now()}-headshot${ext}`;
    await putDocument(key, buf);
    if (cur.headshotKey) { try { await deleteDocument(cur.headshotKey); } catch { /* best-effort */ } }
    await prisma.homeDepotIdTag.update({ where: { id }, data: { headshotKey: key } });
    return true;
  } catch (e) {
    console.error('[idTag] headshot save failed', e);
    return false;
  }
}

/** Permanently delete an ID-tag record and its stored files (headshot + card). */
export async function deleteIdTag(id: string): Promise<void> {
  const r = await prisma.homeDepotIdTag.findUnique({ where: { id }, select: { headshotKey: true, cardFileKey: true } });
  if (!r) return;
  if (r.headshotKey) { try { await deleteDocument(r.headshotKey); } catch { /* best-effort */ } }
  if (r.cardFileKey) { try { await deleteDocument(r.cardFileKey); } catch { /* best-effort */ } }
  await prisma.homeDepotIdTag.delete({ where: { id } }).catch(() => {});
}

/** Auto-name an uploaded ID-tag file: rep name + their start date (post-training)
 *  + their HD badge #, e.g. "Warren-Ryckman_2026-10-23_HD1043317_card.pdf". */
export function idTagFileName(
  parts: { personName: string; date: string | Date | null | undefined; badgeNumber: string | null | undefined },
  suffix: string,
  ext: string,
): string {
  const clean = (s: string) => (s || '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const name = clean(parts.personName) || 'rep';
  const d = parts.date ? (typeof parts.date === 'string' ? parts.date.slice(0, 10) : new Date(parts.date).toISOString().slice(0, 10)) : '';
  const hd = parts.badgeNumber ? `HD${clean(parts.badgeNumber)}` : '';
  const base = [name, d, hd, suffix].filter(Boolean).join('_');
  return `${base}.${ext.replace(/^\./, '')}`;
}

/** Summary counts for the admin board tiles. */
export async function idTagCounts(): Promise<{ needsTraining: number; awaitingScreening: number; approved: number; issued: number; hasTag: number }> {
  const [needsTraining, submitted, backgroundCheck, approved, issued, hasTag] = await Promise.all([
    prisma.homeDepotIdTag.count({ where: { status: 'AWAITING_TRAINING' } }),
    prisma.homeDepotIdTag.count({ where: { status: 'SUBMITTED' } }),
    prisma.homeDepotIdTag.count({ where: { status: 'BACKGROUND_CHECK' } }),
    prisma.homeDepotIdTag.count({ where: { status: 'APPROVED' } }),
    prisma.homeDepotIdTag.count({ where: { status: 'TAG_ISSUED' } }),
    prisma.homeDepotIdTag.count({ where: { status: 'ACTIVE' } }),
  ]);
  return { needsTraining, awaitingScreening: submitted + backgroundCheck, approved, issued, hasTag };
}
