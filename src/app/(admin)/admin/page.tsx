import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants';
import type { ApplicationStatus } from '@prisma/client';
import { StorageCheck } from './StorageCheck';
import { StoreImport } from './StoreImport';

export const dynamic = 'force-dynamic';

const ACTIVE: ApplicationStatus[] = [
  'SUBMITTED', 'UNDER_REVIEW', 'CONDITIONAL', 'APPROVED', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'PROBLEM',
];

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-CA');
}

export default async function AdminOverview() {
  await requireRole('ADMIN');

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 3_600_000);

  const [
    dealers,
    users,
    apps,
    statusGroups,
    monthPaid,
    fundedThisMonth,
    pendingReview,
    awaitingDealer,
    problems,
    activeCount,
    fundedForAvg,
    dealerRows,
  ] = await Promise.all([
    prisma.dealer.count(),
    prisma.user.count(),
    prisma.application.count(),
    prisma.application.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.payout.aggregate({ _sum: { amount: true }, where: { paidOn: { gte: monthStart } } }),
    prisma.application.count({ where: { status: 'FUNDED', updatedAt: { gte: monthStart } } }),
    prisma.application.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.application.count({ where: { status: { in: ['APPROVED', 'CONDITIONAL', 'PROBLEM'] } } }),
    prisma.application.count({ where: { status: 'PROBLEM' } }),
    prisma.application.count({ where: { status: { in: ACTIVE } } }),
    prisma.application.findMany({
      where: { datePaid: { not: null, gte: ninetyDaysAgo } },
      select: { createdAt: true, datePaid: true },
    }),
    // Per-dealer active + funded-this-month counts, with names.
    prisma.dealer.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            applications: { where: { status: { in: ACTIVE } } },
          },
        },
        applications: {
          where: { status: 'FUNDED', updatedAt: { gte: monthStart } },
          select: { id: true },
        },
      },
    }),
  ]);

  // Average days from creation to payment (last 90 days).
  const durations = fundedForAvg
    .filter((a) => a.datePaid)
    .map((a) => (a.datePaid!.getTime() - a.createdAt.getTime()) / 86_400_000)
    .filter((d) => d >= 0);
  const avgDaysToFund = durations.length
    ? Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 10) / 10
    : null;

  const paidThisMonth = Number(monthPaid._sum.amount ?? 0);

  const statusCount = new Map<string, number>(statusGroups.map((g) => [g.status, g._count._all]));

  const perDealer = dealerRows
    .map((d) => ({
      id: d.id,
      name: d.name,
      active: d._count.applications,
      fundedThisMonth: d.applications.length,
    }))
    .filter((d) => d.active > 0 || d.fundedThisMonth > 0)
    .sort((a, b) => b.active - a.active || b.fundedThisMonth - a.fundedThisMonth)
    .slice(0, 12);

  const kpis = [
    { label: 'Active deals', value: String(activeCount), href: '/staff', tone: 'text-brand-700' },
    { label: 'Pending review', value: String(pendingReview), href: '/staff', tone: 'text-sky-700' },
    { label: 'Awaiting dealer', value: String(awaitingDealer), href: '/staff', tone: 'text-amber-700' },
    { label: 'Problems', value: String(problems), href: '/staff', tone: 'text-red-700' },
    { label: 'Funded this month', value: String(fundedThisMonth), href: '/staff', tone: 'text-green-700' },
    { label: 'Paid this month', value: money(paidThisMonth), href: '/staff', tone: 'text-green-700' },
    { label: 'Avg days to fund', value: avgDaysToFund == null ? '—' : `${avgDaysToFund}`, href: '/staff', tone: 'text-gray-700' },
  ];

  // Status breakdown bars (active + finished, largest first).
  const breakdown = (Object.keys(STATUS_LABELS) as ApplicationStatus[])
    .map((s) => ({ status: s, count: statusCount.get(s) ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxBar = Math.max(1, ...breakdown.map((r) => r.count));

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-gray-900">Overview</h1>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="card p-5 transition hover:shadow">
            <div className={`text-2xl font-semibold tabular-nums ${k.tone}`}>{k.value}</div>
            <div className="mt-1 text-sm text-gray-500">{k.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Deals by status */}
        <div className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Deals by status</h2>
          {breakdown.length === 0 ? (
            <p className="text-sm text-gray-500">No deals yet.</p>
          ) : (
            <ul className="space-y-2">
              {breakdown.map((r) => (
                <li key={r.status} className="flex items-center gap-3 text-sm">
                  <span className={`badge w-36 shrink-0 justify-center ${STATUS_COLORS[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(r.count / maxBar) * 100}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right tabular-nums text-gray-600">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Per-dealer volume */}
        <div className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">By dealer</h2>
          {perDealer.length === 0 ? (
            <p className="text-sm text-gray-500">No active deals right now.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="pb-2 pr-3">Dealer</th>
                    <th className="pb-2 px-3 text-right">Active</th>
                    <th className="pb-2 pl-3 text-right">Funded this month</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {perDealer.map((d) => (
                    <tr key={d.id}>
                      <td className="py-2 pr-3 font-medium text-gray-800">{d.name}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{d.active}</td>
                      <td className="py-2 pl-3 text-right tabular-nums">{d.fundedThisMonth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Reference totals */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Dealers', value: dealers, href: '/admin/dealers' },
          { label: 'Users', value: users, href: '/admin/users' },
          { label: 'Total deals (all time)', value: apps, href: '/staff' },
        ].map((c) => (
          <Link key={c.label} href={c.href} className="card p-4 transition hover:shadow">
            <div className="text-xl font-semibold text-gray-800 tabular-nums">{c.value}</div>
            <div className="mt-0.5 text-xs text-gray-500">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        <StorageCheck />
        <StoreImport />
      </div>
    </div>
  );
}
