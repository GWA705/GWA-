'use server';

import { requireDealerAccess } from '@/lib/session';
import { hasCalculatorAccess } from '@/lib/calculatorAccess';
import { prisma } from '@/lib/db';
import { dealerPortalScopeWhere } from '@/lib/rbac';
import { STATUS_LABELS_SHORT, PAYMENT_METHOD_LABELS } from '@/lib/constants';

export interface DealMatch {
  id: string;
  name: string;
  amount: number | null;
  province: string;
  reference: string; // deal / HD reference for the label
  statusLabel: string;
  // Sale details for the printable receipt (best-effort; may be empty).
  saleDate: string | null;      // ISO date (yyyy-mm-dd) of the sale
  products: string[];
  salesperson: string | null;
  installer: string | null;
  paymentLabel: string | null;  // how the customer paid
  // Actual settlement — populated once the deal is fully paid (a payout has been
  // recorded, usually auto-filled from the journal's "Pay to dealer"). When paid,
  // the calculator shows this REAL figure instead of the estimate.
  isPaid: boolean;
  actualPayout: number | null;  // total recorded payout ($), only when paid
  paidOn: string | null;        // ISO date of the latest payout
  payoutMethod: string | null;
  payoutReference: string | null;
}

/**
 * Search the signed-in dealer's OWN portal deals by customer name or deal /
 * reference number, to auto-fill the payout calculator. Tenant-scoped — a dealer
 * only ever sees their own applications. Returns the approved amount + province
 * so the calculator can populate reliably from portal data.
 */
export async function searchDealerDeals(query: string): Promise<DealMatch[]> {
  const user = await requireDealerAccess();
  if (!(await hasCalculatorAccess(user))) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  const scope = dealerPortalScopeWhere(user); // { dealerId }
  const terms = q.split(/\s+/).filter(Boolean);

  const apps = await prisma.application.findMany({
    where: {
      ...scope,
      OR: [
        // Name: every term must appear in first or last name.
        {
          AND: terms.map((t) => ({
            OR: [
              { applicantFirstName: { contains: t, mode: 'insensitive' as const } },
              { applicantLastName: { contains: t, mode: 'insensitive' as const } },
            ],
          })),
        },
        { hdReference: { contains: q, mode: 'insensitive' } },
        { financeItNumber: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: {
      id: true,
      applicantFirstName: true,
      applicantLastName: true,
      approvedAmount: true,
      province: true,
      hdReference: true,
      financeItNumber: true,
      status: true,
      dateOfSale: true,
      productsSold: true,
      salespersonName: true,
      installerName: true,
      paymentMethod: true,
      journalPaidOn: true,
      payouts: {
        select: { amount: true, paidOn: true, method: true, reference: true },
        orderBy: { paidOn: 'desc' },
      },
    },
  });

  return apps.map((a) => {
    const isPaid = a.payouts.length > 0;
    const actualPayout = isPaid ? a.payouts.reduce((sum, p) => sum + Number(p.amount), 0) : null;
    const latest = a.payouts[0] ?? null;
    return {
      id: a.id,
      name: `${a.applicantFirstName} ${a.applicantLastName}`.trim(),
      amount: a.approvedAmount != null ? Number(a.approvedAmount) : null,
      province: a.province,
      reference: a.hdReference || a.financeItNumber || '',
      statusLabel: STATUS_LABELS_SHORT[a.status],
      saleDate: a.dateOfSale ? a.dateOfSale.toISOString().slice(0, 10) : null,
      products: Array.isArray(a.productsSold) ? a.productsSold.filter(Boolean) : [],
      salesperson: a.salespersonName || null,
      installer: a.installerName || null,
      paymentLabel: a.paymentMethod ? (PAYMENT_METHOD_LABELS[a.paymentMethod] ?? null) : null,
      isPaid,
      actualPayout,
      paidOn: latest ? latest.paidOn.toISOString().slice(0, 10) : null,
      payoutMethod: latest?.method ?? null,
      payoutReference: latest?.reference ?? null,
    };
  });
}
