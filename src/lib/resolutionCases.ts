import 'server-only';
import { prisma } from './db';
import type { ResolutionStatus, Prisma } from '@prisma/client';
import { RESOLUTION_STATUSES, OPEN_STATUSES, isResolutionStatus, ageLevel, type AgeLevel } from './resolutionStatus';

export * from './resolutionStatus';

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
  fromAddr: string;
  at: string;
  snippet: string;
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
  attachments: CaseAttachmentVM[]; // files/links attached directly to the case
  emailLinked: boolean;
  emailSyncedAt: string | null;
  emails: CaseEmailVM[];
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
    },
  });
  if (!c) return null;

  const names = await dealerNames([c.officeDealerId]);
  const dealDocs = c.applicationId
    ? await prisma.document.findMany({
        where: { applicationId: c.applicationId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, label: true, fileName: true, mimeType: true },
      })
    : [];

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
    attachments: c.attachments.map((a) => ({
      id: a.id,
      kind: a.kind === 'link' ? 'link' : 'file',
      label: a.label,
      mime: a.mimeType,
      url: a.url,
      addedBy: a.addedBy?.name ?? '—',
      at: fmt(a.createdAt),
    })),
    emailLinked: !!c.gmailThreadId,
    emailSyncedAt: c.emailSyncedAt ? fmt(c.emailSyncedAt) : null,
    emails: c.emails.map((e) => ({
      id: e.id,
      fromAddr: e.fromAddr,
      at: e.sentAt ? fmt(e.sentAt) : fmt(e.createdAt),
      snippet: e.snippet,
    })),
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
