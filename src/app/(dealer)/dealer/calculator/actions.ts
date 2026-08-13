'use server';

import { requireDealerAccess } from '@/lib/session';
import { hasCalculatorAccess } from '@/lib/calculatorAccess';
import { prisma } from '@/lib/db';
import { dealerPortalScopeWhere } from '@/lib/rbac';
import { STATUS_LABELS_SHORT } from '@/lib/constants';

export interface DealMatch {
  id: string;
  name: string;
  amount: number | null;
  province: string;
  reference: string; // deal / HD reference for the label
  statusLabel: string;
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
    },
  });

  return apps.map((a) => ({
    id: a.id,
    name: `${a.applicantFirstName} ${a.applicantLastName}`.trim(),
    amount: a.approvedAmount != null ? Number(a.approvedAmount) : null,
    province: a.province,
    reference: a.hdReference || a.financeItNumber || '',
    statusLabel: STATUS_LABELS_SHORT[a.status],
  }));
}
