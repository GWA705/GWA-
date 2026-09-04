import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { dealerPortalScopeWhere } from '@/lib/rbac';
import { programLabel } from '@/lib/constants';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { RecentApplications, type RecentApp } from '@/components/dashboard/RecentApplications';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { SupportCard } from '@/components/dashboard/SupportCard';
import { StatusDonut } from '@/components/dashboard/StatusDonut';
import { MonthlyTrend } from '@/components/dashboard/MonthlyTrend';
import { ProgramBreakdown } from '@/components/dashboard/ProgramBreakdown';
import { FileText, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import type { ApplicationStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const APPROVED: ApplicationStatus[] = ['CONDITIONAL', 'APPROVED', 'DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'];
const PENDING: ApplicationStatus[] = ['SUBMITTED', 'UNDER_REVIEW'];
const ACTION_NEEDED: ApplicationStatus[] = ['APPROVED', 'CONDITIONAL', 'DOCS_SENT', 'PROBLEM'];

const money = (n: number) => `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function DealerDashboard() {
  const user = await requireDealerAccess();
  const where = dealerPortalScopeWhere(user);

  const [apps, profile] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true, status: true, createdAt: true, approvedAmount: true, requestedAmount: true,
        programType: true, programCategory: true, province: true,
        applicantFirstName: true, applicantLastName: true,
      },
    }),
    user.dealerId ? prisma.dealerProfile.findUnique({ where: { dealerId: user.dealerId }, select: { businessName: true } }) : Promise.resolve(null),
  ]);

  const amountOf = (a: (typeof apps)[number]) => Number(a.approvedAmount ?? a.requestedAmount);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = apps.filter((a) => a.createdAt >= monthStart);

  const totalThisMonth = thisMonth.length;
  const approvedThisMonth = thisMonth.filter((a) => APPROVED.includes(a.status)).length;
  const approvalRate = totalThisMonth ? Math.round((approvedThisMonth / totalThisMonth) * 100) : 0;
  const pendingNow = apps.filter((a) => PENDING.includes(a.status)).length;
  const valueThisMonth = thisMonth.reduce((s, a) => s + amountOf(a), 0);

  // Donut — all-time
  const approvedAll = apps.filter((a) => APPROVED.includes(a.status)).length;
  const pendingAll = apps.filter((a) => PENDING.includes(a.status)).length;
  const declinedAll = apps.filter((a) => a.status === 'DECLINED').length;

  // Monthly trend — last 3 calendar months
  const months = [2, 1, 0].map((back) => {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const value = apps.filter((a) => a.createdAt >= d && a.createdAt < next).length;
    return { label: d.toLocaleDateString('en-CA', { month: 'short' }), value };
  });

  // Program breakdown
  const progMap = new Map<string, number>();
  for (const a of apps) {
    const label = programLabel(a.programType, a.programCategory);
    progMap.set(label, (progMap.get(label) ?? 0) + 1);
  }
  const progTotal = apps.length || 1;
  const programs = [...progMap.entries()]
    .map(([label, count]) => ({ label, count, pct: Math.round((count / progTotal) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const recent: RecentApp[] = apps.slice(0, 4).map((a) => ({
    id: a.id,
    name: `${a.applicantFirstName} ${a.applicantLastName}`.trim(),
    province: a.province,
    program: programLabel(a.programType, a.programCategory),
    amount: money(amountOf(a)),
    status: a.status,
    submitted: a.createdAt.toLocaleDateString('en-CA'),
    actionNeeded: ACTION_NEEDED.includes(a.status),
  }));

  const firstName = user.name.split(' ')[0] || user.name;

  return (
    <div className="space-y-4">
      <DashboardHero firstName={firstName} companyName={profile?.businessName ?? null} />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={FileText} title="Total Applications" value={String(totalThisMonth)} subtitle="This month" tone="blue" href="/dealer/applications" />
        <KpiCard icon={CheckCircle2} title="Approved" value={String(approvedThisMonth)} subtitle={`${approvalRate}% approval rate`} tone="green" />
        <KpiCard icon={Clock} title="Pending" value={String(pendingNow)} subtitle="Awaiting review" tone="blue" href="/dealer/applications?status=SUBMITTED" />
        <KpiCard icon={DollarSign} title="Total Value" value={money(valueThisMonth)} subtitle="This month" tone="blue" />
      </div>

      {/* Recent applications + right rail */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_360px]">
        <RecentApplications items={recent} />
        <div className="space-y-3">
          <QuickActions />
          <SupportCard />
        </div>
      </div>

      {/* Insights row */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <StatusDonut approved={approvedAll} pending={pendingAll} declined={declinedAll} />
        <MonthlyTrend months={months} />
        <ProgramBreakdown items={programs} />
      </div>
    </div>
  );
}
