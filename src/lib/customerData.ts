import 'server-only';
import { prisma } from './db';
import { audit } from './audit';

/**
 * Subject-access / erasure support (PIPEDA s.8/4.9). Find everything we hold for a
 * customer (keyed by phone), and erase the marketing/texting data on request.
 *
 * Funded deals / credit applications are NOT auto-deleted: financing and tax law
 * require retaining those records, which PIPEDA recognizes as an exception. They
 * are surfaced read-only with a retention note, for a human to handle separately.
 */

const last10 = (p: string | null | undefined) => (p ?? '').replace(/\D/g, '').slice(-10);

export interface CustomerDataFound {
  phoneLast10: string;
  texts: number;
  replies: number;
  optedOut: boolean;
  leads: { id: string; name: string | null; createdAt: string }[];
  deals: { id: string; name: string; status: string }[]; // retained, not deleted
  cases: { id: string; caseNumber: string }[]; // retained
}

export async function findCustomerData(phoneRaw: string): Promise<CustomerDataFound | null> {
  const l10 = last10(phoneRaw);
  if (l10.length < 10) return null;
  const l4 = l10.slice(-4);

  const [texts, replies, optOut, leadCand, appCand, cases] = await Promise.all([
    prisma.leadTextOutbox.count({ where: { phone: { endsWith: l10 } } }),
    prisma.leadTextOutbox.count({ where: { phone: { endsWith: l10 }, repliedAt: { not: null } } }),
    prisma.smsOptOut.findFirst({ where: { phone: { endsWith: l10 } }, select: { phone: true } }),
    prisma.scannedLead.findMany({ where: { phone: { contains: l4 } }, select: { id: true, phone: true, customerName: true, createdAt: true }, take: 100 }),
    prisma.application.findMany({ where: { applicantPhone: { contains: l4 } }, select: { id: true, applicantPhone: true, applicantFirstName: true, applicantLastName: true, status: true }, take: 100 }),
    prisma.resolutionCase.findMany({ where: { customerPhone: l10 }, select: { id: true, caseNumber: true }, take: 50 }),
  ]);

  const leads = leadCand
    .filter((x) => last10(x.phone) === l10)
    .map((x) => ({ id: x.id, name: x.customerName, createdAt: x.createdAt.toLocaleDateString('en-CA') }));
  const deals = appCand
    .filter((x) => last10(x.applicantPhone) === l10)
    .map((x) => ({ id: x.id, name: `${x.applicantFirstName} ${x.applicantLastName}`.trim(), status: String(x.status) }));

  return { phoneLast10: l10, texts, replies, optedOut: !!optOut, leads, deals, cases };
}

export async function recordDataAccess(phoneRaw: string, actorId: string): Promise<void> {
  const l10 = last10(phoneRaw);
  if (l10.length < 10) return;
  await audit({ actorId, action: 'DATA_ACCESS', entityType: 'Customer', entityId: l10, detail: `Customer data lookup for •••${l10.slice(-4)}` });
}

/**
 * Erase the customer's texting + marketing-lead data. Keeps a suppression entry
 * (opt-out) so we never re-contact them, and leaves funded deals/cases in place
 * (legal retention). Audited. Returns what was removed.
 */
export async function eraseCustomerTextingData(phoneRaw: string, actorId: string): Promise<{ textsDeleted: number; leadsDeleted: number }> {
  const l10 = last10(phoneRaw);
  if (l10.length < 10) return { textsDeleted: 0, leadsDeleted: 0 };
  const l4 = l10.slice(-4);

  // Keep a suppression record so erasure doesn't let us text them again (CASL).
  const e164 = `+1${l10}`;
  await prisma.smsOptOut.upsert({ where: { phone: e164 }, create: { phone: e164, source: 'ERASURE' }, update: {} });

  const texts = await prisma.leadTextOutbox.deleteMany({ where: { phone: { endsWith: l10 } } });

  const leadCand = await prisma.scannedLead.findMany({ where: { phone: { contains: l4 } }, select: { id: true, phone: true } });
  const ids = leadCand.filter((x) => last10(x.phone) === l10).map((x) => x.id);
  let leadsDeleted = 0;
  if (ids.length) {
    const d = await prisma.scannedLead.deleteMany({ where: { id: { in: ids } } });
    leadsDeleted = d.count;
  }

  await audit({
    actorId, action: 'DATA_ERASURE', entityType: 'Customer', entityId: l10,
    detail: `Erased texting + lead data for •••${l10.slice(-4)}: ${texts.count} text records, ${leadsDeleted} leads. Suppression kept. Funded deals/cases retained.`,
  });
  return { textsDeleted: texts.count, leadsDeleted };
}
