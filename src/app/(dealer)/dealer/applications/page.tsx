import Link from 'next/link';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { dealerPortalScopeWhere } from '@/lib/rbac';
import { programLabel, STATUS_LABELS } from '@/lib/constants';
import { dealerOutstanding } from '@/lib/outstanding';
import { dealStage, dealGroup } from '@/lib/dealerStage';
import { SectionHero } from '@/components/SectionHero';
import { ApplicationsWorkspace, type DealVM } from '@/components/dashboard/ApplicationsWorkspace';

export const dynamic = 'force-dynamic';

const VIEWS = ['tracker', 'pipeline', 'list', 'progress'] as const;
type ViewKey = (typeof VIEWS)[number];

const money = (n: number) => `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function DealerApplications() {
  const user = await requireDealerAccess();

  const [apps, pinRows, usage] = await Promise.all([
    prisma.application.findMany({
      where: dealerPortalScopeWhere(user),
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        documents: { where: { stage: 'FUNDING' as const }, select: { type: true, verifiedAt: true } },
        serialNumbers: { select: { productLabel: true, value: true } },
        financeCompany: { select: { requiresSerialPerProduct: true } },
        _count: { select: { payouts: true } },
      },
    }),
    prisma.applicationPin.findMany({ where: { userId: user.userId }, select: { applicationId: true } }).catch(() => []),
    prisma.applicationViewUsage.findMany({ where: { userId: user.userId }, orderBy: { updatedAt: 'desc' }, take: 1 }).catch(() => []),
  ]);

  const pinnedSet = new Set(pinRows.map((r) => r.applicationId));
  const initialView: ViewKey = usage[0] && (VIEWS as readonly string[]).includes(usage[0].view) ? (usage[0].view as ViewKey) : 'tracker';

  const deals: DealVM[] = apps.map((a) => {
    const isPaid = a._count.payouts > 0 || a.journalPaidOn != null;
    const outstanding = dealerOutstanding({
      status: a.status,
      programType: a.programType,
      paymentMethod: a.paymentMethod,
      isSplitPayment: a.isSplitPayment,
      productsSold: a.productsSold,
      requiresSerials: !!a.financeCompany?.requiresSerialPerProduct && a.productsSold.length > 0,
      serialNumbers: a.serialNumbers,
      fundingDocs: a.documents,
    });
    const stage = dealStage(a.status, isPaid);
    const amount = Number(a.approvedAmount ?? a.requestedAmount);
    return {
      id: a.id,
      name: `${a.applicantFirstName} ${a.applicantLastName}`.trim(),
      province: a.province,
      program: programLabel(a.programType, a.programCategory),
      amount,
      amountLabel: money(amount),
      status: a.status,
      statusLabel: STATUS_LABELS[a.status] ?? a.status,
      submitted: a.createdAt.toLocaleDateString('en-CA'),
      submittedTs: a.createdAt.getTime(),
      pinned: pinnedSet.has(a.id),
      hasAction: outstanding.hasAction,
      readyToSubmit: outstanding.readyToSubmit,
      problem: a.status === 'PROBLEM',
      stageKey: stage.key,
      stageLabel: stage.label,
      pct: stage.pct,
      group: dealGroup(a.status, isPaid, outstanding.hasAction),
    };
  });

  return (
    <div className="space-y-4">
      <SectionHero
        eyebrow="Deals"
        title="Applications"
        subtitle="Track every deal through approval, documents and funding — your way."
        actions={
          <Link href="/dealer/applications/new" className="inline-flex items-center gap-2 rounded-lg bg-[#ffffff] px-4 py-2 text-sm font-semibold text-[#0e2b5c] transition hover:bg-blue-50">
            New customer processing
          </Link>
        }
      />
      <ApplicationsWorkspace deals={deals} initialView={initialView} />
    </div>
  );
}
