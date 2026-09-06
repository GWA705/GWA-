import { NextResponse } from 'next/server';
import { requireDealerAccess } from '@/lib/session';
import { canViewOwnerPricingReport } from '@/lib/reporting/access';
import { dealerPortalScopeWhere } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { computeDealerPayout } from '@/lib/payoutCalc';
import { PAYMENT_METHOD_LABELS, STATUS_LABELS, programLabel } from '@/lib/constants';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * Accounting export (CSV) for the distributor (office owner) — one row per deal
 * with the full EFT payout breakdown, so an accounting team can reconcile every
 * deal. Owner-gated (distributor + reports enabled) and tenant-scoped to the
 * signed-in dealer's own office. Filtered by sale date (falls back to created
 * date when a deal has no recorded sale date).
 */

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const money2 = (n: number) => n.toFixed(2);

function parseDay(v: string | null, end = false): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
}

export async function GET(req: Request) {
  const user = await requireDealerAccess();
  if (!(await canViewOwnerPricingReport(user)) || !user.dealerId) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const url = new URL(req.url);
  const from = parseDay(url.searchParams.get('from'));
  const to = parseDay(url.searchParams.get('to'), true);

  const range = (): Prisma.DateTimeFilter => {
    const c: Prisma.DateTimeFilter = {};
    if (from) c.gte = from;
    if (to) c.lte = to;
    return c;
  };

  const where: Prisma.ApplicationWhereInput = {
    ...dealerPortalScopeWhere(user),
    status: { not: 'DRAFT' },
    ...(from || to
      ? { OR: [{ dateOfSale: range() }, { dateOfSale: null, createdAt: range() }] }
      : {}),
  };

  const apps = await prisma.application.findMany({
    where,
    orderBy: [{ dateOfSale: 'desc' }, { createdAt: 'desc' }],
    take: 5000,
    select: {
      applicantFirstName: true, applicantLastName: true,
      approvedAmount: true, requestedAmount: true, province: true,
      hdReference: true, financeItNumber: true, status: true,
      dateOfSale: true, createdAt: true, productsSold: true,
      salespersonName: true, installerName: true, paymentMethod: true,
      programType: true, programCategory: true,
    },
  });

  const headers = [
    'sale_date', 'customer', 'reference', 'program', 'province', 'status',
    'products', 'sales_rep', 'installer', 'payment_method',
    'total_with_tax', 'subtotal_pre_tax', 'hd_discount_13pct', 'ibx_discount_1_25pct',
    'hd_program_4pct', 'net_pre_tax', 'tax', 'eft_payout',
  ];

  const rows = apps.map((a) => {
    const gross = Number(a.approvedAmount ?? a.requestedAmount ?? 0);
    const p = computeDealerPayout(gross, a.province);
    const saleDate = (a.dateOfSale ?? a.createdAt).toISOString().slice(0, 10);
    return [
      saleDate,
      `${a.applicantFirstName} ${a.applicantLastName}`.trim(),
      a.hdReference || a.financeItNumber || '',
      programLabel(a.programType, a.programCategory),
      a.province ?? '',
      STATUS_LABELS[a.status] ?? a.status,
      (a.productsSold ?? []).filter(Boolean).join(' | '),
      a.salespersonName ?? '',
      a.installerName ?? '',
      a.paymentMethod ? (PAYMENT_METHOD_LABELS[a.paymentMethod] ?? '') : '',
      money2(gross),
      p.ok ? money2(p.subtotal) : '',
      p.ok ? money2(p.hdDiscount) : '',
      p.ok ? money2(p.ibxDiscount) : '',
      p.ok ? money2(p.hdProgram) : '',
      p.ok ? money2(p.netPreTax) : '',
      p.ok ? money2(p.hst) : '',
      p.ok ? money2(p.payout) : '',
    ];
  });

  // BOM so Excel opens the UTF-8 CSV cleanly.
  const csv = '﻿' + [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gwa-payouts-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
