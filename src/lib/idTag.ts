import 'server-only';
import { prisma } from './db';
import { getSetting, setSetting } from './settings';
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
  personEmail?: string | null;
  personPhone?: string | null;
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
      personEmail: (input.personEmail || '').trim() || null,
      personPhone: (input.personPhone || '').trim() || null,
      kind: input.kind,
      status,
      certificationId: cert?.id || null,
      emailSentAt: null,
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

/** Manually set a request's status (admin control). */
export async function setIdTagStatus(id: string, status: IdTagStatus): Promise<void> {
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
  dealerId: string;
  dealerName?: string;
  createdAt: Date;
}

/** All requests for one office, newest first. */
export async function listIdTagForDealer(dealerId: string): Promise<IdTagRow[]> {
  const rows = await prisma.homeDepotIdTag.findMany({
    where: { dealerId },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: { id: true, personName: true, personEmail: true, personPhone: true, kind: true, status: true, certificationId: true, dealerId: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, certified: !!r.certificationId }));
}

/** All requests across every office (admin board). */
export async function listAllIdTags(filter?: { dealerId?: string; status?: IdTagStatus }): Promise<IdTagRow[]> {
  const rows = await prisma.homeDepotIdTag.findMany({
    where: {
      ...(filter?.dealerId ? { dealerId: filter.dealerId } : {}),
      ...(filter?.status ? { status: filter.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
    select: {
      id: true, personName: true, personEmail: true, personPhone: true, kind: true, status: true,
      certificationId: true, dealerId: true, createdAt: true,
      dealer: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id, personName: r.personName, personEmail: r.personEmail, personPhone: r.personPhone,
    kind: r.kind, status: r.status, certified: !!r.certificationId, dealerId: r.dealerId,
    dealerName: r.dealer?.name, createdAt: r.createdAt,
  }));
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
