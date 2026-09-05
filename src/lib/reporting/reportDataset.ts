import 'server-only';
import { prisma } from '@/lib/db';
import { programLabel, STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import type { ApplicationStatus, EntryMethod, Prisma } from '@prisma/client';

const APPROVED_SET: ApplicationStatus[] = ['CONDITIONAL', 'APPROVED', 'DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'];
const ENTRY_LABELS: Record<EntryMethod, string> = { FINANCEIT: 'Express', TYPED: 'Priority', PHOTO: 'Standard' };

/**
 * A flat, per-deal dataset the custom report builder runs on entirely in the
 * browser. Tenant-scoped by dealerIds. Kept small (one row per deal, a handful
 * of fields) so it's cheap to ship to the client and instant to slice.
 */
export interface ReportRow {
  ym: string; // 'YYYY-MM' of createdAt
  amount: number; // approved amount, falling back to requested
  program: string;
  status: string; // display label
  statusRaw: ApplicationStatus;
  salesperson: string;
  province: string;
  products: string[];
  paymentMethod: string;
  entryMethod: string;
  hdStore: string;
  approved: boolean; // approved-or-beyond (for approval-rate measure)
}

export async function reportDataset(opts: { dealerIds?: string[] } = {}): Promise<ReportRow[]> {
  const where: Prisma.ApplicationWhereInput = { status: { not: 'DRAFT' } };
  if (opts.dealerIds) where.dealerId = { in: opts.dealerIds };

  const apps = await prisma.application.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5000,
    select: {
      createdAt: true, approvedAmount: true, requestedAmount: true,
      programType: true, programCategory: true, status: true,
      salespersonName: true, province: true, productsSold: true,
      paymentMethod: true, entryMethod: true,
      homeDepotStore: { select: { number: true } },
    },
  });

  return apps.map((a) => ({
    ym: `${a.createdAt.getFullYear()}-${String(a.createdAt.getMonth() + 1).padStart(2, '0')}`,
    amount: Number(a.approvedAmount ?? a.requestedAmount) || 0,
    program: programLabel(a.programType, a.programCategory),
    status: STATUS_LABELS[a.status] ?? a.status,
    statusRaw: a.status,
    salesperson: (a.salespersonName ?? '').trim() || 'Unknown',
    province: a.province || '—',
    products: a.productsSold.map((p) => p.trim()).filter(Boolean),
    paymentMethod: a.paymentMethod ? PAYMENT_METHOD_LABELS[a.paymentMethod] : '—',
    entryMethod: ENTRY_LABELS[a.entryMethod] ?? a.entryMethod,
    hdStore: a.homeDepotStore?.number || '—',
    approved: APPROVED_SET.includes(a.status),
  }));
}
