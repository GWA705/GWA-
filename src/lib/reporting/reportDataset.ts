import 'server-only';
import { prisma } from '@/lib/db';
import { programLabel, STATUS_LABELS } from '@/lib/constants';
import type { ApplicationStatus, Prisma } from '@prisma/client';

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
  }));
}
