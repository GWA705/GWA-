import 'server-only';
import { prisma } from './db';
import type { ResolutionStatus, Prisma } from '@prisma/client';
import { RESOLUTION_STATUSES, OPEN_STATUSES, isResolutionStatus, ageLevel, type AgeLevel } from './resolutionStatus';
import { decryptOptional } from './crypto';
import { decodeEntities } from './htmlEntities';

export * from './resolutionStatus';

/** An ad-hoc extra contact captured on a case (e.g. a spouse's number given on a call). */
export interface ExtraContact {
  name: string;
  role: string;
  phone: string;
  email: string;
}

/** Parse the ResolutionCase.extraContacts JSON into a clean, capped array. */
export function parseExtraContacts(raw: unknown): ExtraContact[] {
  if (!Array.isArray(raw)) return [];
  const out: ExtraContact[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object') continue;
    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const c = { name: str(r.name, 80), role: str(r.role, 60), phone: str(r.phone, 40), email: str(r.email, 160) };
    if (c.name || c.phone || c.email) out.push(c);
    if (out.length >= 12) break;
  }
  return out;
}

const fmt = (d: Date) =>
  d.toLocaleString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtDay = (d: Date) => d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

/** Next "HD-###" case number (highest existing + 1; first case is HD-101). */
export async function nextCaseNumber(): Promise<string> {
  const rows = await prisma.resolutionCase.findMany({ select: { caseNumber: true } });
  let max = 100;
  for (const r of rows) {
    const n = parseInt(r.caseNumber.replace(/\D/g, ''), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `HD-${max + 1}`;
}

async function dealerNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (unique.length === 0) return new Map();
  const dealers = await prisma.dealer.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
  return new Map(dealers.map((d) => [d.id, d.name]));
}

export interface CaseRowVM {
  id: string;
  caseNumber: string;
  title: string;
  customerName: string;
  officeName: string;
  status: ResolutionStatus;
  age: AgeLevel;
  updatedAt: string;
  openedDay: string;
  awaitingReplyDays: number | null; // HD sent the last email N days ago, no reply yet
}

export interface ResolutionQueue {
  rows: CaseRowVM[];
  counts: Record<ResolutionStatus, number>;
  status: string; // the active status filter ('' = live only)
  q: string;
}

/**
 * The queue list + per-status counts. Default view (no status filter) shows the
 * live statuses; pass a specific status to see those, or 'all' for everything.
 */
export async function loadResolutionQueue(filters: { status?: string; q?: string }): Promise<ResolutionQueue> {
  const q = (filters.q ?? '').trim();
  const statusFilter = filters.status ?? '';

  const where: Prisma.ResolutionCaseWhereInput = {};
  if (statusFilter && isResolutionStatus(statusFilter)) where.status = statusFilter;
  else if (statusFilter !== 'all') where.status = { in: OPEN_STATUSES };
  if (q) {
    where.OR = [
      { caseNumber: { contains: q, mode: 'insensitive' } },
      { title: { contains: q, mode: 'insensitive' } },
      { customerName: { contains: q, mode: 'insensitive' } },
      { hdReference: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [rows, grouped] = await Promise.all([
    prisma.resolutionCase.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 300,
      select: {
        id: true, caseNumber: true, title: true, customerName: true,
        officeDealerId: true, status: true, createdAt: true, updatedAt: true,
      },
    }),
    prisma.resolutionCase.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const names = await dealerNames(rows.map((r) => r.officeDealerId));
  const counts = Object.fromEntries(RESOLUTION_STATUSES.map((s) => [s, 0])) as Record<ResolutionStatus, number>;
  for (const g of grouped) counts[g.status] = g._count._all;

  // "Awaiting our reply": the latest email per case, if it's from HD. One query;
  // first occurrence of each caseId (ordered newest-first) is its latest message.
  const awaiting = new Map<string, number>();
  if (rows.length) {
    const latest = await prisma.resolutionEmail.findMany({
      where: { caseId: { in: rows.map((r) => r.id) } },
      orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
      select: { caseId: true, inbound: true, sentAt: true, createdAt: true },
    });
    const seen = new Set<string>();
    for (const e of latest) {
      if (seen.has(e.caseId)) continue;
      seen.add(e.caseId);
      if (e.inbound) awaiting.set(e.caseId, daysSince(e.sentAt ?? e.createdAt));
    }
  }

  return {
    rows: rows.map((r) => ({
      id: r.id,
      caseNumber: r.caseNumber,
      title: r.title,
      customerName: r.customerName,
      officeName: r.officeDealerId ? names.get(r.officeDealerId) ?? '—' : '—',
      status: r.status,
      age: ageLevel(r.createdAt, r.status),
      updatedAt: fmt(r.updatedAt),
      openedDay: fmtDay(r.createdAt),
      awaitingReplyDays: awaiting.get(r.id) ?? null,
    })),
    counts,
    status: statusFilter,
    q,
  };
}

export interface CaseNoteVM {
  id: string;
  body: string;
  author: string;
  at: string;
  statusFrom: ResolutionStatus | null;
  statusTo: ResolutionStatus | null;
}

export interface CaseDealDoc {
  id: string;
  label: string;
  mime: string;
}

export interface CaseAttachmentVM {
  id: string;
  kind: 'file' | 'link';
  label: string;
  mime: string | null;
  url: string | null; // for links; files are served via /api/resolutions/attachments/<id>
  addedBy: string;
  at: string;
}

export interface CaseEmailVM {
  id: string;
  gmailMessageId: string; // for fetching the full body on demand
  fromAddr: string;
  at: string;
  snippet: string;
}

/** Linked-deal summary shown on the case so HD sees the full transaction. */
export interface CaseDealVM {
  program: string;
  productsSummary: string | null;
  saleDate: string | null;
  installDate: string | null;
  amount: string | null;
  financeCompany: string | null;
  financeNumber: string | null;
  storeLabel: string | null;
  status: string;
  financingVerified: boolean;
}

export interface CaseInstallPhotoVM { id: string; label: string; mime: string | null; }
export interface CaseDocCheckVM { label: string; present: boolean; verified: boolean; }

/** The whole customer file pulled from the linked deal (null when unlinked). */
export interface CaseFileVM {
  deal: CaseDealVM | null;
  installPhotos: CaseInstallPhotoVM[];
  docChecklist: CaseDocCheckVM[];
}

export interface CaseDetail {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  status: ResolutionStatus;
  priority: string;
  customerName: string;
  customerPhone: string;
  officeName: string;
  hdReference: string | null;
  applicationId: string | null;
  openedBy: string;
  assignedToId: string | null;
  assignedTo: string | null;
  openedAt: string;
  age: AgeLevel;
  resolvedAt: string | null;
  resolutionNote: string | null;
  notes: CaseNoteVM[];
  dealDocs: CaseDealDoc[]; // documents from the linked deal, shown as resources
  file: CaseFileVM; // the whole customer file (deal, install photos, doc checklist)
  attachments: CaseAttachmentVM[]; // files/links attached directly to the case
  hdCaseNumber: string | null;
  emailLinked: boolean;
  emailSyncedAt: string | null;
  emails: CaseEmailVM[];
  /** Days since the last email, when that last email is from HD (we owe a reply). Null otherwise. */
  awaitingReplyDays: number | null;
  // Contact card — customer + spouse + HD rep + ad-hoc extra contacts. Customer
  // email/address default from the linked deal; the case fields override.
  customerEmail: string | null;
  customerAddress: string | null;
  spouseName: string | null;
  spousePhone: string | null;
  hdRepName: string | null;
  hdRepPhone: string | null;
  hdRepEmail: string | null;
  extraContacts: ExtraContact[];
}

const daysSince = (d: Date): number => Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));

// Documents HD expects to see on a completed install deal, in display order.
const DOC_CHECKLIST: { type: string; label: string }[] = [
  { type: 'SIGNED_CONTRACT', label: 'Signed install agreement' },
  { type: 'VOID_CHEQUE_OR_PAP', label: 'Void cheque / PAP' },
  { type: 'INSTALL_PHOTO', label: 'Install photos' },
  { type: 'HD_WAIVER', label: 'HD waiver' },
  { type: 'GOVERNMENT_ID', label: 'Government ID' },
  { type: 'PROOF_OF_HOMEOWNERSHIP', label: 'Proof of homeownership' },
];

function money(d: unknown): string | null {
  if (d == null) return null;
  const n = Number(d);
  if (!Number.isFinite(n) || n === 0) return null;
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 });
}

function titleize(s: string | null | undefined): string {
  return (s || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
}

type AppForFile = {
  programType: string;
  status: string;
  requestedAmount: unknown;
  approvedAmount: unknown;
  financedAmount: unknown;
  dateOfSale: Date | null;
  installationDate: Date | null;
  loanReference: string | null;
  financeReference: string | null;
  financeItNumber: string | null;
  financeNumberVerifiedAt: Date | null;
  productsSold: string[];
  financeCompany: { name: string } | null;
  homeDepotStore: { number: string; name: string | null } | null;
} | null;

type DocForFile = { id: string; label: string | null; fileName: string; mimeType: string; type: string; verifiedAt: Date | null };

/** Assemble the customer file (deal summary, install photos, doc checklist). */
function buildCaseFile(app: AppForFile, docs: DocForFile[]): CaseFileVM {
  const installPhotos = docs
    .filter((d) => d.type === 'INSTALL_PHOTO')
    .map((d) => ({ id: d.id, label: d.label || d.fileName, mime: d.mimeType }));
  const docChecklist = DOC_CHECKLIST.map((r) => ({
    label: r.label,
    present: docs.some((d) => d.type === r.type),
    verified: docs.some((d) => d.type === r.type && !!d.verifiedAt),
  }));
  if (!app) return { deal: null, installPhotos, docChecklist };

  const store = app.homeDepotStore
    ? `#${app.homeDepotStore.number}${app.homeDepotStore.name ? ` ${app.homeDepotStore.name}` : ''}`
    : null;
  const deal: CaseDealVM = {
    program: titleize(app.programType),
    productsSummary: app.productsSold.length ? app.productsSold.join(', ') : null,
    saleDate: app.dateOfSale ? fmtDay(app.dateOfSale) : null,
    installDate: app.installationDate ? fmtDay(app.installationDate) : null,
    amount: money(app.financedAmount) ?? money(app.approvedAmount) ?? money(app.requestedAmount),
    financeCompany: app.financeCompany?.name ?? null,
    financeNumber: app.financeItNumber || app.loanReference || app.financeReference || null,
    storeLabel: store,
    status: titleize(app.status),
    financingVerified: !!app.financeNumberVerifiedAt,
  };
  return { deal, installPhotos, docChecklist };
}

export async function loadResolutionCase(id: string): Promise<CaseDetail | null> {
  const c = await prisma.resolutionCase.findUnique({
    where: { id },
    include: {
      openedBy: { select: { name: true } },
      assignedTo: { select: { id: true, name: true } },
      notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } },
      attachments: { orderBy: { createdAt: 'desc' }, include: { addedBy: { select: { name: true } } } },
      emails: { orderBy: [{ sentAt: 'asc' }, { createdAt: 'asc' }] },
      application: {
        select: {
          applicantEmail: true, applicantAddressEnc: true,
          programType: true, status: true,
          requestedAmount: true, approvedAmount: true, financedAmount: true,
          dateOfSale: true, installationDate: true,
          loanReference: true, financeReference: true, financeItNumber: true,
          financeNumberVerifiedAt: true, productsSold: true,
          financeCompany: { select: { name: true } },
          homeDepotStore: { select: { number: true, name: true } },
        },
      },
    },
  });
  if (!c) return null;

  const names = await dealerNames([c.officeDealerId]);
  const docs = c.applicationId
    ? await prisma.document.findMany({
        where: { applicationId: c.applicationId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, label: true, fileName: true, mimeType: true, type: true, verifiedAt: true },
      })
    : [];
  const dealDocs = docs;

  // The whole customer file, assembled from the linked deal.
  const file: CaseFileVM = buildCaseFile(c.application, docs);

  return {
    id: c.id,
    caseNumber: c.caseNumber,
    title: c.title,
    description: c.description,
    status: c.status,
    priority: c.priority,
    customerName: c.customerName,
    customerPhone: c.customerPhone,
    officeName: c.officeDealerId ? names.get(c.officeDealerId) ?? '—' : '—',
    hdReference: c.hdReference,
    applicationId: c.applicationId,
    openedBy: c.openedBy?.name ?? '—',
    assignedToId: c.assignedTo?.id ?? null,
    assignedTo: c.assignedTo?.name ?? null,
    openedAt: fmt(c.createdAt),
    age: ageLevel(c.createdAt, c.status),
    resolvedAt: c.resolvedAt ? fmt(c.resolvedAt) : null,
    resolutionNote: c.resolutionNote,
    notes: c.notes.map((n) => ({
      id: n.id,
      body: n.body,
      author: n.author?.name ?? '—',
      at: fmt(n.createdAt),
      statusFrom: n.statusFrom,
      statusTo: n.statusTo,
    })),
    dealDocs: dealDocs.map((d) => ({ id: d.id, label: d.label || d.fileName, mime: d.mimeType })),
    file,
    attachments: c.attachments.map((a) => ({
      id: a.id,
      kind: a.kind === 'link' ? 'link' : 'file',
      label: a.label,
      mime: a.mimeType,
      url: a.url,
      addedBy: a.addedBy?.name ?? '—',
      at: fmt(a.createdAt),
    })),
    hdCaseNumber: c.hdCaseNumber,
    emailLinked: !!c.gmailThreadId,
    emailSyncedAt: c.emailSyncedAt ? fmt(c.emailSyncedAt) : null,
    emails: c.emails.map((e) => ({
      id: e.id,
      gmailMessageId: e.gmailMessageId,
      fromAddr: e.fromAddr,
      at: e.sentAt ? fmt(e.sentAt) : fmt(e.createdAt),
      snippet: decodeEntities(e.snippet),
    })),
    awaitingReplyDays: (() => {
      const last = c.emails[c.emails.length - 1]; // emails ordered oldest→newest
      return last && last.inbound ? daysSince(last.sentAt ?? last.createdAt) : null;
    })(),
    // Contact card: case value wins, else the linked deal's.
    customerEmail: c.customerEmail ?? c.application?.applicantEmail ?? null,
    customerAddress: c.customerAddress ?? decryptOptional(c.application?.applicantAddressEnc ?? null) ?? null,
    spouseName: c.spouseName,
    spousePhone: c.spousePhone,
    hdRepName: c.hdRepName,
    hdRepPhone: c.hdRepPhone,
    hdRepEmail: c.hdRepEmail,
    extraContacts: parseExtraContacts(c.extraContacts),
  };
}

/** Open HD cases exist? — drives the nav badge. */
export async function hasOpenResolutions(): Promise<boolean> {
  const n = await prisma.resolutionCase.count({ where: { status: { in: OPEN_STATUSES } } });
  return n > 0;
}

/** Open cases for one customer (by normalized phone) — shown on the customer view. */
export async function openCasesForCustomer(phone: string | null | undefined): Promise<{ id: string; caseNumber: string; title: string; status: ResolutionStatus }[]> {
  const norm = (phone ?? '').replace(/\D/g, '').slice(-10);
  if (!norm) return [];
  return prisma.resolutionCase.findMany({
    where: { customerPhone: norm, status: { in: OPEN_STATUSES } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, caseNumber: true, title: true, status: true },
  });
}
